import { HttpStatus, Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import puppeteer, { Browser } from 'puppeteer-core';
import { DomainException } from '../../../common/filters/domain.exception';

// Common install locations for a system Chrome/Chromium, checked in order
// when PUPPETEER_EXECUTABLE_PATH is unset OR doesn't exist — lets
// `npm run start:dev` outside Docker work off a developer's existing
// browser install without requiring the puppeteer-bundled Chromium
// download (avoided deliberately: see the module plan doc's PDF-engine
// decision). Includes both `chromium-browser` and `chromium` since Alpine's
// `apk add chromium` package has installed the binary under either name
// depending on Alpine version — this list is also the safety net if the
// Dockerfile's hardcoded PUPPETEER_EXECUTABLE_PATH guess is wrong for the
// Alpine version actually in use (verify at build time; this fallback
// means a wrong guess degrades to "found the other path" instead of a
// hard failure).
const LOCAL_FALLBACK_PATHS = [
  '/usr/bin/chromium-browser',
  '/usr/bin/chromium',
  '/usr/bin/google-chrome',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
];

@Injectable()
export class PdfRendererService implements OnModuleDestroy {
  private readonly logger = new Logger('PdfRendererService');
  private browserPromise: Promise<Browser> | null = null;

  constructor(private readonly config: ConfigService) {}

  async onModuleDestroy(): Promise<void> {
    await this.closeBrowser();
  }

  async renderToPdf(html: string): Promise<Buffer> {
    const browser = await this.getBrowser();
    const page = await browser.newPage();
    try {
      await page.setContent(html, { waitUntil: 'load' });
      const buffer = await page.pdf({
        format: 'A4',
        printBackground: true,
        margin: { top: '20px', bottom: '30px', left: '20px', right: '20px' },
        displayHeaderFooter: true,
        headerTemplate: '<div></div>',
        footerTemplate: '<div style="font-size:9px;width:100%;text-align:center;color:#777;">Page <span class="pageNumber"></span> of <span class="totalPages"></span></div>',
      });
      return Buffer.from(buffer);
    } finally {
      await page.close();
    }
  }

  /** Closes the cached browser instance, if one was launched. Call on
   * application/process shutdown (and in tests) — otherwise the headless
   * Chrome process, and any process (e.g. Jest) waiting on its handles,
   * never exits. */
  async closeBrowser(): Promise<void> {
    if (!this.browserPromise) return;
    const browser = await this.browserPromise.catch(() => null);
    this.browserPromise = null;
    await browser?.close();
  }

  private async getBrowser(): Promise<Browser> {
    if (!this.browserPromise) {
      const executablePath = this.resolveExecutablePath();
      this.browserPromise = puppeteer.launch({
        executablePath,
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
      }).catch(err => {
        this.browserPromise = null;
        throw err;
      });
    }
    return this.browserPromise;
  }

  private resolveExecutablePath(): string {
    const configured = this.config.get<string>('PUPPETEER_EXECUTABLE_PATH');
    if (configured && fs.existsSync(configured)) return configured;
    if (configured) this.logger.warn(`PUPPETEER_EXECUTABLE_PATH="${configured}" does not exist — falling back to auto-detection.`);

    const found = LOCAL_FALLBACK_PATHS.find(p => fs.existsSync(p));
    if (found) return found;

    throw new DomainException(
      'PDF_ENGINE_UNAVAILABLE',
      'No Chromium/Chrome executable found for PDF generation. Set PUPPETEER_EXECUTABLE_PATH or install Chrome locally.',
      HttpStatus.SERVICE_UNAVAILABLE,
    );
  }
}

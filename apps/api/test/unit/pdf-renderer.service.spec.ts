import { PdfRendererService } from '../../src/modules/student-reports/services/pdf-renderer.service';

jest.setTimeout(30_000);

// Exercises the real Puppeteer pipeline (not mocked) — this is the layer
// most likely to break silently (wrong executable path, missing system
// Chrome/Chromium). Uses PdfRendererService's own local-fallback path
// resolution (no PUPPETEER_EXECUTABLE_PATH set), same as a developer
// running `npm run start:dev` outside Docker.
describe('PdfRendererService', () => {
  const configStub = { get: () => undefined } as any;
  const service = new PdfRendererService(configStub);

  afterAll(async () => {
    await service.closeBrowser();
  });

  it('renders HTML to a non-empty PDF buffer with the %PDF header', async () => {
    const buffer = await service.renderToPdf('<html><body><h1>Test Report</h1><p>Hello</p></body></html>');
    expect(buffer.length).toBeGreaterThan(0);
    expect(buffer.subarray(0, 5).toString('utf-8')).toBe('%PDF-');
  });
});

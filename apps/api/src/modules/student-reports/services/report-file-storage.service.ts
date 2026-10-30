import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs/promises';
import * as path from 'path';

/**
 * Local-disk storage behind a narrow interface (save/read/delete). Nothing
 * else in this module touches `fs` directly — this is the seam a future
 * S3StorageService (implementing the same shape) would slot into, if/when
 * generation moves off the request thread. See the module plan doc for why
 * local disk (not S3) is the right call while generation stays synchronous.
 */
@Injectable()
export class ReportFileStorageService {
  private readonly logger = new Logger('ReportFileStorageService');
  private readonly rootDir: string;

  constructor(private readonly config: ConfigService) {
    this.rootDir = this.config.get<string>('STUDENT_REPORTS_STORAGE_DIR') ?? path.join(process.cwd(), 'storage', 'reports');
  }

  async save(buffer: Buffer, key: string): Promise<{ path: string; sizeBytes: number }> {
    const fullPath = path.join(this.rootDir, key);
    await fs.mkdir(path.dirname(fullPath), { recursive: true });
    await fs.writeFile(fullPath, buffer);
    return { path: key, sizeBytes: buffer.length };
  }

  async read(key: string): Promise<Buffer> {
    return fs.readFile(path.join(this.rootDir, key));
  }

  async delete(key: string): Promise<void> {
    try {
      await fs.unlink(path.join(this.rootDir, key));
    } catch (err) {
      // Best-effort — a missing file shouldn't block deleting the DB record.
      this.logger.warn(`Could not delete report file "${key}": ${(err as Error).message}`);
    }
  }
}

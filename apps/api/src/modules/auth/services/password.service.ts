import { Injectable } from '@nestjs/common';
import * as bcrypt from 'bcrypt';

@Injectable()
export class PasswordService {
  private readonly SALT_ROUNDS = 12;
  private static readonly DUMMY_HASH = '$2b$12$hQtP7vYgdWf1P7gKnSjAjOhoDxovGpnEtnWVLJKrcmdzpPuppxbxi';

  hash(password: string) { return bcrypt.hash(password, this.SALT_ROUNDS); }
  compare(password: string, hash: string) { return bcrypt.compare(password, hash); }

  /** Used for timing-attack mitigation in the unknown-email branch of login. */
  dummyCompare(password: string) { return bcrypt.compare(password, PasswordService.DUMMY_HASH); }
}

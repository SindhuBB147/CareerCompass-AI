import { HttpStatus } from '@nestjs/common';
import { DomainException } from '../../common/filters/domain.exception';

export class InvalidTwoFactorCodeException extends DomainException {
  constructor() {
    super('UNPROCESSABLE', 'That verification code is invalid or has expired.', HttpStatus.UNPROCESSABLE_ENTITY);
  }
}

export class TwoFactorNotEnabledException extends DomainException {
  constructor() {
    super('UNPROCESSABLE', 'Two-factor authentication is not enabled on this account.', HttpStatus.UNPROCESSABLE_ENTITY);
  }
}

export class TwoFactorSetupNotStartedException extends DomainException {
  constructor() {
    super('UNPROCESSABLE', 'Start two-factor setup before confirming it.', HttpStatus.UNPROCESSABLE_ENTITY);
  }
}

export class AccountLockedException extends DomainException {
  constructor(retryAfterMinutes: number) {
    super('ACCOUNT_LOCKED', `This account is temporarily locked due to too many failed attempts. Try again in ${retryAfterMinutes} minute(s).`, HttpStatus.FORBIDDEN);
  }
}

export class ReauthRequiredException extends DomainException {
  constructor() {
    super('REAUTH_REQUIRED', 'This action requires you to re-enter your password to continue.', HttpStatus.FORBIDDEN);
  }
}

export class DeviceNotFoundException extends DomainException {
  constructor() {
    super('NOT_FOUND', 'That device could not be found on your account.', HttpStatus.NOT_FOUND);
  }
}

export class PasswordReusedException extends DomainException {
  constructor() {
    super('UNPROCESSABLE', 'You cannot reuse one of your last 5 passwords.', HttpStatus.UNPROCESSABLE_ENTITY);
  }
}

export class InvalidPendingTokenException extends DomainException {
  constructor() {
    super('UNAUTHENTICATED', 'This sign-in attempt has expired. Please start over.', HttpStatus.UNAUTHORIZED);
  }
}

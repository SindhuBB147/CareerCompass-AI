import { HttpStatus } from '@nestjs/common';
import { DomainException } from '../../common/filters/domain.exception';

export class InvalidCredentialsException extends DomainException {
  constructor() {
    super('UNAUTHENTICATED', 'Email or password is incorrect.', HttpStatus.UNAUTHORIZED);
  }
}

export class AccountInactiveException extends DomainException {
  constructor() {
    super('FORBIDDEN', 'This account has been deactivated.', HttpStatus.FORBIDDEN);
  }
}

export class InvalidRefreshTokenException extends DomainException {
  constructor() {
    super('UNAUTHENTICATED', 'Refresh token is invalid, expired, or has been revoked.', HttpStatus.UNAUTHORIZED);
  }
}

export class InvalidResetTokenException extends DomainException {
  constructor() {
    super('UNPROCESSABLE', 'This reset code is invalid or has expired.', HttpStatus.UNPROCESSABLE_ENTITY);
  }
}

export class TooManyLoginAttemptsException extends DomainException {
  constructor(retryAfterSeconds: number) {
    super('RATE_LIMITED', `Too many failed login attempts. Try again in ${retryAfterSeconds} seconds.`, HttpStatus.TOO_MANY_REQUESTS);
  }
}

export class DuplicateEmailException extends DomainException {
  constructor() {
    super('CONFLICT', 'An account with this email already exists. Try signing in instead.', HttpStatus.CONFLICT);
  }
}

export class InvalidOtpException extends DomainException {
  constructor() {
    super('UNPROCESSABLE', 'This code is invalid or has expired.', HttpStatus.UNPROCESSABLE_ENTITY);
  }
}

export class TooManyOtpAttemptsException extends DomainException {
  constructor() {
    super('RATE_LIMITED', 'Too many incorrect attempts. Please request a new code.', HttpStatus.TOO_MANY_REQUESTS);
  }
}

export class WeakPasswordException extends DomainException {
  constructor() {
    super('UNPROCESSABLE', 'Password must be at least 8 characters and include an uppercase letter, a lowercase letter, and a number.', HttpStatus.UNPROCESSABLE_ENTITY);
  }
}

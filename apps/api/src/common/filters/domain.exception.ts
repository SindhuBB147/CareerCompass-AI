import { HttpException, HttpStatus } from '@nestjs/common';

/**
 * Platform-wide base exception. Every module throws a subclass of this,
 * so the global filter always receives a consistent shape regardless of
 * which module threw.
 */
export class DomainException extends HttpException {
  constructor(
    public readonly code: string,
    message: string,
    status: HttpStatus,
  ) {
    super({ code, message }, status);
  }
}

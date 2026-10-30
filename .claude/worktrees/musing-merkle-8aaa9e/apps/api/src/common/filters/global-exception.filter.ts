import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Response } from 'express';

/**
 * Registered once in main.ts via app.useGlobalFilters().
 * Every module's DomainException subclass, every class-validator
 * ValidationPipe failure, and every unexpected error arrive here and
 * leave as a consistent envelope:
 *
 *   { success: false, error: { code, message, details? }, meta: { timestamp } }
 */
@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger('GlobalExceptionFilter');

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let code = 'INTERNAL_ERROR';
    let message = 'Something went wrong. Please try again.';
    let details: Record<string, unknown> | undefined;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const body = exception.getResponse() as Record<string, unknown>;

      code = (body.code as string) ?? this.codeFromStatus(status);
      message = (body.message as string) ?? exception.message;

      // class-validator pipes report an array of field-level messages —
      // normalize that into our envelope shape.
      if (Array.isArray(body.message)) {
        message = 'Request validation failed.';
        details = { fields: body.message };
        code = 'VALIDATION_ERROR';
      }
    } else {
      this.logger.error('Unhandled exception', exception as Error);
    }

    response.status(status).json({
      success: false,
      error: { code, message, ...(details && { details }) },
      meta: { timestamp: new Date().toISOString() },
    });
  }

  private codeFromStatus(status: number): string {
    const map: Record<number, string> = {
      400: 'VALIDATION_ERROR',
      401: 'UNAUTHENTICATED',
      403: 'FORBIDDEN',
      404: 'NOT_FOUND',
      409: 'CONFLICT',
      422: 'UNPROCESSABLE',
      429: 'RATE_LIMITED',
    };
    return map[status] ?? 'INTERNAL_ERROR';
  }
}

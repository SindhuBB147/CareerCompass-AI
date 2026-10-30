import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import { AUDIT_ACTION_KEY } from '../decorators/auth.decorators';
import { SecurityAuditService } from '../../modules/security/services/security-audit.service';
import { SecurityEventAction } from '../../modules/security/models/security-event.model';

/**
 * Registered globally via APP_GUARD-style provider in AppModule. Routes
 * without @AuditAction() are untouched. Routes that declare it get a
 * SecurityEvent recorded after the handler settles — success or failure —
 * capturing actor/ip/user-agent from the request, matching the "every
 * admin/security-relevant action gets an audit record" requirement without
 * hand-writing a record() call at every call site.
 */
@Injectable()
export class SecurityAuditInterceptor implements NestInterceptor {
  constructor(
    private readonly reflector: Reflector,
    private readonly auditService: SecurityAuditService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const action = this.reflector.getAllAndOverride<SecurityEventAction | undefined>(AUDIT_ACTION_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!action) return next.handle();

    const request = context.switchToHttp().getRequest();
    const record = (result: 'success' | 'failure') => {
      const user = request.user;
      if (!user) return;
      this.auditService.record({
        actorId: user.sub,
        actorType: user.role === 'student' ? 'student' : 'admin',
        actorEmail: user.email,
        action,
        resourceId: request.params?.id ?? request.params?.userId ?? undefined,
        result,
        ip: request.ip,
        userAgent: request.headers?.['user-agent'],
      }).catch(() => undefined);
    };

    return next.handle().pipe(
      tap(() => record('success')),
      catchError(err => { record('failure'); throw err; }),
    );
  }
}

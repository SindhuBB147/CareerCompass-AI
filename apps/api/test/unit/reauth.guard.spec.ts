import { Reflector } from '@nestjs/core';
import { ReauthGuard } from '../../src/modules/security/guards/reauth.guard';
import { ReauthRequiredException } from '../../src/modules/security/security.exceptions';

describe('ReauthGuard', () => {
  let tokenServiceMock: any;
  let reflector: Reflector;
  let guard: ReauthGuard;

  const makeContext = (headers: Record<string, string>, user?: any) => ({
    getHandler: () => ({}),
    getClass: () => ({}),
    switchToHttp: () => ({ getRequest: () => ({ headers, user }) }),
  } as any);

  beforeEach(() => {
    tokenServiceMock = { verifyReauthToken: jest.fn() };
    reflector = new Reflector();
    guard = new ReauthGuard(reflector, tokenServiceMock);
  });

  it('allows the request through when the route has no @RequireReauth()', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(false);
    expect(guard.canActivate(makeContext({}))).toBe(true);
  });

  it('blocks the request when reauth is required but no token header is present', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(true);
    expect(() => guard.canActivate(makeContext({}, { sub: 'admin_1' }))).toThrow(ReauthRequiredException);
  });

  it('blocks the request when the reauth token belongs to a different user', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(true);
    tokenServiceMock.verifyReauthToken.mockReturnValue({ sub: 'someone_else', purpose: 'reauth' });
    expect(() => guard.canActivate(makeContext({ 'x-reauth-token': 'tok' }, { sub: 'admin_1' }))).toThrow(ReauthRequiredException);
  });

  it('blocks the request when the reauth token is invalid or expired', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(true);
    tokenServiceMock.verifyReauthToken.mockImplementation(() => { throw new Error('jwt expired'); });
    expect(() => guard.canActivate(makeContext({ 'x-reauth-token': 'tok' }, { sub: 'admin_1' }))).toThrow(ReauthRequiredException);
  });

  it('allows the request when the reauth token matches the authenticated caller', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(true);
    tokenServiceMock.verifyReauthToken.mockReturnValue({ sub: 'admin_1', purpose: 'reauth' });
    expect(guard.canActivate(makeContext({ 'x-reauth-token': 'tok' }, { sub: 'admin_1' }))).toBe(true);
  });
});

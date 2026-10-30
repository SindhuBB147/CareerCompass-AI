import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp, uniqueStudent } from './test-app.helper';

describe('Student auth (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it('registers, logs in, refreshes, and logs out — the full session lifecycle', async () => {
    const student = uniqueStudent();

    const registerRes = await request(app.getHttpServer()).post('/api/v1/auth/student/register').send(student);
    expect(registerRes.status).toBe(201);
    expect(registerRes.body.success).toBe(true);
    expect(registerRes.body.data.tokens.accessToken).toEqual(expect.any(String));
    expect(registerRes.body.data.user.email).toBe(student.email);

    const loginRes = await request(app.getHttpServer())
      .post('/api/v1/auth/student/login')
      .send({ email: student.email, password: student.password });
    expect(loginRes.status).toBe(200);
    const { accessToken, refreshToken } = loginRes.body.data.tokens;
    expect(accessToken).toEqual(expect.any(String));

    const refreshRes = await request(app.getHttpServer())
      .post('/api/v1/auth/student/refresh')
      .send({ refreshToken });
    expect(refreshRes.status).toBe(200);
    expect(refreshRes.body.data.accessToken).toEqual(expect.any(String));

    const logoutRes = await request(app.getHttpServer())
      .post('/api/v1/auth/student/logout')
      .set('Authorization', `Bearer ${refreshRes.body.data.accessToken}`)
      .send({ refreshToken: refreshRes.body.data.refreshToken });
    expect(logoutRes.status).toBe(200);
    expect(logoutRes.body.data.loggedOut).toBe(true);
  });

  it('rejects login with the wrong password', async () => {
    const student = uniqueStudent();
    await request(app.getHttpServer()).post('/api/v1/auth/student/register').send(student);

    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/student/login')
      .send({ email: student.email, password: 'WrongPassword1!' });
    expect(res.status).toBe(401);
  });

  // Regression coverage for the OAuth security fix: /oauth/:provider used to
  // trust whatever email/providerId a client sent, for any of the 5
  // declared providers. It now only serves Google (with real ID-token
  // verification), and rejects the rest outright instead of logging
  // someone in from unverified input.
  describe('OAuth provider gating', () => {
    it('returns 501 for a non-Google provider instead of accepting client-asserted identity', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/oauth/microsoft')
        .send({ provider: 'microsoft', idTokenTokenOrCode: 'anything', email: 'victim@example.com', name: 'Attacker' });
      expect(res.status).toBe(501);
      expect(res.body.success).toBe(false);
    });

    it('returns a clean error for Google when no GOOGLE_CLIENT_ID is configured, rather than accepting the token unverified', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/oauth/google')
        .send({ provider: 'google', idTokenTokenOrCode: 'some-id-token' });
      expect(res.status).toBe(503);
      expect(res.body.success).toBe(false);
    });
  });
});

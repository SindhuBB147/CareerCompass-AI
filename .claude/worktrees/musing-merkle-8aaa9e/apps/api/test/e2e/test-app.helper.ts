import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AppModule } from '../../src/app.module';
import { GlobalExceptionFilter } from '../../src/common/filters/global-exception.filter';

/**
 * Boots the real AppModule end to end — same global pipes/filters as
 * main.ts (minus helmet/CORS, irrelevant to supertest) — against an
 * isolated in-memory MongoDB. DatabaseModule already falls back to
 * mongodb-memory-server whenever MONGO_URI is unset (see
 * src/database/database.module.ts), so we deliberately leave it unset
 * here rather than standing up a second Mongo instance ourselves.
 */
export async function createTestApp(): Promise<INestApplication> {
  process.env.JWT_ACCESS_SECRET ??= 'e2e_test_access_secret_key_1234567890_super_secret';
  process.env.JWT_REFRESH_SECRET ??= 'e2e_test_refresh_secret_key_1234567890_super_secret';
  process.env.SECURITY_ENCRYPTION_KEY ??= '0'.repeat(64);
  process.env.AI_SERVICE_URL ??= 'http://localhost:8000';
  process.env.AI_SERVICE_INTERNAL_TOKEN ??= 'e2e-test-shared-secret';
  delete process.env.GOOGLE_CLIENT_ID; // exercised explicitly as the "not configured" case

  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app = moduleRef.createNestApplication();
  app.setGlobalPrefix('api/v1');
  app.useGlobalFilters(new GlobalExceptionFilter());
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true, forbidNonWhitelisted: false, transform: true,
    transformOptions: { enableImplicitConversion: true },
  }));
  await app.init();
  return app;
}

let counter = 0;
/** A fresh, valid registration payload each call — unique email per test run. */
export function uniqueStudent() {
  counter += 1;
  return {
    fullName: 'E2E Test Student',
    email: `e2e.student.${Date.now()}.${counter}@example.com`,
    password: 'Passw0rd!123',
    confirmPassword: 'Passw0rd!123',
    acceptTerms: true,
  };
}

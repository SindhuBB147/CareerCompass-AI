import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Secure HTTP headers (CSP, HSTS, X-Frame-Options, etc.) — OWASP baseline.
  app.use(helmet());

  // Every request goes through the global prefix /api/v1
  app.setGlobalPrefix('api/v1');

  // Global exception filter — converts every error into the standard envelope
  app.useGlobalFilters(new GlobalExceptionFilter());

  // Global validation pipe — strips unknown fields, transforms DTOs
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,       // strips unknown fields from every request body
      forbidNonWhitelisted: false, // allows unknown query params (e.g., page/limit)
      transform: true,       // converts plain objects to DTO class instances
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  // CORS — tighten in production to actual allowed origins
  app.enableCors({
    origin: process.env.CORS_ORIGIN ?? '*',
    methods: ['GET', 'POST', 'PATCH', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  const port = process.env.PORT ?? 3000;
  await app.listen(port);
  console.log(`CareerCompass AI API running on port ${port}`);
}

bootstrap();

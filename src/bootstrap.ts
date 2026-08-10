import { NestFactory } from '@nestjs/core';
import { ValidationPipe, VersioningType, Logger } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import helmet from 'helmet';
import * as compression from 'compression';
import * as cookieParser from 'cookie-parser';
import * as express from 'express';
import * as path from 'path';

export async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const allowedOrigins = process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(',').map((o) => o.trim())
    : true;

  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    cors: {
      origin: allowedOrigins,
      credentials: true,
    },
  });

  // Security Headers
  app.use(
    helmet({
      contentSecurityPolicy: false, // Allowed for Swagger UI
    }),
  );

  app.use(compression());
  app.use(cookieParser(process.env.COOKIE_SECRET));

  app.use('/uploads', express.static(path.join(process.cwd(), 'public', 'uploads')));

  const apiPrefix = process.env.API_PREFIX || 'api';
  app.setGlobalPrefix(apiPrefix, {
    exclude: ['/', '/api', '/api/v1'],
  });

  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: '1',
  });

  // Global Validation Pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  // Swagger OpenAPI Setup
  const swaggerConfig = new DocumentBuilder()
    .setTitle('BOM ServiceHub Backend API')
    .setDescription(
      'Enterprise IT Helpdesk & Ticketing System API Documentation with Department, Category, Subcategory hierarchy, Auto Assignment, SLA TAT calculation, Escalation, and Email workflows.',
    )
    .setVersion('1.0')
    .addBearerAuth()
    .addTag('Auth')
    .addTag('Users')
    .addTag('Departments')
    .addTag('Categories')
    .addTag('Subcategories')
    .addTag('Tickets')
    .addTag('Reports')
    .addTag('Uploads')
    .addTag('Health')
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup(`${apiPrefix}/docs`, app, document);

  const port = process.env.PORT || 5000;
  await app.listen(port);

  const env = process.env.NODE_ENV || 'development';
  logger.log(`================================================================`);
  logger.log(`🚀 BOM ServiceHub API Engine Started Successfully!`);
  logger.log(`================================================================`);
  logger.log(` ➔ Environment    : ${env}`);
  logger.log(` ➔ Server Port    : ${port}`);
  logger.log(` ➔ Root Landing   : http://localhost:${port}`);
  logger.log(` ➔ API Base URL   : http://localhost:${port}/${apiPrefix}`);
  logger.log(` ➔ API Version 1  : http://localhost:${port}/${apiPrefix}/v1`);
  logger.log(` ➔ Swagger Docs   : http://localhost:${port}/${apiPrefix}/docs`);
  logger.log(` ➔ Health Endpoint: http://localhost:${port}/${apiPrefix}/v1/health`);
  logger.log(`================================================================`);
  return app;
}

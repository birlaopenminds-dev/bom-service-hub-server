import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER, APP_INTERCEPTOR, APP_GUARD } from '@nestjs/core';
import configuration from './config/configuration';
import databaseConfig from './config/database.config';
import jwtConfig from './config/jwt.config';
import emailConfig from './config/email.config';
import storageConfig from './config/storage.config';
import loggingConfig from './config/logging.config';
import rateLimitConfig from './config/rate-limit.config';

import { AppController } from './app.controller';
import { AppService } from './app.service';

import { DatabaseModule } from './providers/database/database.provider';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { DepartmentsModule } from './modules/departments/departments.module';
import { CategoriesModule } from './modules/categories/categories.module';
import { SubcategoriesModule } from './modules/subcategories/subcategories.module';
import { TicketsModule } from './modules/tickets/tickets.module';
import { TicketLogsModule } from './modules/ticket-logs/ticket-logs.module';
import { TicketAttachmentsModule } from './modules/ticket-attachments/ticket-attachments.module';
import { AuditModule } from './modules/audit/audit.module';
import { MailModule } from './modules/mail/mail.module';
import { ReportsModule } from './modules/reports/reports.module';
import { UploadsModule } from './modules/uploads/uploads.module';
import { CronModule } from './modules/cron/cron.module';

import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { DatabaseExceptionFilter } from './common/filters/database-exception.filter';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { TimeoutInterceptor } from './common/interceptors/timeout.interceptor';
import { RateLimitGuard } from './common/guards/rate-limit.guard';

import { LoggerMiddleware } from './common/middleware/logger.middleware';
import { CorrelationIdMiddleware } from './common/middleware/correlation-id.middleware';
import { SecurityHeadersMiddleware } from './common/middleware/security-headers.middleware';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [
        configuration,
        databaseConfig,
        jwtConfig,
        emailConfig,
        storageConfig,
        loggingConfig,
        rateLimitConfig,
      ],
    }),
    DatabaseModule,
    AuthModule,
    UsersModule,
    DepartmentsModule,
    CategoriesModule,
    SubcategoriesModule,
    TicketsModule,
    TicketLogsModule,
    TicketAttachmentsModule,
    AuditModule,
    MailModule,
    ReportsModule,
    UploadsModule,
    CronModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_FILTER,
      useClass: HttpExceptionFilter,
    },
    {
      provide: APP_FILTER,
      useClass: DatabaseExceptionFilter,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: TransformInterceptor,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: TimeoutInterceptor,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: LoggingInterceptor,
    },
    // {
    //   provide: APP_GUARD,
    //   useClass: RateLimitGuard,
    // },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(
        CorrelationIdMiddleware,
        LoggerMiddleware,
        SecurityHeadersMiddleware,
      )
      .forRoutes('*');
  }
}

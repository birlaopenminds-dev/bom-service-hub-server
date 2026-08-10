import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpStatus,
  Logger,
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { Request, Response } from "express";

@Catch(Prisma.PrismaClientKnownRequestError)
export class DatabaseExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(DatabaseExceptionFilter.name);

  catch(exception: Prisma.PrismaClientKnownRequestError, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'A database error occurred while processing your request. Please try again.';
    let errorTitle = 'Database Error';

    switch (exception.code) {
      case 'P2002': {
        status = HttpStatus.CONFLICT;
        errorTitle = 'Duplicate Record Violation';
        const target = (exception.meta?.target as string[]) || [];
        const fieldName = target.length > 0 ? target.join(', ') : 'value';
        message = `A record with this ${fieldName} already exists in the system. Please use a unique value.`;
        break;
      }
      case 'P2025': {
        status = HttpStatus.NOT_FOUND;
        errorTitle = 'Record Not Found';
        message = 'The requested record or resource could not be found.';
        break;
      }
      case 'P2003': {
        status = HttpStatus.BAD_REQUEST;
        errorTitle = 'Dependency Constraint Failed';
        message = 'Cannot complete operation due to dependent record relationships. Please check related data.';
        break;
      }
      default:
        message = 'A database error occurred while processing your request. Please try again.';
    }

    this.logger.error(`Database Exception [${exception.code}]: ${message}`);

    response.status(status).json({
      success: false,
      statusCode: status,
      message,
      error: errorTitle,
      path: request.originalUrl || request.url,
      timestamp: new Date().toISOString(),
    });
  }
}

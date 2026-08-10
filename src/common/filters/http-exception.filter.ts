import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const exceptionResponse: any =
      exception instanceof HttpException
        ? exception.getResponse()
        : { message: 'An unexpected internal server error occurred. Please try again later.' };

    const message =
      typeof exceptionResponse === 'object' && exceptionResponse.message
        ? Array.isArray(exceptionResponse.message)
          ? exceptionResponse.message.join(', ')
          : exceptionResponse.message
        : exceptionResponse || 'An unexpected error occurred';

    this.logger.error(
      `[${request.method}] ${request.url} - Status: ${status} - Error: ${message}`,
      exception instanceof Error ? exception.stack : '',
    );

    const errorTitle =
      typeof exceptionResponse === 'object' && exceptionResponse.error
        ? exceptionResponse.error
        : status === HttpStatus.UNAUTHORIZED
        ? 'Unauthorized Access'
        : status === HttpStatus.FORBIDDEN
        ? 'Access Forbidden'
        : status === HttpStatus.NOT_FOUND
        ? 'Resource Not Found'
        : status === HttpStatus.BAD_REQUEST
        ? 'Invalid Request Data'
        : status === HttpStatus.TOO_MANY_REQUESTS
        ? 'Too Many Requests'
        : status === HttpStatus.REQUEST_TIMEOUT
        ? 'Request Timeout'
        : 'Internal Server Error';

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

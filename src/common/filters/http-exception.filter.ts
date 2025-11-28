import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { ApiErrorResponse } from '../dto/response.dto';

@Catch(HttpException)
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: HttpException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const status = exception.getStatus();
    const exceptionResponse = exception.getResponse();

    let code = 'HTTP_ERROR';
    let message = exception.message;
    let details: any[] | undefined;

    if (typeof exceptionResponse === 'object' && exceptionResponse !== null) {
      const res = exceptionResponse as any;
      code = res.code || res.error || 'HTTP_ERROR';
      message = res.message || exception.message;
      details = res.details || res.errors;

      // Handle class-validator errors
      if (Array.isArray(res.message)) {
        details = res.message.map((msg: string) => ({ message: msg }));
        message = '입력값 검증에 실패했습니다.';
        code = 'VALIDATION_ERROR';
      }
    }

    const errorResponse = new ApiErrorResponse(code, message, details);

    this.logger.warn(
      `HTTP ${status} ${request.method} ${request.url} - ${message}`,
      {
        statusCode: status,
        path: request.url,
        method: request.method,
        code,
        details,
      },
    );

    response.status(status).json(errorResponse);
  }
}

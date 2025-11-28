import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Response } from 'express';
import { ApiErrorResponse } from '../dto/response.dto';

@Catch(Prisma.PrismaClientKnownRequestError)
export class PrismaExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(PrismaExceptionFilter.name);

  catch(exception: Prisma.PrismaClientKnownRequestError, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let code = 'DATABASE_ERROR';
    let message = '데이터베이스 오류가 발생했습니다.';

    switch (exception.code) {
      case 'P2002':
        // Unique constraint violation
        status = HttpStatus.CONFLICT;
        code = 'UNIQUE_CONSTRAINT';
        const target = (exception.meta?.target as string[])?.join(', ') || 'field';
        message = `이미 존재하는 ${target} 값입니다.`;
        break;

      case 'P2003':
        // Foreign key constraint violation
        status = HttpStatus.BAD_REQUEST;
        code = 'FOREIGN_KEY_CONSTRAINT';
        message = '참조하는 데이터가 존재하지 않습니다.';
        break;

      case 'P2025':
        // Record not found
        status = HttpStatus.NOT_FOUND;
        code = 'NOT_FOUND';
        message = '요청한 데이터를 찾을 수 없습니다.';
        break;

      default:
        this.logger.error(
          `Prisma Error ${exception.code}: ${exception.message}`,
          exception.stack,
        );
    }

    const errorResponse = new ApiErrorResponse(code, message);
    response.status(status).json(errorResponse);
  }
}

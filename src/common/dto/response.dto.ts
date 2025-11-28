import { PaginationMeta } from './pagination.dto';

export class ApiResponse<T> {
  success: boolean;
  data: T;
  meta?: {
    timestamp: string;
    [key: string]: any;
  };

  constructor(data: T, additionalMeta?: Record<string, any>) {
    this.success = true;
    this.data = data;
    this.meta = {
      timestamp: new Date().toISOString(),
      ...additionalMeta,
    };
  }

  static success<T>(data: T, additionalMeta?: Record<string, any>): ApiResponse<T> {
    return new ApiResponse(data, additionalMeta);
  }

  static paginated<T>(
    data: T[],
    pagination: PaginationMeta,
  ): ApiResponse<T[]> {
    return new ApiResponse(data, {
      page: pagination.page,
      limit: pagination.limit,
      total: pagination.total,
      totalPages: pagination.totalPages,
    });
  }
}

export class ApiErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: any[];
  };

  constructor(code: string, message: string, details?: any[]) {
    this.success = false;
    this.error = {
      code,
      message,
      details,
    };
  }
}

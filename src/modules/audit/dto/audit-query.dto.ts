import {
  IsOptional,
  IsUUID,
  IsInt,
  Min,
  Max,
  IsString,
  IsEnum,
  IsDateString,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

/**
 * 감사 로그 조회 쿼리 DTO
 *
 * 감사 로그 목록 조회 시 필터링, 정렬, 페이지네이션에 사용됩니다.
 */
export class AuditQueryDto {
  /**
   * 사용자 필터
   */
  @ApiPropertyOptional({
    description: '특정 사용자의 활동만 조회',
    format: 'uuid',
  })
  @IsOptional()
  @IsUUID()
  userId?: string;

  /**
   * 액션 필터
   */
  @ApiPropertyOptional({
    description: '특정 액션만 조회 (예: CREATE, UPDATE, DELETE)',
    example: 'CREATE',
  })
  @IsOptional()
  @IsString()
  action?: string;

  /**
   * 엔티티 유형 필터
   */
  @ApiPropertyOptional({
    description: '특정 엔티티 유형만 조회 (예: USER, TASK, TEAM)',
    example: 'TASK',
  })
  @IsOptional()
  @IsString()
  entityType?: string;

  /**
   * 엔티티 ID 필터
   */
  @ApiPropertyOptional({
    description: '특정 엔티티 ID의 로그만 조회',
  })
  @IsOptional()
  @IsString()
  entityId?: string;

  /**
   * 시작일 필터
   */
  @ApiPropertyOptional({
    description: '조회 시작일 (ISO 8601)',
    format: 'date-time',
  })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  /**
   * 종료일 필터
   */
  @ApiPropertyOptional({
    description: '조회 종료일 (ISO 8601)',
    format: 'date-time',
  })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  /**
   * 페이지 번호
   */
  @ApiPropertyOptional({
    description: '페이지 번호',
    default: 1,
  })
  @IsOptional()
  @Transform(({ value }) => parseInt(value, 10))
  @IsInt()
  @Min(1)
  page?: number = 1;

  /**
   * 페이지당 항목 수
   */
  @ApiPropertyOptional({
    description: '페이지당 항목 수',
    default: 20,
  })
  @IsOptional()
  @Transform(({ value }) => parseInt(value, 10))
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  /**
   * 정렬 기준
   */
  @ApiPropertyOptional({
    description: '정렬 기준 필드',
    default: 'createdAt',
  })
  @IsOptional()
  @IsString()
  sortBy?: string = 'createdAt';

  /**
   * 정렬 방향
   */
  @ApiPropertyOptional({
    description: '정렬 방향',
    enum: ['asc', 'desc'],
    default: 'desc',
  })
  @IsOptional()
  @IsEnum(['asc', 'desc'])
  sortOrder?: 'asc' | 'desc' = 'desc';
}

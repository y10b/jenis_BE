import {
  IsOptional,
  IsEnum,
  IsUUID,
  IsInt,
  Min,
  Max,
  IsString,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { TaskStatus, TaskPriority } from '@prisma/client';

/**
 * 업무 조회 쿼리 DTO
 *
 * 업무 목록 조회 시 필터링, 정렬, 페이지네이션에 사용되는 쿼리 파라미터입니다.
 *
 * @example
 * GET /api/v1/tasks?status=TODO&priority=HIGH&page=1&limit=20
 */
export class TaskQueryDto {
  /**
   * 상태 필터
   */
  @ApiPropertyOptional({
    description: '업무 상태로 필터링',
    enum: TaskStatus,
    example: 'TODO',
  })
  @IsOptional()
  @IsEnum(TaskStatus)
  status?: TaskStatus;

  /**
   * 우선순위 필터
   */
  @ApiPropertyOptional({
    description: '우선순위로 필터링',
    enum: TaskPriority,
    example: 'HIGH',
  })
  @IsOptional()
  @IsEnum(TaskPriority)
  priority?: TaskPriority;

  /**
   * 담당자 필터
   */
  @ApiPropertyOptional({
    description: '담당자 UUID로 필터링',
    format: 'uuid',
  })
  @IsOptional()
  @IsUUID()
  assigneeId?: string;

  /**
   * 팀 필터
   */
  @ApiPropertyOptional({
    description: '팀 UUID로 필터링',
    format: 'uuid',
  })
  @IsOptional()
  @IsUUID()
  teamId?: string;

  /**
   * 생성자 필터
   */
  @ApiPropertyOptional({
    description: '생성자 UUID로 필터링',
    format: 'uuid',
  })
  @IsOptional()
  @IsUUID()
  creatorId?: string;

  /**
   * 검색어 (제목, 설명 검색)
   */
  @ApiPropertyOptional({
    description: '제목 및 설명에서 검색',
    example: 'API',
  })
  @IsOptional()
  @IsString()
  search?: string;

  /**
   * 페이지 번호
   */
  @ApiPropertyOptional({
    description: '페이지 번호',
    example: 1,
    default: 1,
    minimum: 1,
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
    example: 20,
    default: 20,
    minimum: 1,
    maximum: 100,
  })
  @IsOptional()
  @Transform(({ value }) => parseInt(value, 10))
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  /**
   * 정렬 기준 필드
   */
  @ApiPropertyOptional({
    description: '정렬 기준 필드',
    example: 'createdAt',
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

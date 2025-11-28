import {
  IsOptional,
  IsEnum,
  IsUUID,
  IsInt,
  Min,
  Max,
  IsString,
  IsBoolean,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { ScheduleType } from '@prisma/client';

/**
 * 스케줄 조회 쿼리 DTO
 *
 * 스케줄 목록 조회 시 필터링, 정렬, 페이지네이션에 사용됩니다.
 */
export class ScheduleQueryDto {
  /**
   * 스케줄 유형 필터
   */
  @ApiPropertyOptional({
    description: '스케줄 유형으로 필터링',
    enum: ScheduleType,
  })
  @IsOptional()
  @IsEnum(ScheduleType)
  type?: ScheduleType;

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
   * 활성화 상태 필터
   */
  @ApiPropertyOptional({
    description: '활성화 상태로 필터링',
    example: true,
  })
  @IsOptional()
  @Transform(({ value }) => value === 'true')
  @IsBoolean()
  isActive?: boolean;

  /**
   * 검색어
   */
  @ApiPropertyOptional({
    description: '제목 및 설명에서 검색',
  })
  @IsOptional()
  @IsString()
  search?: string;

  /**
   * 페이지 번호
   */
  @ApiPropertyOptional({
    description: '페이지 번호',
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

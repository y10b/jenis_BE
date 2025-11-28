import {
  IsOptional,
  IsEnum,
  IsBoolean,
  IsInt,
  Min,
  Max,
  IsDateString,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { RetroType, Visibility } from '@prisma/client';

/**
 * 회고 조회 쿼리 DTO
 *
 * 회고 목록을 필터링하고 페이징하기 위한 쿼리 파라미터입니다.
 */
export class RetrospectiveQueryDto {
  /**
   * 회고 유형 필터
   */
  @ApiPropertyOptional({
    description: '회고 유형으로 필터링',
    enum: RetroType,
    example: 'WEEKLY',
    enumName: 'RetroType',
  })
  @IsOptional()
  @IsEnum(RetroType)
  type?: RetroType;

  /**
   * 공개 범위 필터
   */
  @ApiPropertyOptional({
    description: '공개 범위로 필터링',
    enum: Visibility,
    example: 'TEAM',
    enumName: 'Visibility',
  })
  @IsOptional()
  @IsEnum(Visibility)
  visibility?: Visibility;

  /**
   * 임시저장 여부 필터
   */
  @ApiPropertyOptional({
    description: '임시저장 상태로 필터링. true: 임시저장만, false: 발행된 것만',
    example: false,
  })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  isDraft?: boolean;

  /**
   * 회고 기간 시작일 범위 (시작)
   */
  @ApiPropertyOptional({
    description: '회고 기간 시작일이 이 날짜 이후인 것만 조회',
    example: '2024-01-01',
    format: 'date',
  })
  @IsOptional()
  @IsDateString()
  periodStartFrom?: string;

  /**
   * 회고 기간 시작일 범위 (종료)
   */
  @ApiPropertyOptional({
    description: '회고 기간 시작일이 이 날짜 이전인 것만 조회',
    example: '2024-12-31',
    format: 'date',
  })
  @IsOptional()
  @IsDateString()
  periodStartTo?: string;

  /**
   * 페이지 번호
   */
  @ApiPropertyOptional({
    description: '페이지 번호 (1부터 시작)',
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
}

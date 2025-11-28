import {
  IsString,
  IsOptional,
  IsEnum,
  IsBoolean,
  IsDateString,
  MaxLength,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { RetroType, Visibility } from '@prisma/client';

/**
 * 회고 수정 DTO
 *
 * 기존 회고를 수정할 때 사용합니다.
 * 모든 필드는 선택적이며, 제공된 필드만 업데이트됩니다.
 */
export class UpdateRetrospectiveDto {
  /**
   * 변경할 회고 유형
   */
  @ApiPropertyOptional({
    description: '변경할 회고 유형',
    enum: RetroType,
    example: 'MONTHLY',
    enumName: 'RetroType',
  })
  @IsOptional()
  @IsEnum(RetroType)
  type?: RetroType;

  /**
   * 변경할 회고 제목
   */
  @ApiPropertyOptional({
    description: '변경할 회고 제목',
    example: '2024년 1월 회고 (수정)',
    maxLength: 200,
  })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  title?: string;

  /**
   * 변경할 회고 내용
   */
  @ApiPropertyOptional({
    description: '변경할 회고 본문 내용',
    example: '수정된 회고 내용...',
    maxLength: 10000,
  })
  @IsOptional()
  @IsString()
  @MaxLength(10000)
  content?: string;

  /**
   * 변경할 회고 기간 시작일
   */
  @ApiPropertyOptional({
    description: '변경할 회고 기간 시작 날짜',
    example: '2024-01-01',
    format: 'date',
  })
  @IsOptional()
  @IsDateString()
  periodStart?: string;

  /**
   * 변경할 회고 기간 종료일
   */
  @ApiPropertyOptional({
    description: '변경할 회고 기간 종료 날짜',
    example: '2024-01-31',
    format: 'date',
  })
  @IsOptional()
  @IsDateString()
  periodEnd?: string;

  /**
   * 변경할 임시저장 여부
   */
  @ApiPropertyOptional({
    description: '변경할 임시저장 상태',
    example: false,
  })
  @IsOptional()
  @IsBoolean()
  isDraft?: boolean;

  /**
   * 변경할 공개 범위
   */
  @ApiPropertyOptional({
    description: '변경할 공개 범위',
    enum: Visibility,
    example: 'PUBLIC',
    enumName: 'Visibility',
  })
  @IsOptional()
  @IsEnum(Visibility)
  visibility?: Visibility;
}

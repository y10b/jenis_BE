import {
  IsString,
  IsOptional,
  IsEnum,
  IsBoolean,
  IsDateString,
  IsArray,
  IsUUID,
  IsObject,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { ScheduleType } from '@prisma/client';

/**
 * 스케줄 수정 DTO
 *
 * 기존 스케줄을 수정할 때 사용합니다.
 * 모든 필드는 선택적이며, 제공된 필드만 업데이트됩니다.
 */
export class UpdateScheduleDto {
  /**
   * 변경할 스케줄 유형
   */
  @ApiPropertyOptional({
    description: '변경할 스케줄 유형',
    enum: ScheduleType,
  })
  @IsOptional()
  @IsEnum(ScheduleType)
  type?: ScheduleType;

  /**
   * 변경할 제목
   */
  @ApiPropertyOptional({
    description: '변경할 스케줄 제목',
    example: '수정된 회의 제목',
  })
  @IsOptional()
  @IsString()
  title?: string;

  /**
   * 변경할 설명
   */
  @ApiPropertyOptional({
    description: '변경할 스케줄 설명',
  })
  @IsOptional()
  @IsString()
  description?: string;

  /**
   * 변경할 Cron 표현식
   */
  @ApiPropertyOptional({
    description: '변경할 Cron 표현식',
    example: '0 14 * * 5',
  })
  @IsOptional()
  @IsString()
  cronExpression?: string;

  /**
   * 변경할 예정 일시
   */
  @ApiPropertyOptional({
    description: '변경할 예정 일시',
    format: 'date-time',
  })
  @IsOptional()
  @IsDateString()
  scheduledAt?: string;

  /**
   * 변경할 추가 설정
   */
  @ApiPropertyOptional({
    description: '변경할 추가 설정',
  })
  @IsOptional()
  @IsObject()
  config?: Record<string, any>;

  /**
   * 변경할 활성화 상태
   */
  @ApiPropertyOptional({
    description: '변경할 활성화 상태',
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  /**
   * 변경할 연관 팀 목록
   */
  @ApiPropertyOptional({
    description: '변경할 연관 팀 UUID 목록',
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  teamIds?: string[];
}

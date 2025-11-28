import {
  IsString,
  IsOptional,
  IsEnum,
  IsBoolean,
  IsDateString,
  IsArray,
  IsUUID,
  IsObject,
  ValidateIf,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ScheduleType } from '@prisma/client';

/**
 * 스케줄 생성 DTO
 *
 * 새로운 스케줄(회의, 리마인더, 리포트 등)을 생성할 때 사용합니다.
 * 반복 스케줄은 cronExpression, 일회성은 scheduledAt을 사용합니다.
 *
 * @example
 * ```json
 * {
 *   "type": "MEETING",
 *   "title": "주간 스프린트 회의",
 *   "description": "매주 월요일 진행",
 *   "cronExpression": "0 10 * * 1",
 *   "isActive": true,
 *   "teamIds": ["team-uuid"]
 * }
 * ```
 */
export class CreateScheduleDto {
  /**
   * 스케줄 유형
   * - MEETING: 회의
   * - REMINDER: 리마인더/알림
   * - REPORT: 정기 리포트
   */
  @ApiProperty({
    description: '스케줄 유형',
    enum: ScheduleType,
    example: 'MEETING',
  })
  @IsEnum(ScheduleType)
  type: ScheduleType;

  /**
   * 스케줄 제목
   */
  @ApiProperty({
    description: '스케줄 제목',
    example: '주간 스프린트 회의',
  })
  @IsString()
  title: string;

  /**
   * 스케줄 상세 설명
   */
  @ApiPropertyOptional({
    description: '스케줄에 대한 상세 설명',
    example: '매주 월요일 오전 10시 진행되는 스프린트 계획 회의',
  })
  @IsOptional()
  @IsString()
  description?: string;

  /**
   * Cron 표현식 (반복 스케줄용)
   * 예: "0 10 * * 1" = 매주 월요일 10시
   */
  @ApiPropertyOptional({
    description: 'Cron 표현식. 반복 스케줄 시 사용. 예: "0 10 * * 1" (매주 월요일 10시)',
    example: '0 10 * * 1',
  })
  @IsOptional()
  @ValidateIf((o) => !o.scheduledAt)
  @IsString()
  cronExpression?: string;

  /**
   * 예정 일시 (일회성 스케줄용)
   */
  @ApiPropertyOptional({
    description: '일회성 스케줄의 예정 일시. ISO 8601 형식',
    example: '2024-12-31T10:00:00Z',
    format: 'date-time',
  })
  @IsOptional()
  @ValidateIf((o) => !o.cronExpression)
  @IsDateString()
  scheduledAt?: string;

  /**
   * 추가 설정 (JSON)
   */
  @ApiPropertyOptional({
    description: '스케줄별 추가 설정. JSON 형식',
    example: { location: '회의실 A', zoomLink: 'https://zoom.us/...' },
  })
  @IsOptional()
  @IsObject()
  config?: Record<string, any>;

  /**
   * 활성화 여부
   */
  @ApiPropertyOptional({
    description: '스케줄 활성화 여부. 비활성화 시 실행되지 않음',
    example: true,
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  /**
   * 연관 팀 ID 목록
   */
  @ApiPropertyOptional({
    description: '스케줄과 연관된 팀 UUID 목록',
    example: ['team-uuid-1', 'team-uuid-2'],
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  teamIds?: string[];
}

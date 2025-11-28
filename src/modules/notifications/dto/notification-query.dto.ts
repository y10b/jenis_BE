import { IsOptional, IsBoolean, IsInt, Min, Max, IsString } from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

/**
 * 알림 조회 쿼리 DTO
 *
 * 알림 목록 조회 시 필터링 및 페이지네이션에 사용됩니다.
 */
export class NotificationQueryDto {
  /**
   * 읽지 않은 알림만 조회
   */
  @ApiPropertyOptional({
    description: 'true로 설정 시 읽지 않은 알림만 조회',
    example: true,
  })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  unreadOnly?: boolean;

  /**
   * 알림 유형 필터
   */
  @ApiPropertyOptional({
    description: '알림 유형으로 필터링 (예: TASK_ASSIGNED, COMMENT_ADDED)',
    example: 'TASK_ASSIGNED',
  })
  @IsOptional()
  @IsString()
  type?: string;

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
}

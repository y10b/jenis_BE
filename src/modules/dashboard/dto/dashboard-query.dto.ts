import { IsOptional, IsString, IsDateString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

/**
 * 대시보드 조회 쿼리 DTO
 *
 * 대시보드 데이터를 필터링하기 위한 쿼리 파라미터입니다.
 * 팀별, 기간별로 데이터를 조회할 수 있습니다.
 */
export class DashboardQueryDto {
  /**
   * 팀 ID (선택)
   * 특정 팀의 데이터만 조회할 때 사용
   */
  @ApiPropertyOptional({
    description: '필터링할 팀 UUID. 미지정 시 접근 가능한 모든 팀 데이터 조회',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsOptional()
  @IsString()
  teamId?: string;

  /**
   * 조회 시작일 (선택)
   */
  @ApiPropertyOptional({
    description: '조회 시작 날짜 (ISO 8601 형식)',
    example: '2024-01-01',
    format: 'date',
  })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  /**
   * 조회 종료일 (선택)
   */
  @ApiPropertyOptional({
    description: '조회 종료 날짜 (ISO 8601 형식)',
    example: '2024-12-31',
    format: 'date',
  })
  @IsOptional()
  @IsDateString()
  endDate?: string;
}

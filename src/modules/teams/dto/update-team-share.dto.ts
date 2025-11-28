import { IsBoolean, IsOptional } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

/**
 * 팀 간 공유 수정 DTO
 *
 * 기존 팀 공유 설정을 변경할 때 사용하는 데이터 전송 객체입니다.
 *
 * @example
 * ```json
 * {
 *   "shareTasks": false,
 *   "shareSchedules": true
 * }
 * ```
 */
export class UpdateTeamShareDto {
  /**
   * 업무 공유 여부 변경
   */
  @ApiPropertyOptional({
    description: '업무 공유 여부 변경',
    example: false,
  })
  @IsOptional()
  @IsBoolean()
  shareTasks?: boolean;

  /**
   * 스케줄 공유 여부 변경
   */
  @ApiPropertyOptional({
    description: '스케줄 공유 여부 변경',
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  shareSchedules?: boolean;
}

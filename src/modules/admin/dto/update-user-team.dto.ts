import { IsUUID, IsOptional } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

/**
 * 사용자 팀 변경 DTO
 *
 * 사용자의 소속 팀을 변경할 때 사용하는 데이터 전송 객체입니다.
 * null을 전달하면 팀에서 제외됩니다.
 *
 * @example
 * ```json
 * {
 *   "teamId": "550e8400-e29b-41d4-a716-446655440000"
 * }
 * ```
 */
export class UpdateUserTeamDto {
  /**
   * 배정할 팀 ID
   * - UUID 전달: 해당 팀으로 이동
   * - null 전달: 팀에서 제외
   */
  @ApiPropertyOptional({
    description: '변경할 팀 ID. null 전달 시 팀에서 제외',
    example: '550e8400-e29b-41d4-a716-446655440000',
    format: 'uuid',
    nullable: true,
  })
  @IsOptional()
  @IsUUID('4', { message: '유효한 팀 ID를 입력하세요.' })
  teamId?: string | null;
}

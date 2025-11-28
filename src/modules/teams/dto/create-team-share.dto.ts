import { IsUUID, IsBoolean, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * 팀 간 공유 생성 DTO
 *
 * 다른 팀과의 업무/스케줄 공유를 설정할 때 사용하는 데이터 전송 객체입니다.
 * 공유를 설정하면 상대 팀에서 해당 팀의 업무나 스케줄을 조회할 수 있습니다.
 *
 * @example
 * ```json
 * {
 *   "toTeamId": "550e8400-e29b-41d4-a716-446655440000",
 *   "shareTasks": true,
 *   "shareSchedules": false
 * }
 * ```
 */
export class CreateTeamShareDto {
  /**
   * 공유 대상 팀 ID
   * 이 팀에게 현재 팀의 정보 조회 권한을 부여함
   */
  @ApiProperty({
    description: '공유 대상 팀 UUID. 이 팀이 현재 팀의 정보를 조회할 수 있게 됨',
    example: '550e8400-e29b-41d4-a716-446655440000',
    format: 'uuid',
  })
  @IsUUID()
  toTeamId: string;

  /**
   * 업무(Task) 공유 여부
   * true면 대상 팀에서 현재 팀의 업무 조회 가능
   */
  @ApiPropertyOptional({
    description: '업무 공유 여부. true면 대상 팀에서 업무 조회 가능',
    example: true,
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  shareTasks?: boolean = false;

  /**
   * 스케줄 공유 여부
   * true면 대상 팀에서 현재 팀의 스케줄 조회 가능
   */
  @ApiPropertyOptional({
    description: '스케줄 공유 여부. true면 대상 팀에서 스케줄 조회 가능',
    example: true,
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  shareSchedules?: boolean = false;
}

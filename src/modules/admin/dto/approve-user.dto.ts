import { IsEnum, IsUUID, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';

/**
 * 사용자 승인 DTO
 *
 * PENDING 상태의 사용자를 승인할 때 사용하는 데이터 전송 객체입니다.
 * 승인 시 역할(Role)을 필수로 지정해야 하며, 선택적으로 팀에 배정할 수 있습니다.
 *
 * @example
 * ```json
 * {
 *   "role": "ACTOR",
 *   "teamId": "550e8400-e29b-41d4-a716-446655440000"
 * }
 * ```
 */
export class ApproveUserDto {
  /**
   * 부여할 사용자 역할
   * - OWNER: 최고 관리자 (시스템 전체 권한)
   * - HEAD: 부서장 (팀 관리 권한)
   * - LEAD: 팀 리더 (팀 내 업무 관리)
   * - ACTOR: 일반 사용자
   */
  @ApiProperty({
    description: '승인 시 부여할 역할',
    enum: UserRole,
    example: 'ACTOR',
    enumName: 'UserRole',
  })
  @IsEnum(UserRole, { message: '유효한 역할을 선택하세요.' })
  role: UserRole;

  /**
   * 배정할 팀 ID (선택)
   * 팀에 배정하지 않으면 팀 없이 승인됨
   */
  @ApiPropertyOptional({
    description: '사용자를 배정할 팀 ID. 미지정 시 팀 없이 승인',
    example: '550e8400-e29b-41d4-a716-446655440000',
    format: 'uuid',
  })
  @IsOptional()
  @IsUUID('4', { message: '유효한 팀 ID를 입력하세요.' })
  teamId?: string;
}

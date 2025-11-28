import { IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';

/**
 * 사용자 역할 변경 DTO
 *
 * 사용자의 역할(권한)을 변경할 때 사용하는 데이터 전송 객체입니다.
 *
 * @example
 * ```json
 * {
 *   "role": "LEAD"
 * }
 * ```
 */
export class UpdateUserRoleDto {
  /**
   * 변경할 역할
   * - OWNER: 최고 관리자
   * - HEAD: 부서장
   * - LEAD: 팀 리더
   * - ACTOR: 일반 사용자
   */
  @ApiProperty({
    description: '변경할 역할. OWNER > HEAD > LEAD > ACTOR 순으로 권한 높음',
    enum: UserRole,
    example: 'LEAD',
    enumName: 'UserRole',
  })
  @IsEnum(UserRole, { message: '유효한 역할을 선택하세요.' })
  role: UserRole;
}

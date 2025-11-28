import { IsString, IsOptional, MaxLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

/**
 * 사용자 거절 DTO
 *
 * PENDING 상태의 사용자 가입을 거절할 때 사용하는 데이터 전송 객체입니다.
 * 거절 사유를 선택적으로 기록할 수 있습니다.
 *
 * @example
 * ```json
 * {
 *   "reason": "회사 직원이 아닙니다."
 * }
 * ```
 */
export class RejectUserDto {
  /**
   * 거절 사유 (선택)
   * 사용자에게 거절 이유를 전달하거나 내부 기록용으로 사용
   */
  @ApiPropertyOptional({
    description: '가입 거절 사유. 내부 기록 또는 사용자 안내용',
    example: '회사 직원이 아닙니다.',
    maxLength: 500,
  })
  @IsOptional()
  @IsString()
  @MaxLength(500, { message: '사유는 500자를 초과할 수 없습니다.' })
  reason?: string;
}

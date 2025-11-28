import { IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

/**
 * 팀원 추가 DTO
 *
 * 팀에 새로운 멤버를 추가할 때 사용하는 데이터 전송 객체입니다.
 *
 * @example
 * ```json
 * {
 *   "userId": "550e8400-e29b-41d4-a716-446655440000"
 * }
 * ```
 */
export class AddMemberDto {
  /**
   * 추가할 사용자 ID
   */
  @ApiProperty({
    description: '팀에 추가할 사용자의 UUID',
    example: '550e8400-e29b-41d4-a716-446655440000',
    format: 'uuid',
  })
  @IsUUID()
  userId: string;
}

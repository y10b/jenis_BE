import { IsString, IsOptional, MaxLength, MinLength, IsUUID } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

/**
 * 팀 수정 DTO
 *
 * 기존 팀 정보를 수정할 때 사용하는 데이터 전송 객체입니다.
 * 모든 필드는 선택적이며, 제공된 필드만 업데이트됩니다.
 *
 * @example
 * ```json
 * {
 *   "name": "프론트엔드팀",
 *   "description": "웹 프론트엔드 개발팀"
 * }
 * ```
 */
export class UpdateTeamDto {
  /**
   * 변경할 팀 이름
   */
  @ApiPropertyOptional({
    description: '변경할 팀 이름',
    example: '프론트엔드팀',
    minLength: 2,
    maxLength: 50,
  })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(50)
  name?: string;

  /**
   * 변경할 팀 설명
   */
  @ApiPropertyOptional({
    description: '변경할 팀 설명',
    example: '웹 프론트엔드 개발팀',
    maxLength: 200,
  })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  description?: string;

  /**
   * 팀 소유자 변경
   * 새로운 소유자가 될 사용자 ID
   */
  @ApiPropertyOptional({
    description: '새로운 팀 소유자 UUID. 팀 리더 변경 시 사용',
    example: '550e8400-e29b-41d4-a716-446655440000',
    format: 'uuid',
  })
  @IsOptional()
  @IsUUID()
  ownerId?: string;
}

import { IsOptional, IsUUID, IsArray, ValidateIf } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

/**
 * 회고 공유 DTO
 *
 * 회고를 특정 사용자나 팀에게 공유할 때 사용합니다.
 * userIds 또는 teamIds 중 하나 이상 필수입니다.
 *
 * @example
 * ```json
 * {
 *   "userIds": ["user-uuid-1", "user-uuid-2"],
 *   "teamIds": ["team-uuid-1"]
 * }
 * ```
 */
export class ShareRetrospectiveDto {
  /**
   * 공유할 사용자 ID 목록
   */
  @ApiPropertyOptional({
    description: '회고를 공유할 사용자들의 UUID 목록',
    type: [String],
    example: ['550e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440002'],
  })
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  userIds?: string[];

  /**
   * 공유할 팀 ID 목록
   */
  @ApiPropertyOptional({
    description: '회고를 공유할 팀들의 UUID 목록. 팀에 공유하면 팀원 전체가 볼 수 있음',
    type: [String],
    example: ['550e8400-e29b-41d4-a716-446655440010'],
  })
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  teamIds?: string[];

  @ValidateIf((o) => !o.userIds?.length && !o.teamIds?.length)
  atLeastOne?: never;
}

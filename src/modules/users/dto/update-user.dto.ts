import { IsString, IsOptional, MinLength, MaxLength, IsUrl } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

/**
 * 사용자 정보 수정 DTO
 *
 * 사용자 프로필 정보를 업데이트할 때 사용하는 데이터 전송 객체입니다.
 * 모든 필드는 선택적이며, 제공된 필드만 업데이트됩니다.
 *
 * @example
 * ```json
 * {
 *   "name": "새로운이름",
 *   "profileImageUrl": "https://example.com/avatar.png"
 * }
 * ```
 */
export class UpdateUserDto {
  /**
   * 사용자 이름 (변경할 경우)
   */
  @ApiPropertyOptional({
    description: '변경할 사용자 이름. 2자 이상 50자 이하',
    example: '김철수',
    minLength: 2,
    maxLength: 50,
  })
  @IsOptional()
  @IsString()
  @MinLength(2, { message: '이름은 최소 2자 이상이어야 합니다.' })
  @MaxLength(50, { message: '이름은 50자를 초과할 수 없습니다.' })
  name?: string;

  /**
   * 프로필 이미지 URL
   */
  @ApiPropertyOptional({
    description: '프로필 이미지 URL. 유효한 URL 형식이어야 함',
    example: 'https://example.com/avatar.png',
    format: 'uri',
  })
  @IsOptional()
  @IsUrl({}, { message: '유효한 URL 형식이 아닙니다.' })
  profileImageUrl?: string;
}

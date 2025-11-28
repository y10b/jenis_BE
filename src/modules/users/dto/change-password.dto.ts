import { IsString, MinLength, MaxLength, Matches } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

/**
 * 비밀번호 변경 DTO
 *
 * 사용자가 비밀번호를 변경할 때 사용하는 데이터 전송 객체입니다.
 * 현재 비밀번호 확인 후 새 비밀번호로 변경합니다.
 *
 * @example
 * ```json
 * {
 *   "currentPassword": "OldPass123!",
 *   "newPassword": "NewSecure456!"
 * }
 * ```
 */
export class ChangePasswordDto {
  /**
   * 현재 비밀번호 (본인 확인용)
   */
  @ApiProperty({
    description: '현재 사용 중인 비밀번호. 본인 확인을 위해 필요',
    example: 'OldPass123!',
  })
  @IsString()
  @MinLength(1, { message: '현재 비밀번호를 입력하세요.' })
  currentPassword: string;

  /**
   * 새 비밀번호
   * - 최소 8자 이상
   * - 영문, 숫자, 특수문자 포함 필수
   */
  @ApiProperty({
    description: '새로 설정할 비밀번호. 영문, 숫자, 특수문자 각각 1개 이상 포함',
    example: 'NewSecure456!',
    minLength: 8,
    maxLength: 50,
  })
  @IsString()
  @MinLength(8, { message: '새 비밀번호는 최소 8자 이상이어야 합니다.' })
  @MaxLength(50, { message: '새 비밀번호는 50자를 초과할 수 없습니다.' })
  @Matches(/^(?=.*[a-zA-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/, {
    message: '비밀번호는 영문, 숫자, 특수문자를 포함해야 합니다.',
  })
  newPassword: string;
}

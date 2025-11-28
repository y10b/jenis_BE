import {
  IsEmail,
  IsString,
  MinLength,
  MaxLength,
  Matches,
  IsOptional,
  IsBoolean,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * 회원가입 요청 DTO
 *
 * 새로운 사용자 계정을 생성할 때 필요한 정보를 담는 데이터 전송 객체입니다.
 * 회원가입 후 관리자 승인이 필요하며, 승인 전까지 로그인이 불가능합니다.
 *
 * @example
 * ```json
 * {
 *   "email": "user@example.com",
 *   "password": "SecurePass123!",
 *   "name": "홍길동",
 *   "wantGithub": true,
 *   "wantSlack": false
 * }
 * ```
 */
export class SignupDto {
  /**
   * 사용자 이메일 주소 (로그인 ID로 사용됨)
   */
  @ApiProperty({
    description: '사용자 이메일 주소. 로그인 시 ID로 사용되며 중복 불가',
    example: 'user@example.com',
    format: 'email',
  })
  @IsEmail({}, { message: '유효한 이메일 주소를 입력하세요.' })
  email: string;

  /**
   * 비밀번호 (영문, 숫자, 특수문자 조합 필수)
   * - 최소 8자 이상
   * - 영문, 숫자, 특수문자(@$!%*?&) 각각 1개 이상 포함
   */
  @ApiProperty({
    description: '비밀번호. 영문, 숫자, 특수문자(@$!%*?&)를 각각 1개 이상 포함해야 함',
    example: 'SecurePass123!',
    minLength: 8,
    maxLength: 50,
  })
  @IsString()
  @MinLength(8, { message: '비밀번호는 최소 8자 이상이어야 합니다.' })
  @MaxLength(50, { message: '비밀번호는 50자를 초과할 수 없습니다.' })
  @Matches(/^(?=.*[a-zA-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/, {
    message: '비밀번호는 영문, 숫자, 특수문자를 포함해야 합니다.',
  })
  password: string;

  /**
   * 사용자 이름 (실명 또는 닉네임)
   */
  @ApiProperty({
    description: '사용자 이름. 2자 이상 50자 이하',
    example: '홍길동',
    minLength: 2,
    maxLength: 50,
  })
  @IsString()
  @MinLength(2, { message: '이름은 최소 2자 이상이어야 합니다.' })
  @MaxLength(50, { message: '이름은 50자를 초과할 수 없습니다.' })
  name: string;

  /**
   * GitHub 연동 희망 여부
   * true로 설정 시 승인 후 GitHub OAuth 연동 안내 제공
   */
  @ApiPropertyOptional({
    description: 'GitHub 연동 희망 여부. 승인 후 OAuth 연동 진행 가능',
    example: true,
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  wantGithub?: boolean;

  /**
   * Slack 연동 희망 여부
   * true로 설정 시 승인 후 Slack 연동 안내 제공
   */
  @ApiPropertyOptional({
    description: 'Slack 연동 희망 여부. 승인 후 Slack 연동 진행 가능',
    example: false,
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  wantSlack?: boolean;
}

import { IsEmail, IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

/**
 * 로그인 요청 DTO
 *
 * 사용자 인증을 위한 이메일과 비밀번호를 담는 데이터 전송 객체입니다.
 * 로그인 성공 시 JWT 액세스 토큰과 리프레시 토큰이 쿠키로 발급됩니다.
 *
 * @example
 * ```json
 * {
 *   "email": "user@example.com",
 *   "password": "SecurePass123!"
 * }
 * ```
 */
export class LoginDto {
  /**
   * 로그인용 이메일 주소
   */
  @ApiProperty({
    description: '등록된 이메일 주소',
    example: 'user@example.com',
    format: 'email',
  })
  @IsEmail({}, { message: '유효한 이메일 주소를 입력하세요.' })
  email: string;

  /**
   * 사용자 비밀번호
   */
  @ApiProperty({
    description: '계정 비밀번호',
    example: 'SecurePass123!',
  })
  @IsString()
  @MinLength(1, { message: '비밀번호를 입력하세요.' })
  password: string;
}

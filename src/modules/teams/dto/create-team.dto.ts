import { IsString, IsOptional, MaxLength, MinLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * 팀 생성 DTO
 *
 * 새로운 팀을 생성할 때 사용하는 데이터 전송 객체입니다.
 *
 * @example
 * ```json
 * {
 *   "name": "개발팀",
 *   "description": "백엔드 개발을 담당하는 팀"
 * }
 * ```
 */
export class CreateTeamDto {
  /**
   * 팀 이름 (2-50자)
   */
  @ApiProperty({
    description: '팀 이름. 조직 내에서 구분 가능한 명칭',
    example: '개발팀',
    minLength: 2,
    maxLength: 50,
  })
  @IsString()
  @MinLength(2)
  @MaxLength(50)
  name: string;

  /**
   * 팀 설명 (선택)
   */
  @ApiPropertyOptional({
    description: '팀에 대한 간략한 설명',
    example: '백엔드 개발을 담당하는 팀',
    maxLength: 200,
  })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  description?: string;
}

import { IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

/**
 * Slack OAuth 콜백 DTO
 *
 * Slack OAuth 인증 후 콜백으로 전달되는 파라미터입니다.
 * 이 DTO는 시스템 내부적으로 사용되며, 직접 호출하지 않습니다.
 */
export class SlackCallbackDto {
  /**
   * Slack에서 발급한 인증 코드
   */
  @ApiProperty({
    description: 'Slack OAuth 인증 코드. 액세스 토큰 교환에 사용됨',
    example: 'abc123def456',
  })
  @IsString()
  code: string;

  /**
   * CSRF 방지를 위한 상태 값
   */
  @ApiProperty({
    description: 'OAuth 요청 시 전달한 state 값. CSRF 공격 방지용',
    example: 'random-state-string',
  })
  @IsString()
  state: string;
}

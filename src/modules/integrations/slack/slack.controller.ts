import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Query,
  Res,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiExcludeEndpoint,
  ApiProperty,
} from '@nestjs/swagger';
import type { Response } from 'express';
import { SlackService } from './slack.service';
import { CurrentUser } from '../../../common/decorators';
import type { RequestUser } from '../../../common/interfaces';
import { SlackCallbackDto } from '../dto';
import { ConfigService } from '@nestjs/config';
import { IsString } from 'class-validator';

/**
 * Slack 메시지 전송 DTO
 *
 * Slack 채널에 메시지를 전송할 때 사용합니다.
 */
class SendMessageDto {
  /**
   * 메시지를 전송할 채널 ID
   */
  @ApiProperty({
    description: 'Slack 채널 ID',
    example: 'C0123456789',
  })
  @IsString()
  channelId: string;

  /**
   * 전송할 메시지 내용
   */
  @ApiProperty({
    description: '전송할 메시지 텍스트. Slack 마크다운 지원',
    example: '업무가 완료되었습니다! :tada:',
  })
  @IsString()
  text: string;
}

/**
 * Slack 통합 컨트롤러
 *
 * Slack OAuth 연동 및 메시지 전송 기능을 제공합니다.
 * 알림을 Slack 채널로 전송할 수 있습니다.
 */
@ApiTags('Integrations - Slack')
@ApiBearerAuth('accessToken')
@Controller('integrations/slack')
export class SlackController {
  constructor(
    private readonly slackService: SlackService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Slack 인증 URL 조회 API
   */
  @ApiOperation({
    summary: 'Slack 연동 URL 조회',
    description: `
Slack OAuth 인증을 시작하기 위한 URL을 반환합니다.

### 사용 방법
1. 이 API를 호출하여 authUrl을 받습니다
2. 사용자를 해당 URL로 리다이렉트합니다
3. Slack에서 워크스페이스 선택 및 권한 승인
4. 연동 완료 후 /settings/integrations로 리다이렉트됩니다

### 필요 권한
- chat:write (메시지 전송)
- channels:read (채널 목록 조회)
    `,
  })
  @ApiResponse({
    status: 200,
    description: 'Slack OAuth URL 반환',
    schema: {
      example: { authUrl: 'https://slack.com/oauth/v2/authorize?...' },
    },
  })
  @Get('auth')
  getAuthUrl(@CurrentUser() user: RequestUser) {
    const authUrl = this.slackService.getAuthUrl(user.id);
    return { authUrl };
  }

  /**
   * Slack OAuth 콜백 처리 (내부용)
   */
  @ApiExcludeEndpoint()
  @Get('callback')
  async handleCallback(
    @Query() dto: SlackCallbackDto,
    @CurrentUser() user: RequestUser,
    @Res() res: Response,
  ) {
    await this.slackService.handleCallback(dto.code, user);

    const frontendUrl = this.configService.get<string>('app.frontendUrl') || 'http://localhost:3000';
    res.redirect(`${frontendUrl}/settings/integrations?slack=success`);
  }

  /**
   * Slack 연동 해제 API
   */
  @ApiOperation({
    summary: 'Slack 연동 해제',
    description: `
Slack 연동을 해제합니다.

### 주의사항
- 연동 해제 시 저장된 액세스 토큰이 삭제됩니다
- Slack으로의 알림 전송이 중단됩니다
- 다시 연동하려면 auth API를 통해 재인증해야 합니다
    `,
  })
  @ApiResponse({ status: 200, description: '연동 해제 성공' })
  @Delete()
  disconnect(@CurrentUser() user: RequestUser) {
    return this.slackService.disconnect(user);
  }

  /**
   * Slack 연동 상태 조회 API
   */
  @ApiOperation({
    summary: 'Slack 연동 상태 조회',
    description: `
현재 사용자의 Slack 연동 상태를 조회합니다.

### 반환 정보
- connected: 연동 여부
- workspaceName: Slack 워크스페이스 이름 (연동된 경우)
- teamId: Slack 팀 ID (연동된 경우)
    `,
  })
  @ApiResponse({
    status: 200,
    description: 'Slack 연동 상태 반환',
    schema: {
      example: {
        connected: true,
        workspaceName: 'My Company',
        teamId: 'T0123456789',
      },
    },
  })
  @Get('status')
  getStatus(@CurrentUser() user: RequestUser) {
    return this.slackService.getStatus(user);
  }

  /**
   * Slack 채널 목록 조회 API
   */
  @ApiOperation({
    summary: 'Slack 채널 목록 조회',
    description: `
연동된 Slack 워크스페이스의 채널 목록을 조회합니다.

### 반환 정보
- public 채널 목록
- 봇이 초대된 private 채널 목록

### 주의사항
메시지를 전송하려면 해당 채널에 봇이 초대되어 있어야 합니다.
    `,
  })
  @ApiResponse({ status: 200, description: '채널 목록 반환' })
  @ApiResponse({ status: 400, description: 'Slack 연동 필요' })
  @Get('channels')
  getChannels(@CurrentUser() user: RequestUser) {
    return this.slackService.getChannels(user);
  }

  /**
   * Slack 메시지 전송 API
   */
  @ApiOperation({
    summary: 'Slack 메시지 전송',
    description: `
지정한 Slack 채널에 메시지를 전송합니다.

### 메시지 형식
- 일반 텍스트 지원
- Slack 마크다운 지원 (*bold*, _italic_, ~strike~)
- 이모지 지원 (:tada:, :thumbsup:)

### 주의사항
- 봇이 해당 채널에 초대되어 있어야 합니다
- 채널 ID는 channels API에서 조회할 수 있습니다
    `,
  })
  @ApiResponse({ status: 201, description: '메시지 전송 성공' })
  @ApiResponse({ status: 400, description: 'Slack 연동 필요 또는 채널 접근 불가' })
  @Post('send-message')
  sendMessage(
    @Body() dto: SendMessageDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.slackService.sendMessage(user, dto.channelId, dto.text);
  }
}

import {
  Controller,
  Post,
  Body,
  Headers,
  Logger,
  BadRequestException,
  Req,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiHeader,
} from '@nestjs/swagger';
import type { RawBodyRequest } from '@nestjs/common';
import type { Request } from 'express';
import { GithubWebhookService } from './github-webhook.service';
import { Public } from '../../../common/decorators';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';

/**
 * GitHub Webhook 컨트롤러
 *
 * GitHub에서 발생하는 이벤트(PR, Issue, Push 등)를 수신하여 처리합니다.
 * 업무와 연결된 GitHub 리소스의 상태 변경을 자동으로 동기화합니다.
 *
 * @remarks
 * 이 엔드포인트는 GitHub에서 직접 호출하므로 인증이 필요하지 않습니다.
 * 대신 x-hub-signature-256 헤더를 통해 요청의 유효성을 검증합니다.
 */
@ApiTags('Webhooks')
@Controller('webhooks/github')
export class GithubWebhookController {
  private readonly logger = new Logger(GithubWebhookController.name);

  constructor(
    private readonly githubWebhookService: GithubWebhookService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * GitHub Webhook 수신 API
   */
  @ApiOperation({
    summary: 'GitHub Webhook 수신',
    description: `
GitHub에서 발생하는 이벤트를 수신하여 처리합니다.

### 지원 이벤트
- **pull_request**: PR 생성, 업데이트, 머지, 클로즈
- **issues**: 이슈 생성, 업데이트, 클로즈
- **push**: 커밋 푸시

### 처리 내용
- 연결된 업무의 상태 자동 업데이트
- GitHub 이슈/PR 상태 동기화
- 관련 사용자에게 알림 전송

### 보안
- GITHUB_WEBHOOK_SECRET 환경 변수 설정 시 서명 검증
- 유효하지 않은 서명은 400 에러 반환

### GitHub Webhook 설정
1. GitHub 리포지토리 Settings > Webhooks
2. Payload URL: https://your-domain/webhooks/github
3. Content type: application/json
4. Secret: GITHUB_WEBHOOK_SECRET과 동일한 값
5. Events: Pull requests, Issues, Pushes 선택
    `,
  })
  @ApiHeader({
    name: 'x-github-event',
    description: 'GitHub 이벤트 유형 (pull_request, issues, push 등)',
    required: true,
    example: 'pull_request',
  })
  @ApiHeader({
    name: 'x-hub-signature-256',
    description: 'HMAC-SHA256 서명 (Webhook Secret 설정 시)',
    required: false,
    example: 'sha256=...',
  })
  @ApiHeader({
    name: 'x-github-delivery',
    description: 'Webhook 전송 고유 ID',
    required: true,
    example: '72d3162e-cc78-11e3-81ab-4c9367dc0958',
  })
  @ApiResponse({
    status: 200,
    description: 'Webhook 수신 성공',
    schema: {
      example: { received: true },
    },
  })
  @ApiResponse({ status: 400, description: '유효하지 않은 서명' })
  @Public()
  @Post()
  async handleWebhook(
    @Headers('x-github-event') event: string,
    @Headers('x-hub-signature-256') signature: string,
    @Headers('x-github-delivery') deliveryId: string,
    @Body() payload: any,
    @Req() req: RawBodyRequest<Request>,
  ) {
    this.logger.log(`Received GitHub webhook: ${event} (${deliveryId})`);

    // Verify webhook signature if secret is configured
    const webhookSecret = this.configService.get<string>('GITHUB_WEBHOOK_SECRET');
    if (webhookSecret && signature) {
      const rawBody = req.rawBody;
      if (rawBody) {
        const isValid = this.verifySignature(rawBody, signature, webhookSecret);
        if (!isValid) {
          this.logger.warn(`Invalid webhook signature for delivery ${deliveryId}`);
          throw new BadRequestException('Invalid signature');
        }
      }
    }

    switch (event) {
      case 'pull_request':
        await this.githubWebhookService.handlePullRequest(payload);
        break;
      case 'issues':
        await this.githubWebhookService.handleIssue(payload);
        break;
      case 'push':
        await this.githubWebhookService.handlePush(payload);
        break;
      default:
        this.logger.debug(`Unhandled GitHub event: ${event}`);
    }

    return { received: true };
  }

  /**
   * Webhook 서명 검증
   * @param payload Raw body 데이터
   * @param signature GitHub에서 전송한 서명
   * @param secret Webhook 시크릿
   * @returns 서명 유효성 여부
   */
  private verifySignature(payload: Buffer, signature: string, secret: string): boolean {
    const hmac = crypto.createHmac('sha256', secret);
    const digest = 'sha256=' + hmac.update(payload).digest('hex');
    return crypto.timingSafeEqual(Buffer.from(digest), Buffer.from(signature));
  }
}

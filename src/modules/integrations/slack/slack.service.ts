import {
  Injectable,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../../database/prisma.service';
import { CryptoUtil } from '../../../common/utils';
import { ErrorCodes } from '../../../common/constants';
import { RequestUser } from '../../../common/interfaces';
import { IntegrationProvider } from '@prisma/client';

interface SlackTokenResponse {
  ok: boolean;
  access_token: string;
  token_type: string;
  scope: string;
  bot_user_id?: string;
  app_id: string;
  team: {
    id: string;
    name: string;
  };
  authed_user: {
    id: string;
    scope: string;
    access_token: string;
    token_type: string;
  };
  error?: string;
}

interface SlackUserResponse {
  ok: boolean;
  user: {
    id: string;
    name: string;
    real_name: string;
    profile: {
      email: string;
      image_48: string;
    };
  };
  error?: string;
}

@Injectable()
export class SlackService {
  private readonly logger = new Logger(SlackService.name);
  private readonly clientId: string;
  private readonly clientSecret: string;
  private readonly redirectUri: string;

  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
  ) {
    this.clientId = this.configService.get<string>('SLACK_CLIENT_ID') || '';
    this.clientSecret = this.configService.get<string>('SLACK_CLIENT_SECRET') || '';
    this.redirectUri = this.configService.get<string>('SLACK_REDIRECT_URI') || '';
  }

  getAuthUrl(userId: string): string {
    const state = CryptoUtil.hash(userId + Date.now().toString());
    const scope = 'chat:write,users:read,users:read.email,channels:read,groups:read';
    const userScope = 'chat:write';

    return `https://slack.com/oauth/v2/authorize?client_id=${this.clientId}&redirect_uri=${encodeURIComponent(this.redirectUri)}&scope=${encodeURIComponent(scope)}&user_scope=${encodeURIComponent(userScope)}&state=${state}`;
  }

  async handleCallback(code: string, user: RequestUser): Promise<void> {
    // Exchange code for access token
    const tokenResponse = await this.exchangeCodeForToken(code);

    if (!tokenResponse.ok) {
      this.logger.error(`Slack OAuth error: ${tokenResponse.error}`);
      throw new BadRequestException(ErrorCodes.SLACK_ERROR);
    }

    // Get user info from Slack
    const slackUser = await this.getSlackUser(
      tokenResponse.authed_user.access_token,
      tokenResponse.authed_user.id,
    );

    // Encrypt tokens
    const accessTokenEncrypted = CryptoUtil.encrypt(tokenResponse.authed_user.access_token);

    // Upsert integration
    await this.prisma.userIntegration.upsert({
      where: {
        userId_provider: {
          userId: user.id,
          provider: IntegrationProvider.SLACK,
        },
      },
      update: {
        accessTokenEncrypted,
        providerUserId: tokenResponse.authed_user.id,
        providerUsername: slackUser.user.name,
        providerData: {
          teamId: tokenResponse.team.id,
          teamName: tokenResponse.team.name,
          realName: slackUser.user.real_name,
          email: slackUser.user.profile.email,
          avatarUrl: slackUser.user.profile.image_48,
        },
      },
      create: {
        userId: user.id,
        provider: IntegrationProvider.SLACK,
        accessTokenEncrypted,
        providerUserId: tokenResponse.authed_user.id,
        providerUsername: slackUser.user.name,
        providerData: {
          teamId: tokenResponse.team.id,
          teamName: tokenResponse.team.name,
          realName: slackUser.user.real_name,
          email: slackUser.user.profile.email,
          avatarUrl: slackUser.user.profile.image_48,
        },
      },
    });

    this.logger.log(`Slack connected for user: ${user.email}`);
  }

  async disconnect(user: RequestUser): Promise<void> {
    await this.prisma.userIntegration.deleteMany({
      where: {
        userId: user.id,
        provider: IntegrationProvider.SLACK,
      },
    });

    this.logger.log(`Slack disconnected for user: ${user.email}`);
  }

  async getStatus(user: RequestUser) {
    const integration = await this.prisma.userIntegration.findUnique({
      where: {
        userId_provider: {
          userId: user.id,
          provider: IntegrationProvider.SLACK,
        },
      },
    });

    if (!integration) {
      return { connected: false };
    }

    const providerData = integration.providerData as any;

    return {
      connected: true,
      username: integration.providerUsername,
      teamName: providerData?.teamName,
      connectedAt: integration.createdAt,
    };
  }

  async getChannels(user: RequestUser) {
    const accessToken = await this.getAccessToken(user.id);

    // Get public channels
    const publicResponse = await fetch(
      'https://slack.com/api/conversations.list?types=public_channel&limit=200',
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      },
    );

    const publicData = await publicResponse.json();

    if (!publicData.ok) {
      this.logger.error(`Slack API error: ${publicData.error}`);
      throw new BadRequestException(ErrorCodes.SLACK_ERROR);
    }

    // Get private channels user is member of
    const privateResponse = await fetch(
      'https://slack.com/api/conversations.list?types=private_channel&limit=200',
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      },
    );

    const privateData = await privateResponse.json();

    const channels = [
      ...(publicData.channels || []),
      ...(privateData.ok ? privateData.channels || [] : []),
    ];

    return channels.map((channel: any) => ({
      id: channel.id,
      name: channel.name,
      isPrivate: channel.is_private,
      memberCount: channel.num_members,
    }));
  }

  async sendMessage(
    user: RequestUser,
    channelId: string,
    text: string,
    blocks?: any[],
  ) {
    const accessToken = await this.getAccessToken(user.id);

    const body: any = {
      channel: channelId,
      text,
    };

    if (blocks) {
      body.blocks = blocks;
    }

    const response = await fetch('https://slack.com/api/chat.postMessage', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    const data = await response.json();

    if (!data.ok) {
      this.logger.error(`Slack API error: ${data.error}`);
      throw new BadRequestException(ErrorCodes.SLACK_ERROR);
    }

    return {
      messageId: data.ts,
      channelId: data.channel,
    };
  }

  async sendTaskNotification(
    user: RequestUser,
    channelId: string,
    task: {
      id: string;
      title: string;
      status: string;
      assignee?: string;
      dueDate?: Date;
    },
    action: 'created' | 'updated' | 'completed',
  ) {
    const actionText = {
      created: '새 Task가 생성되었습니다',
      updated: 'Task가 업데이트되었습니다',
      completed: 'Task가 완료되었습니다',
    };

    const blocks = [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: actionText[action],
        },
      },
      {
        type: 'section',
        fields: [
          {
            type: 'mrkdwn',
            text: `*제목:*\n${task.title}`,
          },
          {
            type: 'mrkdwn',
            text: `*상태:*\n${task.status}`,
          },
        ],
      },
    ];

    if (task.assignee || task.dueDate) {
      const fields: any[] = [];
      if (task.assignee) {
        fields.push({
          type: 'mrkdwn',
          text: `*담당자:*\n${task.assignee}`,
        });
      }
      if (task.dueDate) {
        fields.push({
          type: 'mrkdwn',
          text: `*마감일:*\n${task.dueDate.toLocaleDateString('ko-KR')}`,
        });
      }
      blocks.push({
        type: 'section',
        fields,
      });
    }

    return this.sendMessage(user, channelId, actionText[action], blocks);
  }

  private async exchangeCodeForToken(code: string): Promise<SlackTokenResponse> {
    const params = new URLSearchParams({
      client_id: this.clientId,
      client_secret: this.clientSecret,
      code,
      redirect_uri: this.redirectUri,
    });

    const response = await fetch('https://slack.com/api/oauth.v2.access', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params,
    });

    return response.json();
  }

  private async getSlackUser(accessToken: string, userId: string): Promise<SlackUserResponse> {
    const response = await fetch(`https://slack.com/api/users.info?user=${userId}`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    const data = await response.json();

    if (!data.ok) {
      throw new BadRequestException(ErrorCodes.SLACK_ERROR);
    }

    return data;
  }

  private async getAccessToken(userId: string): Promise<string> {
    const integration = await this.prisma.userIntegration.findUnique({
      where: {
        userId_provider: {
          userId,
          provider: IntegrationProvider.SLACK,
        },
      },
    });

    if (!integration) {
      throw new BadRequestException(ErrorCodes.INTEGRATION_NOT_CONNECTED);
    }

    return CryptoUtil.decrypt(integration.accessTokenEncrypted);
  }
}

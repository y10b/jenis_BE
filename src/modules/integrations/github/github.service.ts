import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../../database/prisma.service';
import { CryptoUtil } from '../../../common/utils';
import { ErrorCodes } from '../../../common/constants';
import { RequestUser } from '../../../common/interfaces';
import { IntegrationProvider } from '@prisma/client';
import {
  LinkTaskGithubDto,
  CreateGithubIssueDto,
  CreateGithubBranchDto,
} from '../dto';

interface GithubTokenResponse {
  access_token: string;
  token_type: string;
  scope: string;
  refresh_token?: string;
  expires_in?: number;
  refresh_token_expires_in?: number;
}

interface GithubUserResponse {
  id: number;
  login: string;
  name: string;
  email: string;
  avatar_url: string;
}

@Injectable()
export class GithubService {
  private readonly logger = new Logger(GithubService.name);
  private readonly clientId: string;
  private readonly clientSecret: string;
  private readonly redirectUri: string;

  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
  ) {
    this.clientId = this.configService.get<string>('GITHUB_CLIENT_ID') || '';
    this.clientSecret = this.configService.get<string>('GITHUB_CLIENT_SECRET') || '';
    this.redirectUri = this.configService.get<string>('GITHUB_REDIRECT_URI') || '';
  }

  getAuthUrl(userId: string): string {
    const state = CryptoUtil.hash(userId + Date.now().toString());
    const scope = 'repo user:email';

    return `https://github.com/login/oauth/authorize?client_id=${this.clientId}&redirect_uri=${encodeURIComponent(this.redirectUri)}&scope=${encodeURIComponent(scope)}&state=${state}`;
  }

  async handleCallback(code: string, user: RequestUser): Promise<void> {
    // Exchange code for access token
    const tokenResponse = await this.exchangeCodeForToken(code);

    // Get user info from GitHub
    const githubUser = await this.getGithubUser(tokenResponse.access_token);

    // Encrypt tokens
    const accessTokenEncrypted = CryptoUtil.encrypt(tokenResponse.access_token);
    const refreshTokenEncrypted = tokenResponse.refresh_token
      ? CryptoUtil.encrypt(tokenResponse.refresh_token)
      : null;

    // Calculate expiration
    const expiresAt = tokenResponse.expires_in
      ? new Date(Date.now() + tokenResponse.expires_in * 1000)
      : null;

    // Upsert integration
    await this.prisma.userIntegration.upsert({
      where: {
        userId_provider: {
          userId: user.id,
          provider: IntegrationProvider.GITHUB,
        },
      },
      update: {
        accessTokenEncrypted,
        refreshTokenEncrypted,
        providerUserId: githubUser.id.toString(),
        providerUsername: githubUser.login,
        providerData: {
          name: githubUser.name,
          email: githubUser.email,
          avatarUrl: githubUser.avatar_url,
        },
        expiresAt,
      },
      create: {
        userId: user.id,
        provider: IntegrationProvider.GITHUB,
        accessTokenEncrypted,
        refreshTokenEncrypted,
        providerUserId: githubUser.id.toString(),
        providerUsername: githubUser.login,
        providerData: {
          name: githubUser.name,
          email: githubUser.email,
          avatarUrl: githubUser.avatar_url,
        },
        expiresAt,
      },
    });

    this.logger.log(`GitHub connected for user: ${user.email}`);
  }

  async disconnect(user: RequestUser): Promise<void> {
    await this.prisma.userIntegration.deleteMany({
      where: {
        userId: user.id,
        provider: IntegrationProvider.GITHUB,
      },
    });

    this.logger.log(`GitHub disconnected for user: ${user.email}`);
  }

  async getStatus(user: RequestUser) {
    const integration = await this.prisma.userIntegration.findUnique({
      where: {
        userId_provider: {
          userId: user.id,
          provider: IntegrationProvider.GITHUB,
        },
      },
    });

    if (!integration) {
      return { connected: false };
    }

    return {
      connected: true,
      username: integration.providerUsername,
      connectedAt: integration.createdAt,
    };
  }

  async getRepositories(user: RequestUser) {
    const accessToken = await this.getAccessToken(user.id);

    const response = await fetch('https://api.github.com/user/repos?per_page=100&sort=updated', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/vnd.github.v3+json',
      },
    });

    if (!response.ok) {
      throw new BadRequestException(ErrorCodes.GITHUB_ERROR);
    }

    const repos = await response.json();
    return repos.map((repo: any) => ({
      id: repo.id,
      name: repo.name,
      fullName: repo.full_name,
      private: repo.private,
      url: repo.html_url,
      defaultBranch: repo.default_branch,
    }));
  }

  async linkTaskToGithub(dto: LinkTaskGithubDto, user: RequestUser) {
    const task = await this.prisma.task.findUnique({
      where: { id: dto.taskId },
    });

    if (!task) {
      throw new NotFoundException(ErrorCodes.TASK_NOT_FOUND);
    }

    const updatedTask = await this.prisma.task.update({
      where: { id: dto.taskId },
      data: {
        githubRepo: dto.repo,
        githubIssueNumber: dto.issueNumber,
        githubPrNumber: dto.prNumber,
        githubBranch: dto.branch,
      },
    });

    return updatedTask;
  }

  async createIssueFromTask(dto: CreateGithubIssueDto, user: RequestUser) {
    const accessToken = await this.getAccessToken(user.id);

    const task = await this.prisma.task.findUnique({
      where: { id: dto.taskId },
    });

    if (!task) {
      throw new NotFoundException(ErrorCodes.TASK_NOT_FOUND);
    }

    const response = await fetch(`https://api.github.com/repos/${dto.repo}/issues`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/vnd.github.v3+json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        title: task.title,
        body: dto.body || task.description || '',
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      this.logger.error(`GitHub API error: ${JSON.stringify(error)}`);
      throw new BadRequestException(ErrorCodes.GITHUB_ERROR);
    }

    const issue = await response.json();

    // Update task with GitHub issue number
    await this.prisma.task.update({
      where: { id: dto.taskId },
      data: {
        githubRepo: dto.repo,
        githubIssueNumber: issue.number,
      },
    });

    return {
      issueNumber: issue.number,
      issueUrl: issue.html_url,
    };
  }

  async createBranchFromTask(dto: CreateGithubBranchDto, user: RequestUser) {
    const accessToken = await this.getAccessToken(user.id);

    const task = await this.prisma.task.findUnique({
      where: { id: dto.taskId },
    });

    if (!task) {
      throw new NotFoundException(ErrorCodes.TASK_NOT_FOUND);
    }

    // Get base branch SHA
    const baseBranch = dto.baseBranch || 'main';
    const refResponse = await fetch(
      `https://api.github.com/repos/${dto.repo}/git/ref/heads/${baseBranch}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: 'application/vnd.github.v3+json',
        },
      },
    );

    if (!refResponse.ok) {
      throw new BadRequestException(ErrorCodes.GITHUB_ERROR);
    }

    const ref = await refResponse.json();
    const sha = ref.object.sha;

    // Create new branch
    const createResponse = await fetch(
      `https://api.github.com/repos/${dto.repo}/git/refs`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: 'application/vnd.github.v3+json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ref: `refs/heads/${dto.branchName}`,
          sha,
        }),
      },
    );

    if (!createResponse.ok) {
      const error = await createResponse.json();
      this.logger.error(`GitHub API error: ${JSON.stringify(error)}`);
      throw new BadRequestException(ErrorCodes.GITHUB_ERROR);
    }

    // Update task with branch name
    await this.prisma.task.update({
      where: { id: dto.taskId },
      data: {
        githubRepo: dto.repo,
        githubBranch: dto.branchName,
      },
    });

    return {
      branchName: dto.branchName,
      branchUrl: `https://github.com/${dto.repo}/tree/${dto.branchName}`,
    };
  }

  async getTaskGithubInfo(taskId: string, user: RequestUser) {
    const task = await this.prisma.task.findUnique({
      where: { id: taskId },
      select: {
        id: true,
        githubRepo: true,
        githubIssueNumber: true,
        githubPrNumber: true,
        githubBranch: true,
      },
    });

    if (!task) {
      throw new NotFoundException(ErrorCodes.TASK_NOT_FOUND);
    }

    if (!task.githubRepo) {
      return { linked: false };
    }

    const result: any = {
      linked: true,
      repo: task.githubRepo,
    };

    // Fetch issue details if linked
    if (task.githubIssueNumber) {
      try {
        const accessToken = await this.getAccessToken(user.id);
        const issueResponse = await fetch(
          `https://api.github.com/repos/${task.githubRepo}/issues/${task.githubIssueNumber}`,
          {
            headers: {
              Authorization: `Bearer ${accessToken}`,
              Accept: 'application/vnd.github.v3+json',
            },
          },
        );

        if (issueResponse.ok) {
          const issue = await issueResponse.json();
          result.issue = {
            number: issue.number,
            title: issue.title,
            state: issue.state,
            url: issue.html_url,
          };
        }
      } catch (e) {
        // Ignore errors fetching issue details
      }
    }

    // Fetch PR details if linked
    if (task.githubPrNumber) {
      try {
        const accessToken = await this.getAccessToken(user.id);
        const prResponse = await fetch(
          `https://api.github.com/repos/${task.githubRepo}/pulls/${task.githubPrNumber}`,
          {
            headers: {
              Authorization: `Bearer ${accessToken}`,
              Accept: 'application/vnd.github.v3+json',
            },
          },
        );

        if (prResponse.ok) {
          const pr = await prResponse.json();
          result.pr = {
            number: pr.number,
            title: pr.title,
            state: pr.state,
            url: pr.html_url,
            merged: pr.merged,
          };
        }
      } catch (e) {
        // Ignore errors fetching PR details
      }
    }

    if (task.githubBranch) {
      result.branch = {
        name: task.githubBranch,
        url: `https://github.com/${task.githubRepo}/tree/${task.githubBranch}`,
      };
    }

    return result;
  }

  private async exchangeCodeForToken(code: string): Promise<GithubTokenResponse> {
    const response = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        client_id: this.clientId,
        client_secret: this.clientSecret,
        code,
        redirect_uri: this.redirectUri,
      }),
    });

    if (!response.ok) {
      throw new BadRequestException(ErrorCodes.GITHUB_ERROR);
    }

    const data = await response.json();

    if (data.error) {
      this.logger.error(`GitHub OAuth error: ${data.error_description}`);
      throw new BadRequestException(ErrorCodes.GITHUB_ERROR);
    }

    return data;
  }

  private async getGithubUser(accessToken: string): Promise<GithubUserResponse> {
    const response = await fetch('https://api.github.com/user', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/vnd.github.v3+json',
      },
    });

    if (!response.ok) {
      throw new BadRequestException(ErrorCodes.GITHUB_ERROR);
    }

    return response.json();
  }

  private async getAccessToken(userId: string): Promise<string> {
    const integration = await this.prisma.userIntegration.findUnique({
      where: {
        userId_provider: {
          userId,
          provider: IntegrationProvider.GITHUB,
        },
      },
    });

    if (!integration) {
      throw new BadRequestException(ErrorCodes.INTEGRATION_NOT_CONNECTED);
    }

    return CryptoUtil.decrypt(integration.accessTokenEncrypted);
  }
}

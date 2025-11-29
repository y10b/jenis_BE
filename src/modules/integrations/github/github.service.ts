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
  CreateIssueFromGitLogDto,
  GeneratePRTemplateDto,
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
    this.redirectUri = this.configService.get<string>('GITHUB_CALLBACK_URL') || '';
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

  /**
   * Git 이력 기반으로 GitHub 이슈 생성
   * KR2팀 전용 기능
   */
  async createIssueFromGitLog(dto: CreateIssueFromGitLogDto, user: RequestUser) {
    const accessToken = await this.getAccessToken(user.id);

    const issueBody = {
      title: dto.title,
      body: dto.body,
      labels: dto.labels || [],
    };

    const response = await fetch(`https://api.github.com/repos/${dto.repo}/issues`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/vnd.github.v3+json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(issueBody),
    });

    if (!response.ok) {
      const error = await response.json();
      this.logger.error(`GitHub API error: ${JSON.stringify(error)}`);
      throw new BadRequestException(ErrorCodes.GITHUB_ERROR);
    }

    const issue = await response.json();

    this.logger.log(`Issue created from git log: #${issue.number} by ${user.email}`);

    return {
      issueNumber: issue.number,
      issueUrl: issue.html_url,
      title: issue.title,
    };
  }

  /**
   * PR 템플릿 생성
   * 커밋 메시지와 변경 파일을 분석하여 PR 템플릿 생성
   */
  async generatePRTemplate(dto: GeneratePRTemplateDto, user: RequestUser) {
    const accessToken = await this.getAccessToken(user.id);
    const targetBranch = dto.targetBranch || 'main';

    // GitHub에서 비교 정보 가져오기 (commits, files)
    let commits = dto.commits || [];
    let changedFiles = dto.changedFiles || [];

    // 프론트에서 제공하지 않은 경우 GitHub API로 가져오기
    if (commits.length === 0 || changedFiles.length === 0) {
      try {
        const compareResponse = await fetch(
          `https://api.github.com/repos/${dto.repo}/compare/${targetBranch}...${dto.sourceBranch}`,
          {
            headers: {
              Authorization: `Bearer ${accessToken}`,
              Accept: 'application/vnd.github.v3+json',
            },
          },
        );

        if (compareResponse.ok) {
          const compareData = await compareResponse.json();

          if (commits.length === 0) {
            commits = compareData.commits?.map((c: any) => c.commit.message) || [];
          }

          if (changedFiles.length === 0) {
            changedFiles = compareData.files?.map((f: any) => f.filename) || [];
          }
        }
      } catch (e) {
        this.logger.warn(`Failed to fetch compare data: ${e}`);
      }
    }

    // 커밋 메시지 분석하여 변경 유형 파악
    const changeTypes = this.analyzeCommitMessages(commits);

    // 파일 변경 통계
    const fileStats = this.analyzeChangedFiles(changedFiles);

    // PR 템플릿 생성
    const template = this.buildPRTemplate({
      sourceBranch: dto.sourceBranch,
      targetBranch,
      commits,
      changedFiles,
      changeTypes,
      fileStats,
    });

    // PR 생성 URL 구성
    const prCreateUrl = `https://github.com/${dto.repo}/compare/${targetBranch}...${dto.sourceBranch}?expand=1`;

    return {
      template,
      prCreateUrl,
      summary: {
        totalCommits: commits.length,
        totalFiles: changedFiles.length,
        changeTypes,
        fileStats,
      },
    };
  }

  /**
   * 커밋 메시지 분석
   */
  private analyzeCommitMessages(commits: string[]): Record<string, number> {
    const types: Record<string, number> = {
      feat: 0,
      fix: 0,
      docs: 0,
      style: 0,
      refactor: 0,
      test: 0,
      chore: 0,
      other: 0,
    };

    for (const commit of commits) {
      const lowerCommit = commit.toLowerCase();
      if (lowerCommit.startsWith('feat') || lowerCommit.includes('feature')) {
        types.feat++;
      } else if (lowerCommit.startsWith('fix') || lowerCommit.includes('bug')) {
        types.fix++;
      } else if (lowerCommit.startsWith('docs') || lowerCommit.includes('document')) {
        types.docs++;
      } else if (lowerCommit.startsWith('style')) {
        types.style++;
      } else if (lowerCommit.startsWith('refactor')) {
        types.refactor++;
      } else if (lowerCommit.startsWith('test')) {
        types.test++;
      } else if (lowerCommit.startsWith('chore')) {
        types.chore++;
      } else {
        types.other++;
      }
    }

    // 0인 항목 제거
    return Object.fromEntries(Object.entries(types).filter(([_, v]) => v > 0));
  }

  /**
   * 변경 파일 분석
   */
  private analyzeChangedFiles(files: string[]): Record<string, number> {
    const stats: Record<string, number> = {};

    for (const file of files) {
      const ext = file.split('.').pop()?.toLowerCase() || 'other';
      stats[ext] = (stats[ext] || 0) + 1;
    }

    return stats;
  }

  /**
   * PR 템플릿 빌드
   */
  private buildPRTemplate(data: {
    sourceBranch: string;
    targetBranch: string;
    commits: string[];
    changedFiles: string[];
    changeTypes: Record<string, number>;
    fileStats: Record<string, number>;
  }): string {
    const { sourceBranch, targetBranch, commits, changedFiles, changeTypes, fileStats } = data;

    // PR 제목 추천
    const dominantType = Object.entries(changeTypes).sort((a, b) => b[1] - a[1])[0];
    const typePrefix = dominantType ? dominantType[0] : 'update';
    const branchName = sourceBranch.replace(/^(feature|fix|hotfix)\//, '').replace(/-/g, ' ');

    let template = `## ${typePrefix}: ${branchName}\n\n`;

    // 요약
    template += `### Summary\n`;
    template += `- **Branch**: \`${sourceBranch}\` → \`${targetBranch}\`\n`;
    template += `- **Commits**: ${commits.length}\n`;
    template += `- **Files Changed**: ${changedFiles.length}\n\n`;

    // 변경 유형
    if (Object.keys(changeTypes).length > 0) {
      template += `### Change Types\n`;
      for (const [type, count] of Object.entries(changeTypes)) {
        const emoji = this.getTypeEmoji(type);
        template += `- ${emoji} ${type}: ${count}\n`;
      }
      template += '\n';
    }

    // 커밋 목록
    if (commits.length > 0) {
      template += `### Commits\n`;
      for (const commit of commits.slice(0, 10)) {
        const firstLine = commit.split('\n')[0];
        template += `- ${firstLine}\n`;
      }
      if (commits.length > 10) {
        template += `- ... and ${commits.length - 10} more commits\n`;
      }
      template += '\n';
    }

    // 변경 파일 목록
    if (changedFiles.length > 0) {
      template += `### Changed Files\n`;
      template += `<details>\n<summary>View ${changedFiles.length} changed files</summary>\n\n`;
      for (const file of changedFiles.slice(0, 20)) {
        template += `- \`${file}\`\n`;
      }
      if (changedFiles.length > 20) {
        template += `- ... and ${changedFiles.length - 20} more files\n`;
      }
      template += `</details>\n\n`;
    }

    // 체크리스트
    template += `### Checklist\n`;
    template += `- [ ] 코드 리뷰 요청\n`;
    template += `- [ ] 테스트 완료\n`;
    template += `- [ ] 문서 업데이트 (필요한 경우)\n`;

    return template;
  }

  private getTypeEmoji(type: string): string {
    const emojis: Record<string, string> = {
      feat: '✨',
      fix: '🐛',
      docs: '📝',
      style: '💄',
      refactor: '♻️',
      test: '✅',
      chore: '🔧',
      other: '📦',
    };
    return emojis[type] || '📦';
  }

  /**
   * 리포지토리의 remote URL 조회
   */
  async getRepoRemoteUrl(repo: string, user: RequestUser) {
    const accessToken = await this.getAccessToken(user.id);

    const response = await fetch(`https://api.github.com/repos/${repo}`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/vnd.github.v3+json',
      },
    });

    if (!response.ok) {
      throw new BadRequestException(ErrorCodes.GITHUB_ERROR);
    }

    const repoData = await response.json();

    return {
      htmlUrl: repoData.html_url,
      cloneUrl: repoData.clone_url,
      sshUrl: repoData.ssh_url,
      defaultBranch: repoData.default_branch,
    };
  }

  /**
   * 브랜치 목록 조회
   */
  async getBranches(repo: string, user: RequestUser) {
    const accessToken = await this.getAccessToken(user.id);

    const response = await fetch(`https://api.github.com/repos/${repo}/branches?per_page=100`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/vnd.github.v3+json',
      },
    });

    if (!response.ok) {
      throw new BadRequestException(ErrorCodes.GITHUB_ERROR);
    }

    const branches = await response.json();
    return branches.map((b: any) => ({
      name: b.name,
      protected: b.protected,
    }));
  }

  /**
   * KR2팀 접근 권한 확인
   */
  async checkKr2Access(user: RequestUser) {
    // OWNER는 항상 접근 가능
    if (user.role === 'OWNER') {
      return { hasAccess: true, teamName: null, isOwner: true };
    }

    if (!user.teamId) {
      return { hasAccess: false, teamName: null, isOwner: false };
    }

    // 팀 이름 조회
    const team = await this.prisma.team.findUnique({
      where: { id: user.teamId },
      select: { name: true },
    });

    const isKr2Team = team?.name === 'KR2';

    return {
      hasAccess: isKr2Team,
      teamName: team?.name || null,
      teamId: user.teamId,
      isOwner: false,
    };
  }

  /**
   * 당일 생성/머지된 PR 목록 조회
   */
  async getTodayPRs(user: RequestUser, repo?: string) {
    const accessToken = await this.getAccessToken(user.id);
    const integration = await this.prisma.userIntegration.findUnique({
      where: {
        userId_provider: {
          userId: user.id,
          provider: IntegrationProvider.GITHUB,
        },
      },
    });

    if (!integration) {
      throw new BadRequestException(ErrorCodes.INTEGRATION_NOT_CONNECTED);
    }

    const username = integration.providerUsername;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayISO = today.toISOString().split('T')[0];

    // 특정 repo가 지정된 경우 해당 repo에서만 조회
    if (repo) {
      return this.fetchPRsFromRepo(accessToken, repo, username!, todayISO);
    }

    // repo 미지정시 사용자의 모든 repo에서 PR 조회
    const repos = await this.getRepositories(user);
    const allPRs: any[] = [];

    for (const r of repos.slice(0, 10)) {
      // 최근 업데이트된 10개 repo만
      try {
        const prs = await this.fetchPRsFromRepo(accessToken, r.fullName, username!, todayISO);
        allPRs.push(...prs);
      } catch (e) {
        // 개별 repo 에러는 무시
      }
    }

    return allPRs;
  }

  private async fetchPRsFromRepo(
    accessToken: string,
    repo: string,
    username: string,
    todayISO: string,
  ) {
    // 사용자가 작성한 PR 조회 (오늘 생성 또는 머지된 것)
    const searchQuery = `repo:${repo} author:${username} is:pr created:>=${todayISO}`;

    const response = await fetch(
      `https://api.github.com/search/issues?q=${encodeURIComponent(searchQuery)}&sort=created&order=desc`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: 'application/vnd.github.v3+json',
        },
      },
    );

    if (!response.ok) {
      return [];
    }

    const data = await response.json();

    return (data.items || []).map((pr: any) => ({
      number: pr.number,
      title: pr.title,
      url: pr.html_url,
      state: pr.state,
      createdAt: pr.created_at,
      repo: repo,
      labels: pr.labels?.map((l: any) => l.name) || [],
    }));
  }
}

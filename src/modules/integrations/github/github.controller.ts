import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Query,
  Param,
  ParseUUIDPipe,
  Res,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiExcludeEndpoint,
} from '@nestjs/swagger';
import type { Response } from 'express';
import { GithubService } from './github.service';
import { CurrentUser } from '../../../common/decorators';
import type { RequestUser } from '../../../common/interfaces';
import {
  GithubCallbackDto,
  LinkTaskGithubDto,
  CreateGithubIssueDto,
  CreateGithubBranchDto,
} from '../dto';
import { ConfigService } from '@nestjs/config';

/**
 * GitHub 통합 컨트롤러
 *
 * GitHub OAuth 연동 및 업무-GitHub 연결 기능을 제공합니다.
 * 업무에서 직접 GitHub 이슈를 생성하거나 브랜치를 만들 수 있습니다.
 */
@ApiTags('Integrations - GitHub')
@ApiBearerAuth('accessToken')
@Controller('integrations/github')
export class GithubController {
  constructor(
    private readonly githubService: GithubService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * GitHub 인증 URL 조회 API
   */
  @ApiOperation({
    summary: 'GitHub 연동 URL 조회',
    description: `
GitHub OAuth 인증을 시작하기 위한 URL을 반환합니다.

### 사용 방법
1. 이 API를 호출하여 authUrl을 받습니다
2. 사용자를 해당 URL로 리다이렉트합니다
3. GitHub에서 인증 후 callback으로 돌아옵니다
4. 연동 완료 후 /settings/integrations로 리다이렉트됩니다
    `,
  })
  @ApiResponse({
    status: 200,
    description: 'GitHub OAuth URL 반환',
    schema: {
      example: { authUrl: 'https://github.com/login/oauth/authorize?...' },
    },
  })
  @Get('auth')
  getAuthUrl(@CurrentUser() user: RequestUser) {
    const authUrl = this.githubService.getAuthUrl(user.id);
    return { authUrl };
  }

  /**
   * GitHub OAuth 콜백 처리 (내부용)
   */
  @ApiExcludeEndpoint()
  @Get('callback')
  async handleCallback(
    @Query() dto: GithubCallbackDto,
    @CurrentUser() user: RequestUser,
    @Res() res: Response,
  ) {
    await this.githubService.handleCallback(dto.code, user);

    const frontendUrl = this.configService.get<string>('app.frontendUrl') || 'http://localhost:3000';
    res.redirect(`${frontendUrl}/settings/integrations?github=success`);
  }

  /**
   * GitHub 연동 해제 API
   */
  @ApiOperation({
    summary: 'GitHub 연동 해제',
    description: `
GitHub 연동을 해제합니다.

### 주의사항
- 연동 해제 시 저장된 액세스 토큰이 삭제됩니다
- 기존에 연결된 업무-GitHub 링크는 유지되지만 동기화가 중단됩니다
- 다시 연동하려면 auth API를 통해 재인증해야 합니다
    `,
  })
  @ApiResponse({ status: 200, description: '연동 해제 성공' })
  @Delete()
  disconnect(@CurrentUser() user: RequestUser) {
    return this.githubService.disconnect(user);
  }

  /**
   * GitHub 연동 상태 조회 API
   */
  @ApiOperation({
    summary: 'GitHub 연동 상태 조회',
    description: `
현재 사용자의 GitHub 연동 상태를 조회합니다.

### 반환 정보
- connected: 연동 여부
- username: GitHub 사용자명 (연동된 경우)
- avatarUrl: GitHub 프로필 이미지 (연동된 경우)
    `,
  })
  @ApiResponse({
    status: 200,
    description: 'GitHub 연동 상태 반환',
    schema: {
      example: {
        connected: true,
        username: 'octocat',
        avatarUrl: 'https://github.com/images/octocat.png',
      },
    },
  })
  @Get('status')
  getStatus(@CurrentUser() user: RequestUser) {
    return this.githubService.getStatus(user);
  }

  /**
   * GitHub 리포지토리 목록 조회 API
   */
  @ApiOperation({
    summary: '리포지토리 목록 조회',
    description: `
연동된 GitHub 계정에서 접근 가능한 리포지토리 목록을 조회합니다.

### 반환 정보
- public 리포지토리
- 사용자가 접근 권한이 있는 private 리포지토리
    `,
  })
  @ApiResponse({ status: 200, description: '리포지토리 목록 반환' })
  @ApiResponse({ status: 400, description: 'GitHub 연동 필요' })
  @Get('repos')
  getRepositories(@CurrentUser() user: RequestUser) {
    return this.githubService.getRepositories(user);
  }

  /**
   * 업무-GitHub 연결 API
   */
  @ApiOperation({
    summary: '업무와 GitHub 연결',
    description: `
업무를 GitHub 리포지토리의 이슈, PR, 브랜치와 연결합니다.

### 연결 가능한 항목
- Issue: 기존 GitHub 이슈와 연결
- PR: Pull Request와 연결
- Branch: 작업 브랜치와 연결

### 사용 시나리오
- 이미 존재하는 GitHub 리소스를 업무에 연결할 때
- 새로 생성하려면 create-issue 또는 create-branch API 사용
    `,
  })
  @ApiResponse({ status: 201, description: '연결 성공' })
  @Post('link-task')
  linkTaskToGithub(
    @Body() dto: LinkTaskGithubDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.githubService.linkTaskToGithub(dto, user);
  }

  /**
   * 업무에서 GitHub 이슈 생성 API
   */
  @ApiOperation({
    summary: '업무에서 GitHub 이슈 생성',
    description: `
업무 정보를 기반으로 GitHub 이슈를 자동 생성합니다.

### 자동 설정 항목
- 이슈 제목: 업무 제목
- 이슈 본문: 업무 설명 또는 입력한 body

### 생성 후
- 생성된 이슈가 자동으로 업무에 연결됩니다
- 이슈 번호와 URL이 반환됩니다
    `,
  })
  @ApiResponse({ status: 201, description: '이슈 생성 및 연결 성공' })
  @Post('create-issue')
  createIssueFromTask(
    @Body() dto: CreateGithubIssueDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.githubService.createIssueFromTask(dto, user);
  }

  /**
   * 업무에서 GitHub 브랜치 생성 API
   */
  @ApiOperation({
    summary: '업무에서 GitHub 브랜치 생성',
    description: `
업무와 연결된 새 브랜치를 GitHub에 생성합니다.

### 권장 브랜치명 규칙
- feature/TASK-{id}-{description}
- fix/TASK-{id}-{description}
- hotfix/TASK-{id}-{description}

### 기준 브랜치
baseBranch를 지정하지 않으면 기본 브랜치(main/master)에서 생성됩니다.
    `,
  })
  @ApiResponse({ status: 201, description: '브랜치 생성 및 연결 성공' })
  @Post('create-branch')
  createBranchFromTask(
    @Body() dto: CreateGithubBranchDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.githubService.createBranchFromTask(dto, user);
  }

  /**
   * 업무의 GitHub 연결 정보 조회 API
   */
  @ApiOperation({
    summary: '업무의 GitHub 정보 조회',
    description: `
특정 업무에 연결된 GitHub 정보를 조회합니다.

### 반환 정보
- 연결된 리포지토리
- 연결된 이슈 정보 (번호, 상태, URL)
- 연결된 PR 정보 (번호, 상태, URL)
- 연결된 브랜치 정보
    `,
  })
  @ApiParam({ name: 'taskId', description: '업무 UUID' })
  @ApiResponse({ status: 200, description: 'GitHub 연결 정보 반환' })
  @Get('task/:taskId')
  getTaskGithubInfo(
    @Param('taskId', ParseUUIDPipe) taskId: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.githubService.getTaskGithubInfo(taskId, user);
  }
}

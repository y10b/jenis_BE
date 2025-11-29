import { IsString, IsOptional, IsInt, IsUUID } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * 업무-GitHub 연결 DTO
 *
 * 업무를 GitHub 리포지토리의 이슈, PR, 브랜치와 연결합니다.
 *
 * @example
 * ```json
 * {
 *   "taskId": "550e8400-e29b-41d4-a716-446655440000",
 *   "repo": "owner/repo-name",
 *   "issueNumber": 123,
 *   "prNumber": 456,
 *   "branch": "feature/task-123"
 * }
 * ```
 */
export class LinkTaskGithubDto {
  /**
   * 연결할 업무 ID
   */
  @ApiProperty({
    description: '연결할 업무의 UUID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsUUID()
  taskId: string;

  /**
   * GitHub 리포지토리 (owner/repo 형식)
   */
  @ApiProperty({
    description: 'GitHub 리포지토리 경로 (owner/repo 형식)',
    example: 'mycompany/backend-api',
  })
  @IsString()
  repo: string;

  /**
   * 연결할 이슈 번호 (선택)
   */
  @ApiPropertyOptional({
    description: '연결할 GitHub 이슈 번호',
    example: 123,
  })
  @IsOptional()
  @IsInt()
  issueNumber?: number;

  /**
   * 연결할 PR 번호 (선택)
   */
  @ApiPropertyOptional({
    description: '연결할 GitHub PR 번호',
    example: 456,
  })
  @IsOptional()
  @IsInt()
  prNumber?: number;

  /**
   * 연결할 브랜치명 (선택)
   */
  @ApiPropertyOptional({
    description: '연결할 GitHub 브랜치명',
    example: 'feature/task-123',
  })
  @IsOptional()
  @IsString()
  branch?: string;
}

/**
 * GitHub 이슈 생성 DTO
 *
 * 업무를 기반으로 GitHub 이슈를 자동 생성합니다.
 */
export class CreateGithubIssueDto {
  /**
   * 이슈를 생성할 업무 ID
   */
  @ApiProperty({
    description: '이슈를 생성할 업무의 UUID. 업무 제목이 이슈 제목이 됨',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsUUID()
  taskId: string;

  /**
   * GitHub 리포지토리
   */
  @ApiProperty({
    description: 'GitHub 리포지토리 경로 (owner/repo 형식)',
    example: 'mycompany/backend-api',
  })
  @IsString()
  repo: string;

  /**
   * 이슈 본문 (선택)
   */
  @ApiPropertyOptional({
    description: '이슈 본문. 미입력 시 업무 설명이 사용됨',
    example: '## 작업 내용\n- API 엔드포인트 구현\n- 테스트 작성',
  })
  @IsOptional()
  @IsString()
  body?: string;
}

/**
 * GitHub 브랜치 생성 DTO
 *
 * 업무와 연결된 새 브랜치를 GitHub에 생성합니다.
 */
export class CreateGithubBranchDto {
  /**
   * 브랜치를 생성할 업무 ID
   */
  @ApiProperty({
    description: '브랜치를 생성할 업무의 UUID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsUUID()
  taskId: string;

  /**
   * GitHub 리포지토리
   */
  @ApiProperty({
    description: 'GitHub 리포지토리 경로 (owner/repo 형식)',
    example: 'mycompany/backend-api',
  })
  @IsString()
  repo: string;

  /**
   * 생성할 브랜치명
   */
  @ApiProperty({
    description: '생성할 브랜치명',
    example: 'feature/TASK-123-user-authentication',
  })
  @IsString()
  branchName: string;

  /**
   * 기준 브랜치 (선택)
   */
  @ApiPropertyOptional({
    description: '브랜치를 생성할 기준 브랜치. 기본값: main 또는 master',
    example: 'develop',
    default: 'main',
  })
  @IsOptional()
  @IsString()
  baseBranch?: string;
}

/**
 * Git 이력 기반 이슈 생성 DTO
 *
 * Git 커밋 이력을 분석하여 GitHub 이슈를 자동 생성합니다.
 */
export class CreateIssueFromGitLogDto {
  /**
   * GitHub 리포지토리
   */
  @ApiProperty({
    description: 'GitHub 리포지토리 경로 (owner/repo 형식)',
    example: 'mycompany/backend-api',
  })
  @IsString()
  repo: string;

  /**
   * 이슈 제목
   */
  @ApiProperty({
    description: '이슈 제목',
    example: '[Feature] 사용자 인증 기능 구현',
  })
  @IsString()
  title: string;

  /**
   * 이슈 본문 (Git 이력 기반으로 생성된 내용)
   */
  @ApiProperty({
    description: '이슈 본문 (Git 이력 분석 결과 포함)',
    example: '## 관련 커밋\n- abc1234: 로그인 API 구현\n- def5678: 회원가입 API 구현',
  })
  @IsString()
  body: string;

  /**
   * 라벨 (선택)
   */
  @ApiPropertyOptional({
    description: '이슈에 추가할 라벨 목록',
    example: ['enhancement', 'documentation'],
  })
  @IsOptional()
  @IsString({ each: true })
  labels?: string[];
}

/**
 * PR 템플릿 생성 요청 DTO
 *
 * Git diff를 분석하여 PR 템플릿을 생성합니다.
 */
export class GeneratePRTemplateDto {
  /**
   * GitHub 리포지토리
   */
  @ApiProperty({
    description: 'GitHub 리포지토리 경로 (owner/repo 형식)',
    example: 'mycompany/backend-api',
  })
  @IsString()
  repo: string;

  /**
   * 소스 브랜치 (PR을 보낼 브랜치)
   */
  @ApiProperty({
    description: '소스 브랜치 (변경사항이 있는 브랜치)',
    example: 'feature/user-auth',
  })
  @IsString()
  sourceBranch: string;

  /**
   * 타겟 브랜치 (PR을 받을 브랜치)
   */
  @ApiPropertyOptional({
    description: '타겟 브랜치. 기본값: main',
    example: 'main',
    default: 'main',
  })
  @IsOptional()
  @IsString()
  targetBranch?: string;

  /**
   * 커밋 메시지 목록 (프론트에서 수집)
   */
  @ApiPropertyOptional({
    description: '분석할 커밋 메시지 목록',
    example: ['feat: 로그인 API 구현', 'fix: 토큰 만료 버그 수정'],
  })
  @IsOptional()
  @IsString({ each: true })
  commits?: string[];

  /**
   * 변경된 파일 목록 (프론트에서 수집)
   */
  @ApiPropertyOptional({
    description: '변경된 파일 경로 목록',
    example: ['src/auth/auth.service.ts', 'src/auth/auth.controller.ts'],
  })
  @IsOptional()
  @IsString({ each: true })
  changedFiles?: string[];
}

import {
  Controller,
  Get,
  Patch,
  Post,
  Body,
  Param,
  ParseUUIDPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import { UsersService } from './users.service';
import { UpdateUserDto, ChangePasswordDto } from './dto';
import { CurrentUser } from '../../common/decorators';
import type { RequestUser } from '../../common/interfaces';

/**
 * 사용자 관리 컨트롤러
 *
 * 사용자 프로필 조회 및 수정과 관련된 API를 처리합니다.
 * - 내 정보 조회/수정
 * - 비밀번호 변경
 * - 다른 사용자 정보 조회
 * - 팀원 목록 조회
 */
@ApiTags('Users')
@ApiBearerAuth('accessToken')
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  /**
   * 내 정보 조회 API
   *
   * 현재 로그인한 사용자의 상세 정보를 반환합니다.
   */
  @ApiOperation({
    summary: '내 정보 조회',
    description: `
현재 로그인한 사용자의 프로필 정보를 조회합니다.

### 반환 정보
- 기본 정보: ID, 이메일, 이름
- 역할 및 상태: role, status
- 소속 팀 정보
- 프로필 이미지 URL

### 사용 시나리오
- 프로필 페이지 렌더링
- 사용자 정보 확인
    `,
  })
  @ApiResponse({
    status: 200,
    description: '사용자 정보 반환',
    schema: {
      example: {
        success: true,
        data: {
          id: 'uuid',
          email: 'user@example.com',
          name: '홍길동',
          role: 'ACTOR',
          status: 'ACTIVE',
          teamId: 'team-uuid',
          profileImageUrl: null,
        },
      },
    },
  })
  @Get('me')
  async getMe(@CurrentUser() user: RequestUser) {
    return this.usersService.findById(user.id);
  }

  /**
   * 내 정보 수정 API
   *
   * 현재 로그인한 사용자의 프로필 정보를 수정합니다.
   */
  @ApiOperation({
    summary: '내 정보 수정',
    description: `
로그인한 사용자의 프로필 정보를 수정합니다.

### 수정 가능 항목
- 이름 (name)
- 프로필 이미지 URL (profileImageUrl)

### 주의사항
- 이메일, 역할, 팀 등은 이 API로 변경 불가
- 역할 변경은 관리자 API 사용 필요
    `,
  })
  @ApiResponse({
    status: 200,
    description: '수정된 사용자 정보 반환',
  })
  @Patch('me')
  async updateMe(@CurrentUser('id') userId: string, @Body() dto: UpdateUserDto) {
    return this.usersService.update(userId, dto);
  }

  /**
   * 비밀번호 변경 API
   *
   * 현재 비밀번호를 확인하고 새 비밀번호로 변경합니다.
   */
  @ApiOperation({
    summary: '비밀번호 변경',
    description: `
로그인한 사용자의 비밀번호를 변경합니다.

### 요구사항
- 현재 비밀번호 일치 확인 필수
- 새 비밀번호: 영문, 숫자, 특수문자 조합 8자 이상

### 보안 고려사항
- 비밀번호 변경 후에도 현재 세션 유지
- 다른 디바이스 로그아웃은 별도 처리 필요
    `,
  })
  @ApiResponse({
    status: 201,
    description: '비밀번호 변경 성공',
    schema: {
      example: {
        success: true,
        data: {
          message: '비밀번호가 변경되었습니다.',
        },
      },
    },
  })
  @ApiResponse({
    status: 401,
    description: '현재 비밀번호 불일치',
  })
  @Post('me/change-password')
  async changePassword(
    @CurrentUser('id') userId: string,
    @Body() dto: ChangePasswordDto,
  ) {
    return this.usersService.changePassword(userId, dto);
  }

  /**
   * 특정 사용자 조회 API
   *
   * 사용자 ID로 특정 사용자의 정보를 조회합니다.
   */
  @ApiOperation({
    summary: '특정 사용자 조회',
    description: `
사용자 ID로 특정 사용자의 정보를 조회합니다.

### 사용 시나리오
- 다른 사용자 프로필 보기
- 업무 담당자 정보 확인
- 팀원 상세 정보 조회

### 반환 정보
- 공개 프로필 정보만 반환
- 민감한 정보(비밀번호 등)는 제외
    `,
  })
  @ApiParam({
    name: 'id',
    description: '조회할 사용자 UUID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @ApiResponse({
    status: 200,
    description: '사용자 정보 반환',
  })
  @ApiResponse({
    status: 404,
    description: '사용자를 찾을 수 없음',
  })
  @Get(':id')
  async findById(@Param('id', ParseUUIDPipe) id: string) {
    return this.usersService.findById(id);
  }

  /**
   * 팀원 목록 조회 API
   *
   * 특정 팀에 소속된 모든 사용자 목록을 조회합니다.
   */
  @ApiOperation({
    summary: '팀원 목록 조회',
    description: `
특정 팀에 소속된 모든 사용자 목록을 조회합니다.

### 사용 시나리오
- 팀 페이지에서 팀원 목록 표시
- 업무 담당자 선택 시 팀원 목록 제공
- 팀 구성원 현황 파악

### 정렬
- 기본적으로 이름 순 정렬
    `,
  })
  @ApiParam({
    name: 'teamId',
    description: '팀 UUID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @ApiResponse({
    status: 200,
    description: '팀원 목록 반환',
    schema: {
      example: {
        success: true,
        data: [
          {
            id: 'uuid',
            email: 'user1@example.com',
            name: '홍길동',
            role: 'LEAD',
            profileImageUrl: null,
          },
          {
            id: 'uuid2',
            email: 'user2@example.com',
            name: '김철수',
            role: 'ACTOR',
            profileImageUrl: null,
          },
        ],
      },
    },
  })
  @Get('team/:teamId')
  async getTeamMembers(@Param('teamId', ParseUUIDPipe) teamId: string) {
    return this.usersService.getTeamMembers(teamId);
  }

  /**
   * 슬랙 보고서 템플릿 조회 API
   */
  @ApiOperation({
    summary: '슬랙 보고서 템플릿 조회',
    description: '로그인한 사용자의 슬랙 일일 보고서 템플릿을 조회합니다.',
  })
  @ApiResponse({
    status: 200,
    description: '템플릿 반환',
    schema: {
      example: {
        success: true,
        data: {
          template: ':o2: KR2팀 Key Results = ...',
        },
      },
    },
  })
  @Get('me/slack-template')
  async getSlackTemplate(@CurrentUser('id') userId: string) {
    return this.usersService.getSlackReportTemplate(userId);
  }

  /**
   * 슬랙 보고서 템플릿 저장 API
   */
  @ApiOperation({
    summary: '슬랙 보고서 템플릿 저장',
    description: '로그인한 사용자의 슬랙 일일 보고서 템플릿을 저장합니다.',
  })
  @ApiResponse({
    status: 201,
    description: '템플릿 저장 성공',
  })
  @Post('me/slack-template')
  async updateSlackTemplate(
    @CurrentUser('id') userId: string,
    @Body('template') template: string,
  ) {
    return this.usersService.updateSlackReportTemplate(userId, template);
  }
}

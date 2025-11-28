import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Query,
  ParseUUIDPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { AdminService } from './admin.service';
import {
  ApproveUserDto,
  RejectUserDto,
  UpdateUserRoleDto,
  UpdateUserTeamDto,
} from './dto';
import { Roles } from '../../common/decorators';
import { PaginationDto } from '../../common/dto';

/**
 * 관리자 컨트롤러
 *
 * OWNER 역할만 접근 가능한 관리자 전용 API입니다.
 * 사용자 관리, 승인/거절, 역할 및 팀 배정 등을 처리합니다.
 *
 * @requires OWNER 역할 필수
 */
@ApiTags('Admin')
@ApiBearerAuth('accessToken')
@Controller('admin')
@Roles(UserRole.OWNER)
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  /**
   * 전체 사용자 목록 조회
   *
   * 시스템에 등록된 모든 사용자를 페이지네이션하여 조회합니다.
   */
  @ApiOperation({
    summary: '전체 사용자 목록 조회',
    description: `
시스템의 모든 사용자를 조회합니다.

### 권한
- OWNER만 접근 가능

### 페이지네이션
- page: 페이지 번호 (기본값: 1)
- limit: 페이지당 항목 수 (기본값: 20)

### 사용 시나리오
- 관리자 대시보드에서 전체 사용자 현황 파악
- 사용자 검색 및 관리
    `,
  })
  @ApiQuery({ name: 'page', required: false, description: '페이지 번호', example: 1 })
  @ApiQuery({ name: 'limit', required: false, description: '페이지당 항목 수', example: 20 })
  @ApiResponse({
    status: 200,
    description: '사용자 목록 반환',
    schema: {
      example: {
        success: true,
        data: [
          {
            id: 'uuid',
            email: 'user@example.com',
            name: '홍길동',
            role: 'ACTOR',
            status: 'ACTIVE',
            teamId: 'team-uuid',
          },
        ],
        meta: {
          total: 100,
          page: 1,
          limit: 20,
          totalPages: 5,
        },
      },
    },
  })
  @Get('users')
  async getAllUsers(@Query() pagination: PaginationDto) {
    return this.adminService.getAllUsers(pagination);
  }

  /**
   * 승인 대기 사용자 목록 조회
   *
   * PENDING 상태의 사용자만 조회합니다.
   */
  @ApiOperation({
    summary: '승인 대기 사용자 조회',
    description: `
가입 신청 후 승인을 기다리는 사용자 목록을 조회합니다.

### 대상
- status가 PENDING인 사용자만 반환

### 사용 시나리오
- 관리자가 신규 가입 요청 확인
- 승인/거절 처리를 위한 목록 조회
    `,
  })
  @ApiResponse({
    status: 200,
    description: '대기 중인 사용자 목록 반환',
  })
  @Get('users/pending')
  async getPendingUsers(@Query() pagination: PaginationDto) {
    return this.adminService.getPendingUsers(pagination);
  }

  /**
   * 사용자 승인
   *
   * PENDING 상태의 사용자를 승인하고 역할 및 팀을 배정합니다.
   */
  @ApiOperation({
    summary: '사용자 승인',
    description: `
가입 신청한 사용자를 승인합니다.

### 필수 사항
- 역할(role) 지정 필수

### 선택 사항
- 팀(teamId) 배정

### 처리 후
- 사용자 상태: PENDING → ACTIVE
- 사용자에게 승인 알림 발송

### 사용 시나리오
1. 대기 목록에서 사용자 확인
2. 적절한 역할과 팀 선택
3. 승인 처리
    `,
  })
  @ApiParam({ name: 'id', description: '승인할 사용자 UUID' })
  @ApiResponse({
    status: 201,
    description: '승인 성공',
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
        },
      },
    },
  })
  @ApiResponse({ status: 404, description: '사용자를 찾을 수 없음' })
  @ApiResponse({ status: 400, description: '이미 승인된 사용자' })
  @Post('users/:id/approve')
  async approveUser(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ApproveUserDto,
  ) {
    return this.adminService.approveUser(id, dto);
  }

  /**
   * 사용자 거절
   *
   * PENDING 상태의 사용자 가입을 거절합니다.
   */
  @ApiOperation({
    summary: '사용자 거절',
    description: `
가입 신청한 사용자를 거절합니다.

### 처리 후
- 사용자 상태: PENDING → INACTIVE
- 선택적으로 거절 사유 기록

### 주의사항
- 거절된 사용자는 동일 이메일로 재가입 가능
    `,
  })
  @ApiParam({ name: 'id', description: '거절할 사용자 UUID' })
  @ApiResponse({ status: 201, description: '거절 처리 완료' })
  @Post('users/:id/reject')
  async rejectUser(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RejectUserDto,
  ) {
    return this.adminService.rejectUser(id, dto);
  }

  /**
   * 사용자 역할 변경
   *
   * 기존 사용자의 역할(권한)을 변경합니다.
   */
  @ApiOperation({
    summary: '사용자 역할 변경',
    description: `
사용자의 역할(권한 레벨)을 변경합니다.

### 역할 체계
| 역할 | 권한 |
|------|------|
| OWNER | 시스템 전체 관리 권한 |
| HEAD | 팀 관리 권한 |
| LEAD | 팀 내 업무 관리 권한 |
| ACTOR | 기본 사용자 권한 |

### 사용 시나리오
- 팀장 승진 시 ACTOR → LEAD
- 부서장 임명 시 LEAD → HEAD
    `,
  })
  @ApiParam({ name: 'id', description: '역할을 변경할 사용자 UUID' })
  @ApiResponse({ status: 200, description: '역할 변경 완료' })
  @Patch('users/:id/role')
  async updateUserRole(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateUserRoleDto,
  ) {
    return this.adminService.updateUserRole(id, dto);
  }

  /**
   * 사용자 팀 변경
   *
   * 사용자의 소속 팀을 변경합니다.
   */
  @ApiOperation({
    summary: '사용자 팀 변경',
    description: `
사용자의 소속 팀을 변경합니다.

### 동작
- teamId 제공: 해당 팀으로 이동
- teamId가 null: 팀에서 제외 (무소속)

### 사용 시나리오
- 팀 이동
- 팀에서 제외 처리
    `,
  })
  @ApiParam({ name: 'id', description: '팀을 변경할 사용자 UUID' })
  @ApiResponse({ status: 200, description: '팀 변경 완료' })
  @Patch('users/:id/team')
  async updateUserTeam(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateUserTeamDto,
  ) {
    return this.adminService.updateUserTeam(id, dto);
  }

  /**
   * 사용자 비활성화
   *
   * 사용자 계정을 비활성화합니다.
   */
  @ApiOperation({
    summary: '사용자 비활성화',
    description: `
사용자 계정을 비활성화합니다.

### 처리 후
- 상태: ACTIVE → INACTIVE
- 해당 사용자 로그인 불가
- 기존 데이터는 보존

### 사용 시나리오
- 퇴사자 계정 처리
- 일시적 계정 정지
    `,
  })
  @ApiParam({ name: 'id', description: '비활성화할 사용자 UUID' })
  @ApiResponse({ status: 201, description: '비활성화 완료' })
  @Post('users/:id/deactivate')
  async deactivateUser(@Param('id', ParseUUIDPipe) id: string) {
    return this.adminService.deactivateUser(id);
  }

  /**
   * 사용자 활성화
   *
   * 비활성화된 사용자 계정을 다시 활성화합니다.
   */
  @ApiOperation({
    summary: '사용자 활성화',
    description: `
비활성화된 사용자 계정을 다시 활성화합니다.

### 처리 후
- 상태: INACTIVE → ACTIVE
- 로그인 가능

### 사용 시나리오
- 복직자 계정 복구
- 정지 해제
    `,
  })
  @ApiParam({ name: 'id', description: '활성화할 사용자 UUID' })
  @ApiResponse({ status: 201, description: '활성화 완료' })
  @Post('users/:id/activate')
  async activateUser(@Param('id', ParseUUIDPipe) id: string) {
    return this.adminService.activateUser(id);
  }
}

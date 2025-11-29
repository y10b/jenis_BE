import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
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
import { TeamsService } from './teams.service';
import { CreateTeamDto, UpdateTeamDto, AddMemberDto, CreateTeamShareDto, UpdateTeamShareDto } from './dto';
import { CurrentUser, Roles } from '../../common/decorators';
import type { RequestUser } from '../../common/interfaces';
import { UserRole } from '@prisma/client';

/**
 * 팀 관리 컨트롤러
 *
 * 팀 생성, 조회, 수정, 삭제 및 팀원 관리와 관련된 API를 처리합니다.
 * 팀 간 공유 기능도 포함되어 있습니다.
 */
@ApiTags('Teams')
@ApiBearerAuth('accessToken')
@Controller('teams')
export class TeamsController {
  constructor(private readonly teamsService: TeamsService) {}

  /**
   * 팀 생성 API
   * OWNER 역할만 팀을 생성할 수 있습니다.
   */
  @ApiOperation({
    summary: '팀 생성',
    description: `
새로운 팀을 생성합니다.

### 권한
- OWNER만 접근 가능

### 사용 시나리오
- 조직 내 새로운 부서/팀 신설
- 프로젝트 팀 생성
    `,
  })
  @ApiResponse({
    status: 201,
    description: '팀 생성 성공',
    schema: {
      example: {
        success: true,
        data: {
          id: 'team-uuid',
          name: '개발팀',
          description: '백엔드 개발팀',
          ownerId: 'user-uuid',
        },
      },
    },
  })
  @Post()
  @Roles(UserRole.OWNER)
  create(@Body() dto: CreateTeamDto, @CurrentUser() user: RequestUser) {
    return this.teamsService.create(dto, user);
  }

  /**
   * 전체 팀 목록 조회 API
   */
  @ApiOperation({
    summary: '전체 팀 목록 조회',
    description: '시스템에 등록된 모든 팀 목록을 조회합니다.',
  })
  @ApiResponse({ status: 200, description: '팀 목록 반환' })
  @Get()
  findAll(@CurrentUser() user: RequestUser) {
    return this.teamsService.findAll(user);
  }

  /**
   * 내 팀 조회 API
   */
  @ApiOperation({
    summary: '내 팀 조회',
    description: '현재 로그인한 사용자가 소속된 팀 정보를 조회합니다.',
  })
  @ApiResponse({ status: 200, description: '소속 팀 정보 반환' })
  @Get('my-team')
  getMyTeam(@CurrentUser() user: RequestUser) {
    return this.teamsService.getMyTeam(user);
  }

  /**
   * 특정 팀 상세 조회 API
   */
  @ApiOperation({
    summary: '팀 상세 조회',
    description: '특정 팀의 상세 정보를 조회합니다.',
  })
  @ApiParam({ name: 'id', description: '팀 UUID' })
  @ApiResponse({ status: 200, description: '팀 상세 정보 반환' })
  @Get(':id')
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.teamsService.findOne(id, user);
  }

  /**
   * 팀 정보 수정 API
   */
  @ApiOperation({
    summary: '팀 정보 수정',
    description: `
팀의 이름, 설명, 소유자를 변경합니다.

### 권한
- OWNER만 접근 가능
    `,
  })
  @ApiParam({ name: 'id', description: '팀 UUID' })
  @ApiResponse({ status: 200, description: '팀 수정 성공' })
  @Patch(':id')
  @Roles(UserRole.OWNER)
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateTeamDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.teamsService.update(id, dto, user);
  }

  /**
   * 팀 삭제 API
   */
  @ApiOperation({
    summary: '팀 삭제',
    description: `
팀을 삭제합니다.

### 권한
- OWNER만 접근 가능

### 주의사항
- 팀원이 있는 경우 삭제 불가
- 관련 데이터 처리 필요
    `,
  })
  @ApiParam({ name: 'id', description: '팀 UUID' })
  @ApiResponse({ status: 200, description: '팀 삭제 성공' })
  @Delete(':id')
  @Roles(UserRole.OWNER)
  remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.teamsService.remove(id, user);
  }

  /**
   * 팀원 목록 조회 API
   */
  @ApiOperation({
    summary: '팀원 목록 조회',
    description: '특정 팀에 소속된 모든 팀원을 조회합니다.',
  })
  @ApiParam({ name: 'id', description: '팀 UUID' })
  @ApiResponse({ status: 200, description: '팀원 목록 반환' })
  @Get(':id/members')
  getMembers(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.teamsService.getTeamMembers(id, user);
  }

  /**
   * 팀원 추가 API
   */
  @ApiOperation({
    summary: '팀원 추가',
    description: `
팀에 새로운 멤버를 추가합니다.

### 권한
- OWNER, HEAD만 접근 가능
    `,
  })
  @ApiParam({ name: 'id', description: '팀 UUID' })
  @ApiResponse({ status: 201, description: '팀원 추가 성공' })
  @Post(':id/members')
  @Roles(UserRole.OWNER, UserRole.HEAD)
  addMember(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AddMemberDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.teamsService.addMember(id, dto, user);
  }

  /**
   * 팀원 제거 API
   */
  @ApiOperation({
    summary: '팀원 제거',
    description: `
팀에서 멤버를 제거합니다.

### 권한
- OWNER, HEAD만 접근 가능
    `,
  })
  @ApiParam({ name: 'id', description: '팀 UUID' })
  @ApiParam({ name: 'userId', description: '제거할 사용자 UUID' })
  @ApiResponse({ status: 200, description: '팀원 제거 성공' })
  @Delete(':id/members/:userId')
  @Roles(UserRole.OWNER, UserRole.HEAD)
  removeMember(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('userId', ParseUUIDPipe) userId: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.teamsService.removeMember(id, userId, user);
  }

  /**
   * 팀원 이동 API
   */
  @ApiOperation({
    summary: '팀원 다른 팀으로 이동',
    description: `
팀원을 다른 팀으로 이동합니다.

### 권한
- OWNER만 접근 가능
    `,
  })
  @ApiParam({ name: 'id', description: '현재 팀 UUID' })
  @ApiParam({ name: 'userId', description: '이동할 사용자 UUID' })
  @ApiParam({ name: 'toTeamId', description: '이동 대상 팀 UUID' })
  @ApiResponse({ status: 200, description: '팀원 이동 성공' })
  @Patch(':id/members/:userId/transfer/:toTeamId')
  @Roles(UserRole.OWNER)
  transferMember(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('userId', ParseUUIDPipe) userId: string,
    @Param('toTeamId', ParseUUIDPipe) toTeamId: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.teamsService.transferMember(id, userId, toTeamId, user);
  }

  // ==================== 팀 간 공유 API ====================

  /**
   * 팀 공유 설정 조회 API
   */
  @ApiOperation({
    summary: '팀 공유 설정 조회',
    description: '해당 팀이 다른 팀과 설정한 공유 목록을 조회합니다.',
  })
  @ApiParam({ name: 'id', description: '팀 UUID' })
  @ApiResponse({ status: 200, description: '공유 설정 목록 반환' })
  @Get(':id/shares')
  getShares(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.teamsService.getShares(id, user);
  }

  /**
   * 팀 간 공유 생성 API
   */
  @ApiOperation({
    summary: '팀 간 공유 생성',
    description: `
다른 팀에게 업무/스케줄 조회 권한을 부여합니다.

### 권한
- OWNER, HEAD만 접근 가능

### 공유 항목
- shareTasks: 업무 공유
- shareSchedules: 스케줄 공유
    `,
  })
  @ApiParam({ name: 'id', description: '현재 팀 UUID (공유 제공 팀)' })
  @ApiResponse({ status: 201, description: '공유 설정 생성 성공' })
  @Post(':id/shares')
  @Roles(UserRole.OWNER, UserRole.HEAD)
  createShare(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateTeamShareDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.teamsService.createShare(id, dto, user);
  }

  /**
   * 팀 공유 설정 수정 API
   */
  @ApiOperation({
    summary: '팀 공유 설정 수정',
    description: '기존 공유 설정의 공유 항목을 변경합니다.',
  })
  @ApiParam({ name: 'shareId', description: '공유 설정 UUID' })
  @ApiResponse({ status: 200, description: '공유 설정 수정 성공' })
  @Patch('shares/:shareId')
  @Roles(UserRole.OWNER, UserRole.HEAD)
  updateShare(
    @Param('shareId', ParseUUIDPipe) shareId: string,
    @Body() dto: UpdateTeamShareDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.teamsService.updateShare(shareId, dto, user);
  }

  /**
   * 팀 공유 해제 API
   */
  @ApiOperation({
    summary: '팀 공유 해제',
    description: '다른 팀과의 공유를 해제합니다.',
  })
  @ApiParam({ name: 'shareId', description: '공유 설정 UUID' })
  @ApiResponse({ status: 200, description: '공유 해제 성공' })
  @Delete('shares/:shareId')
  @Roles(UserRole.OWNER, UserRole.HEAD)
  removeShare(
    @Param('shareId', ParseUUIDPipe) shareId: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.teamsService.removeShare(shareId, user);
  }

  /**
   * 공유받은 업무 조회 API
   */
  @ApiOperation({
    summary: '공유받은 업무 조회',
    description: '다른 팀에서 공유해준 업무 목록을 조회합니다.',
  })
  @ApiParam({ name: 'id', description: '팀 UUID' })
  @ApiResponse({ status: 200, description: '공유받은 업무 목록 반환' })
  @Get(':id/shared-tasks')
  getSharedTasks(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.teamsService.getSharedTasks(id, user);
  }

  /**
   * 공유받은 스케줄 조회 API
   */
  @ApiOperation({
    summary: '공유받은 스케줄 조회',
    description: '다른 팀에서 공유해준 스케줄 목록을 조회합니다.',
  })
  @ApiParam({ name: 'id', description: '팀 UUID' })
  @ApiResponse({ status: 200, description: '공유받은 스케줄 목록 반환' })
  @Get(':id/shared-schedules')
  getSharedSchedules(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.teamsService.getSharedSchedules(id, user);
  }

  // ==================== 팀원별 작업량 통계 API ====================

  /**
   * 팀원별 작업량 통계 조회 API
   */
  @ApiOperation({
    summary: '팀원별 작업량 통계',
    description: `
팀원별 완료된 업무 수, 진행 중인 업무 수 등을 조회합니다.

### 반환 정보
- 팀원별 완료 업무 수
- 팀원별 진행 중 업무 수
- 팀원별 할당된 업무 수
- 팀원별 생성한 업무 수
    `,
  })
  @ApiParam({ name: 'id', description: '팀 UUID' })
  @ApiQuery({ name: 'days', description: '조회 기간 (일)', required: false })
  @ApiResponse({ status: 200, description: '팀원별 통계 반환' })
  @Get(':id/stats')
  getMemberStats(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('days') days?: string,
  ) {
    return this.teamsService.getMemberStats(id, days ? parseInt(days, 10) : 30);
  }

  /**
   * 팀원별 일별 작업량 통계 조회 API (그래프용)
   */
  @ApiOperation({
    summary: '팀원별 일별 작업량 통계 (그래프용)',
    description: '팀원별 일별 완료 업무 수를 조회합니다. 그래프 렌더링에 사용됩니다.',
  })
  @ApiParam({ name: 'id', description: '팀 UUID' })
  @ApiQuery({ name: 'days', description: '조회 기간 (일)', required: false })
  @ApiResponse({ status: 200, description: '팀원별 일별 통계 반환' })
  @Get(':id/stats/daily')
  getMemberDailyStats(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('days') days?: string,
  ) {
    return this.teamsService.getMemberDailyStats(id, days ? parseInt(days, 10) : 14);
  }
}

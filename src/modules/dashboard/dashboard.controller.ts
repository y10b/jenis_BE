import { Controller, Get, Query } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { DashboardService } from './dashboard.service';
import { DashboardQueryDto } from './dto';
import { CurrentUser, Roles } from '../../common/decorators';
import type { RequestUser } from '../../common/interfaces';
import { UserRole } from '@prisma/client';

/**
 * 대시보드 컨트롤러
 *
 * 업무 현황, 통계, 마감 임박 업무 등 대시보드 관련 데이터를 제공합니다.
 * 역할에 따라 조회 가능한 범위가 달라집니다.
 */
@ApiTags('Dashboard')
@ApiBearerAuth('accessToken')
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  /**
   * 전체 현황 조회 API
   */
  @ApiOperation({
    summary: '전체 현황 조회',
    description: `
조직 또는 팀의 전체 현황을 조회합니다.

### 권한
- OWNER: 전체 조직 현황 조회 가능
- HEAD: 소속 팀 현황 조회 가능
- LEAD: 담당 팀 현황 조회 가능

### 반환 정보
- 전체 업무 수
- 상태별 업무 분포
- 진행률 통계
    `,
  })
  @ApiResponse({ status: 200, description: '전체 현황 데이터 반환' })
  @Get('overview')
  @Roles(UserRole.OWNER, UserRole.HEAD, UserRole.LEAD)
  getOverview(
    @Query() query: DashboardQueryDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.dashboardService.getOverview(query, user);
  }

  /**
   * 내 대시보드 조회 API
   */
  @ApiOperation({
    summary: '내 대시보드 조회',
    description: `
현재 로그인한 사용자의 개인 대시보드를 조회합니다.

### 반환 정보
- 내가 담당한 업무 현황
- 최근 활동 내역
- 마감 임박 업무
    `,
  })
  @ApiResponse({ status: 200, description: '개인 대시보드 데이터 반환' })
  @Get('my')
  getMyDashboard(@CurrentUser() user: RequestUser) {
    return this.dashboardService.getMyDashboard(user);
  }

  /**
   * 업무 상태별 통계 조회 API
   */
  @ApiOperation({
    summary: '업무 상태별 통계',
    description: `
업무의 상태별 분포를 조회합니다.

### 상태 종류
- TODO: 대기 중
- IN_PROGRESS: 진행 중
- REVIEW: 검토 중
- DONE: 완료
- HOLD: 보류

### 필터링
- teamId로 특정 팀 필터링
- startDate, endDate로 기간 필터링
    `,
  })
  @ApiResponse({ status: 200, description: '업무 상태별 통계 반환' })
  @Get('tasks/stats')
  getTaskStats(
    @Query() query: DashboardQueryDto,
    @CurrentUser() user: RequestUser,
  ) {
    const teamFilter = query.teamId ? { teamId: query.teamId } : {};
    const dateFilter = this.buildDateFilter(query.startDate, query.endDate);
    return this.dashboardService.getTaskStatusStats(teamFilter, dateFilter);
  }

  /**
   * 업무 우선순위별 통계 조회 API
   */
  @ApiOperation({
    summary: '업무 우선순위별 통계',
    description: `
업무의 우선순위별 분포를 조회합니다.

### 우선순위 종류
- URGENT: 긴급
- HIGH: 높음
- NORMAL: 보통
- LOW: 낮음

### 필터링
- teamId로 특정 팀 필터링
- startDate, endDate로 기간 필터링
    `,
  })
  @ApiResponse({ status: 200, description: '업무 우선순위별 통계 반환' })
  @Get('tasks/priority')
  getPriorityStats(
    @Query() query: DashboardQueryDto,
    @CurrentUser() user: RequestUser,
  ) {
    const teamFilter = query.teamId ? { teamId: query.teamId } : {};
    const dateFilter = this.buildDateFilter(query.startDate, query.endDate);
    return this.dashboardService.getTaskPriorityStats(teamFilter, dateFilter);
  }

  /**
   * 마감 임박 업무 조회 API
   */
  @ApiOperation({
    summary: '마감 임박 업무 조회',
    description: `
마감일이 임박한 업무 목록을 조회합니다.

### 사용 시나리오
- 우선적으로 처리해야 할 업무 확인
- 일정 관리 및 리소스 배분

### 반환 정보
- 마감일 기준 정렬된 업무 목록
- 각 업무의 상세 정보
    `,
  })
  @ApiResponse({ status: 200, description: '마감 임박 업무 목록 반환' })
  @Get('tasks/upcoming')
  getUpcomingDeadlines(
    @Query() query: DashboardQueryDto,
    @CurrentUser() user: RequestUser,
  ) {
    const teamFilter = query.teamId ? { teamId: query.teamId } : {};
    return this.dashboardService.getUpcomingDeadlines(teamFilter, user);
  }

  /**
   * 팀별 통계 조회 API
   */
  @ApiOperation({
    summary: '팀별 통계 조회',
    description: `
각 팀의 업무 현황 통계를 조회합니다.

### 권한
- OWNER, HEAD만 접근 가능

### 반환 정보
- 팀별 업무 수
- 팀별 완료율
- 팀별 진행 현황
    `,
  })
  @ApiResponse({ status: 200, description: '팀별 통계 데이터 반환' })
  @Get('teams')
  @Roles(UserRole.OWNER, UserRole.HEAD)
  getTeamStats(@CurrentUser() user: RequestUser) {
    return this.dashboardService.getTeamStats(user);
  }

  private buildDateFilter(startDate?: string, endDate?: string) {
    if (!startDate && !endDate) {
      return {};
    }

    const dateFilter: any = {};

    if (startDate) {
      dateFilter.gte = new Date(startDate);
    }

    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      dateFilter.lte = end;
    }

    return { createdAt: dateFilter };
  }
}

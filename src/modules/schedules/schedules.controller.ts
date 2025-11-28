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
  ParseIntPipe,
  DefaultValuePipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { SchedulesService } from './schedules.service';
import {
  CreateScheduleDto,
  UpdateScheduleDto,
  ScheduleQueryDto,
} from './dto';
import { CurrentUser, Roles } from '../../common/decorators';
import type { RequestUser } from '../../common/interfaces';
import { UserRole } from '@prisma/client';

/**
 * 스케줄 관리 컨트롤러
 *
 * 회의, 리마인더, 리포트 등 다양한 스케줄의 CRUD 및 관리 기능을 제공합니다.
 * Cron 표현식을 통한 반복 스케줄과 일회성 스케줄 모두 지원합니다.
 */
@ApiTags('Schedules')
@ApiBearerAuth('accessToken')
@Controller('schedules')
export class SchedulesController {
  constructor(private readonly schedulesService: SchedulesService) {}

  /**
   * 스케줄 생성 API
   */
  @ApiOperation({
    summary: '스케줄 생성',
    description: `
새로운 스케줄을 생성합니다.

### 스케줄 유형
- MEETING: 회의
- REMINDER: 리마인더
- REPORT: 정기 리포트

### 반복 vs 일회성
- 반복: cronExpression 사용 (예: "0 10 * * 1")
- 일회성: scheduledAt 사용 (ISO 8601)
    `,
  })
  @ApiResponse({ status: 201, description: '스케줄 생성 성공' })
  @Post()
  create(@Body() dto: CreateScheduleDto, @CurrentUser() user: RequestUser) {
    return this.schedulesService.create(dto, user);
  }

  /**
   * 전체 스케줄 조회 API
   */
  @ApiOperation({
    summary: '전체 스케줄 조회',
    description: '필터링 및 페이지네이션을 적용하여 스케줄 목록을 조회합니다.',
  })
  @ApiResponse({ status: 200, description: '스케줄 목록 반환' })
  @Get()
  findAll(@Query() query: ScheduleQueryDto, @CurrentUser() user: RequestUser) {
    return this.schedulesService.findAll(query, user);
  }

  /**
   * 내 스케줄 조회 API
   */
  @ApiOperation({
    summary: '내 스케줄 조회',
    description: '현재 로그인한 사용자가 생성한 스케줄을 조회합니다.',
  })
  @ApiResponse({ status: 200, description: '내 스케줄 목록 반환' })
  @Get('my')
  getMySchedules(@Query() query: ScheduleQueryDto, @CurrentUser() user: RequestUser) {
    return this.schedulesService.getMySchedules(query, user);
  }

  /**
   * 예정된 스케줄 조회 API
   */
  @ApiOperation({
    summary: '예정된 스케줄 조회',
    description: '가까운 미래에 예정된 스케줄을 조회합니다.',
  })
  @ApiQuery({ name: 'limit', required: false, description: '조회할 개수', example: 10 })
  @ApiResponse({ status: 200, description: '예정된 스케줄 목록 반환' })
  @Get('upcoming')
  getUpcoming(
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
    @CurrentUser() user: RequestUser,
  ) {
    return this.schedulesService.getUpcoming(limit, user);
  }

  /**
   * 팀 스케줄 조회 API
   */
  @ApiOperation({
    summary: '팀 스케줄 조회',
    description: '특정 팀과 연관된 스케줄을 조회합니다.',
  })
  @ApiParam({ name: 'teamId', description: '팀 UUID' })
  @ApiResponse({ status: 200, description: '팀 스케줄 목록 반환' })
  @Get('team/:teamId')
  getTeamSchedules(
    @Param('teamId', ParseUUIDPipe) teamId: string,
    @Query() query: ScheduleQueryDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.schedulesService.getTeamSchedules(teamId, query, user);
  }

  /**
   * 스케줄 상세 조회 API
   */
  @ApiOperation({
    summary: '스케줄 상세 조회',
    description: '특정 스케줄의 상세 정보를 조회합니다.',
  })
  @ApiParam({ name: 'id', description: '스케줄 UUID' })
  @ApiResponse({ status: 200, description: '스케줄 상세 정보 반환' })
  @Get(':id')
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.schedulesService.findOne(id, user);
  }

  /**
   * 스케줄 수정 API
   */
  @ApiOperation({
    summary: '스케줄 수정',
    description: '스케줄의 정보를 수정합니다.',
  })
  @ApiParam({ name: 'id', description: '스케줄 UUID' })
  @ApiResponse({ status: 200, description: '스케줄 수정 성공' })
  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateScheduleDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.schedulesService.update(id, dto, user);
  }

  /**
   * 스케줄 활성화 토글 API
   */
  @ApiOperation({
    summary: '스케줄 활성화 토글',
    description: '스케줄의 활성화 상태를 반전시킵니다.',
  })
  @ApiParam({ name: 'id', description: '스케줄 UUID' })
  @ApiResponse({ status: 200, description: '토글 성공' })
  @Patch(':id/toggle')
  toggleActive(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.schedulesService.toggleActive(id, user);
  }

  /**
   * 스케줄 삭제 API
   */
  @ApiOperation({
    summary: '스케줄 삭제',
    description: '스케줄을 삭제합니다.',
  })
  @ApiParam({ name: 'id', description: '스케줄 UUID' })
  @ApiResponse({ status: 200, description: '스케줄 삭제 성공' })
  @Delete(':id')
  remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.schedulesService.remove(id, user);
  }
}

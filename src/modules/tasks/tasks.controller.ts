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
} from '@nestjs/swagger';
import { TasksService } from './tasks.service';
import {
  CreateTaskDto,
  UpdateTaskDto,
  TaskQueryDto,
  CreateTaskRelationDto,
  CreateCommentDto,
} from './dto';
import { CurrentUser } from '../../common/decorators';
import type { RequestUser } from '../../common/interfaces';

/**
 * 업무(Task) 관리 컨트롤러
 *
 * 업무의 생성, 조회, 수정, 삭제 및 관련 기능(댓글, 관계, 히스토리)을 처리합니다.
 */
@ApiTags('Tasks')
@ApiBearerAuth('accessToken')
@Controller('tasks')
export class TasksController {
  constructor(private readonly tasksService: TasksService) {}

  /**
   * 업무 생성 API
   */
  @ApiOperation({
    summary: '업무 생성',
    description: `
새로운 업무를 생성합니다.

### 필수 항목
- title: 업무 제목

### 선택 항목
- description, status, priority, dueDate, assigneeId, teamId

### 기본값
- status: TODO
- priority: MEDIUM
- teamId: 생성자의 소속 팀
    `,
  })
  @ApiResponse({ status: 201, description: '업무 생성 성공' })
  @Post()
  create(@Body() dto: CreateTaskDto, @CurrentUser() user: RequestUser) {
    return this.tasksService.create(dto, user);
  }

  /**
   * 전체 업무 목록 조회 API
   */
  @ApiOperation({
    summary: '전체 업무 조회',
    description: '필터링 및 페이지네이션을 적용하여 업무 목록을 조회합니다.',
  })
  @ApiResponse({ status: 200, description: '업무 목록 반환' })
  @Get()
  findAll(@Query() query: TaskQueryDto, @CurrentUser() user: RequestUser) {
    return this.tasksService.findAll(query, user);
  }

  /**
   * 내 업무 조회 API
   */
  @ApiOperation({
    summary: '내 업무 조회',
    description: '현재 로그인한 사용자가 담당자로 지정된 업무를 조회합니다.',
  })
  @ApiResponse({ status: 200, description: '내 업무 목록 반환' })
  @Get('my')
  getMyTasks(@Query() query: TaskQueryDto, @CurrentUser() user: RequestUser) {
    return this.tasksService.getMyTasks(query, user);
  }

  /**
   * 내가 생성한 업무 조회 API
   */
  @ApiOperation({
    summary: '내가 생성한 업무 조회',
    description: '현재 로그인한 사용자가 생성한 업무를 조회합니다.',
  })
  @ApiResponse({ status: 200, description: '생성한 업무 목록 반환' })
  @Get('created')
  getCreatedTasks(@Query() query: TaskQueryDto, @CurrentUser() user: RequestUser) {
    return this.tasksService.getCreatedTasks(query, user);
  }

  /**
   * 업무 상세 조회 API
   */
  @ApiOperation({
    summary: '업무 상세 조회',
    description: '특정 업무의 상세 정보(관계, 담당자, 생성자 포함)를 조회합니다.',
  })
  @ApiParam({ name: 'id', description: '업무 UUID' })
  @ApiResponse({ status: 200, description: '업무 상세 정보 반환' })
  @Get(':id')
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.tasksService.findOne(id, user);
  }

  /**
   * 업무 수정 API
   */
  @ApiOperation({
    summary: '업무 수정',
    description: '업무의 제목, 설명, 상태, 우선순위, 마감일, 담당자를 수정합니다.',
  })
  @ApiParam({ name: 'id', description: '업무 UUID' })
  @ApiResponse({ status: 200, description: '업무 수정 성공' })
  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateTaskDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.tasksService.update(id, dto, user);
  }

  /**
   * 업무 삭제 API
   */
  @ApiOperation({
    summary: '업무 삭제',
    description: '업무를 삭제합니다. 관련 댓글, 관계, 히스토리도 함께 삭제됩니다.',
  })
  @ApiParam({ name: 'id', description: '업무 UUID' })
  @ApiResponse({ status: 200, description: '업무 삭제 성공' })
  @Delete(':id')
  remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.tasksService.remove(id, user);
  }

  // ==================== 업무 관계 API ====================

  /**
   * 업무 관계 추가 API
   */
  @ApiOperation({
    summary: '업무 관계 추가',
    description: `
두 업무 간의 관계를 설정합니다.

### 관계 유형
- BLOCKS: 현재 업무가 대상 업무를 차단
- BLOCKED_BY: 현재 업무가 대상 업무에 의해 차단
- RELATES_TO: 관련 업무
- DUPLICATES: 중복 업무
    `,
  })
  @ApiParam({ name: 'id', description: '업무 UUID' })
  @ApiResponse({ status: 201, description: '관계 추가 성공' })
  @Post(':id/relations')
  addRelation(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateTaskRelationDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.tasksService.addRelation(id, dto, user);
  }

  /**
   * 업무 관계 삭제 API
   */
  @ApiOperation({
    summary: '업무 관계 삭제',
    description: '업무 간 관계를 삭제합니다.',
  })
  @ApiParam({ name: 'id', description: '업무 UUID' })
  @ApiParam({ name: 'relationId', description: '관계 UUID' })
  @ApiResponse({ status: 200, description: '관계 삭제 성공' })
  @Delete(':id/relations/:relationId')
  removeRelation(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('relationId', ParseUUIDPipe) relationId: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.tasksService.removeRelation(id, relationId, user);
  }

  // ==================== 업무 댓글 API ====================

  /**
   * 업무 댓글 조회 API
   */
  @ApiOperation({
    summary: '업무 댓글 조회',
    description: '특정 업무의 모든 댓글을 조회합니다.',
  })
  @ApiParam({ name: 'id', description: '업무 UUID' })
  @ApiResponse({ status: 200, description: '댓글 목록 반환' })
  @Get(':id/comments')
  getComments(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.tasksService.getComments(id, user);
  }

  /**
   * 업무 댓글 추가 API
   */
  @ApiOperation({
    summary: '업무 댓글 추가',
    description: '업무에 새로운 댓글을 작성합니다.',
  })
  @ApiParam({ name: 'id', description: '업무 UUID' })
  @ApiResponse({ status: 201, description: '댓글 추가 성공' })
  @Post(':id/comments')
  addComment(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateCommentDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.tasksService.addComment(id, dto, user);
  }

  /**
   * 업무 댓글 삭제 API
   */
  @ApiOperation({
    summary: '업무 댓글 삭제',
    description: '업무에서 댓글을 삭제합니다. 본인이 작성한 댓글만 삭제 가능합니다.',
  })
  @ApiParam({ name: 'id', description: '업무 UUID' })
  @ApiParam({ name: 'commentId', description: '댓글 UUID' })
  @ApiResponse({ status: 200, description: '댓글 삭제 성공' })
  @Delete(':id/comments/:commentId')
  removeComment(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('commentId', ParseUUIDPipe) commentId: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.tasksService.removeComment(id, commentId, user);
  }

  // ==================== 업무 히스토리 API ====================

  /**
   * 업무 변경 이력 조회 API
   */
  @ApiOperation({
    summary: '업무 변경 이력 조회',
    description: '업무의 상태, 담당자, 우선순위 등 변경 이력을 조회합니다.',
  })
  @ApiParam({ name: 'id', description: '업무 UUID' })
  @ApiResponse({ status: 200, description: '변경 이력 반환' })
  @Get(':id/history')
  getHistory(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.tasksService.getHistory(id, user);
  }
}

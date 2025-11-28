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
import { RetrospectivesService } from './retrospectives.service';
import {
  CreateRetrospectiveDto,
  UpdateRetrospectiveDto,
  RetrospectiveQueryDto,
  ShareRetrospectiveDto,
} from './dto';
import { CurrentUser } from '../../common/decorators';
import type { RequestUser } from '../../common/interfaces';

/**
 * 회고 컨트롤러
 *
 * 개인 및 팀 회고를 관리합니다.
 * 일간, 주간, 월간, 프로젝트별 회고를 작성하고 공유할 수 있습니다.
 */
@ApiTags('Retrospectives')
@ApiBearerAuth('accessToken')
@Controller('retrospectives')
export class RetrospectivesController {
  constructor(private readonly retrospectivesService: RetrospectivesService) {}

  /**
   * 회고 생성 API
   */
  @ApiOperation({
    summary: '회고 작성',
    description: `
새로운 회고를 작성합니다.

### 회고 유형
- DAILY: 일간 회고
- WEEKLY: 주간 회고
- MONTHLY: 월간 회고
- PROJECT: 프로젝트 회고

### 공개 범위
- PRIVATE: 본인만 열람 가능
- TEAM: 소속 팀원 열람 가능
- PUBLIC: 전체 공개

### 임시저장
isDraft를 true로 설정하면 임시저장됩니다.
발행하려면 publish API를 호출하세요.
    `,
  })
  @ApiResponse({ status: 201, description: '회고 생성 성공' })
  @Post()
  create(
    @Body() dto: CreateRetrospectiveDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.retrospectivesService.create(dto, user);
  }

  /**
   * 회고 전체 조회 API
   */
  @ApiOperation({
    summary: '회고 목록 조회',
    description: `
접근 가능한 모든 회고를 조회합니다.

### 조회 범위
- 본인이 작성한 회고
- 공개 범위가 TEAM인 팀원 회고
- 공개 범위가 PUBLIC인 전체 회고
- 직접 공유받은 회고

### 필터링
유형, 공개 범위, 기간 등으로 필터링 가능합니다.
    `,
  })
  @ApiResponse({ status: 200, description: '회고 목록 반환' })
  @Get()
  findAll(
    @Query() query: RetrospectiveQueryDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.retrospectivesService.findAll(query, user);
  }

  /**
   * 내 회고 조회 API
   */
  @ApiOperation({
    summary: '내 회고 조회',
    description: '본인이 작성한 회고만 조회합니다. 임시저장 포함.',
  })
  @ApiResponse({ status: 200, description: '내 회고 목록 반환' })
  @Get('my')
  findMy(
    @Query() query: RetrospectiveQueryDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.retrospectivesService.findMy(query, user);
  }

  /**
   * 공유받은 회고 조회 API
   */
  @ApiOperation({
    summary: '공유받은 회고 조회',
    description: '다른 사람이 나에게 직접 공유한 회고 목록을 조회합니다.',
  })
  @ApiResponse({ status: 200, description: '공유받은 회고 목록 반환' })
  @Get('shared-with-me')
  getSharedWithMe(
    @Query() query: RetrospectiveQueryDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.retrospectivesService.getSharedWithMe(query, user);
  }

  /**
   * 회고 상세 조회 API
   */
  @ApiOperation({
    summary: '회고 상세 조회',
    description: '특정 회고의 상세 내용을 조회합니다.',
  })
  @ApiParam({ name: 'id', description: '회고 UUID' })
  @ApiResponse({ status: 200, description: '회고 상세 정보 반환' })
  @ApiResponse({ status: 404, description: '회고를 찾을 수 없음' })
  @Get(':id')
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.retrospectivesService.findOne(id, user);
  }

  /**
   * 회고 수정 API
   */
  @ApiOperation({
    summary: '회고 수정',
    description: '회고 내용을 수정합니다. 본인이 작성한 회고만 수정 가능합니다.',
  })
  @ApiParam({ name: 'id', description: '회고 UUID' })
  @ApiResponse({ status: 200, description: '수정 성공' })
  @ApiResponse({ status: 403, description: '수정 권한 없음' })
  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateRetrospectiveDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.retrospectivesService.update(id, dto, user);
  }

  /**
   * 회고 삭제 API
   */
  @ApiOperation({
    summary: '회고 삭제',
    description: '회고를 삭제합니다. 본인이 작성한 회고만 삭제 가능합니다.',
  })
  @ApiParam({ name: 'id', description: '회고 UUID' })
  @ApiResponse({ status: 200, description: '삭제 성공' })
  @ApiResponse({ status: 403, description: '삭제 권한 없음' })
  @Delete(':id')
  remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.retrospectivesService.remove(id, user);
  }

  /**
   * 회고 발행 API
   */
  @ApiOperation({
    summary: '회고 발행',
    description: `
임시저장된 회고를 정식 발행합니다.

### 발행 시 동작
- isDraft가 false로 변경됨
- 공개 범위에 따라 다른 사용자에게 노출됨
- 발행 후에도 수정/삭제 가능
    `,
  })
  @ApiParam({ name: 'id', description: '회고 UUID' })
  @ApiResponse({ status: 200, description: '발행 성공' })
  @Post(':id/publish')
  publish(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.retrospectivesService.publish(id, user);
  }

  /**
   * 회고 공유 API (기존 공유 대체)
   */
  @ApiOperation({
    summary: '회고 공유 (대체)',
    description: `
회고를 특정 사용자나 팀에게 공유합니다.
기존 공유 목록을 새로운 목록으로 대체합니다.

### 공유 대상
- userIds: 개별 사용자에게 공유
- teamIds: 팀 전체에게 공유
    `,
  })
  @ApiParam({ name: 'id', description: '회고 UUID' })
  @ApiResponse({ status: 200, description: '공유 설정 성공' })
  @Post(':id/share')
  share(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ShareRetrospectiveDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.retrospectivesService.share(id, dto, user);
  }

  /**
   * 회고 공유 추가 API
   */
  @ApiOperation({
    summary: '회고 공유 추가',
    description: '기존 공유 목록에 새로운 사용자/팀을 추가합니다.',
  })
  @ApiParam({ name: 'id', description: '회고 UUID' })
  @ApiResponse({ status: 201, description: '공유 추가 성공' })
  @Post(':id/shares')
  addShare(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ShareRetrospectiveDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.retrospectivesService.addShare(id, dto, user);
  }

  /**
   * 회고 공유 취소 API
   */
  @ApiOperation({
    summary: '회고 공유 취소',
    description: '특정 공유를 취소합니다.',
  })
  @ApiParam({ name: 'id', description: '회고 UUID' })
  @ApiParam({ name: 'shareId', description: '공유 UUID' })
  @ApiResponse({ status: 200, description: '공유 취소 성공' })
  @Delete(':id/shares/:shareId')
  removeShare(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('shareId', ParseUUIDPipe) shareId: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.retrospectivesService.removeShare(id, shareId, user);
  }
}

import {
  Controller,
  Get,
  Post,
  Delete,
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
import { NotificationsService } from './notifications.service';
import { NotificationQueryDto } from './dto';
import { CurrentUser } from '../../common/decorators';
import type { RequestUser } from '../../common/interfaces';

/**
 * 알림 관리 컨트롤러
 *
 * 사용자별 알림 조회, 읽음 처리, 삭제 기능을 제공합니다.
 * 실시간 알림은 WebSocket(Socket.IO)을 통해 별도로 전달됩니다.
 */
@ApiTags('Notifications')
@ApiBearerAuth('accessToken')
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  /**
   * 알림 목록 조회 API
   */
  @ApiOperation({
    summary: '알림 목록 조회',
    description: '현재 사용자의 알림 목록을 조회합니다. 읽지 않은 알림만 필터링 가능합니다.',
  })
  @ApiResponse({ status: 200, description: '알림 목록 반환' })
  @Get()
  findAll(@Query() query: NotificationQueryDto, @CurrentUser() user: RequestUser) {
    return this.notificationsService.findAll(query, user);
  }

  /**
   * 읽지 않은 알림 수 조회 API
   */
  @ApiOperation({
    summary: '읽지 않은 알림 수 조회',
    description: '현재 사용자의 읽지 않은 알림 개수를 반환합니다.',
  })
  @ApiResponse({
    status: 200,
    description: '읽지 않은 알림 수 반환',
    schema: { example: { success: true, data: { count: 5 } } },
  })
  @Get('unread-count')
  getUnreadCount(@CurrentUser() user: RequestUser) {
    return this.notificationsService.getUnreadCount(user);
  }

  /**
   * 특정 알림 조회 API
   */
  @ApiOperation({
    summary: '알림 상세 조회',
    description: '특정 알림의 상세 정보를 조회합니다.',
  })
  @ApiParam({ name: 'id', description: '알림 UUID' })
  @ApiResponse({ status: 200, description: '알림 상세 정보 반환' })
  @Get(':id')
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.notificationsService.findOne(id, user);
  }

  /**
   * 알림 읽음 처리 API
   */
  @ApiOperation({
    summary: '알림 읽음 처리',
    description: '특정 알림을 읽음 상태로 변경합니다.',
  })
  @ApiParam({ name: 'id', description: '알림 UUID' })
  @ApiResponse({ status: 201, description: '읽음 처리 성공' })
  @Post(':id/read')
  markAsRead(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.notificationsService.markAsRead(id, user);
  }

  /**
   * 모든 알림 읽음 처리 API
   */
  @ApiOperation({
    summary: '모든 알림 읽음 처리',
    description: '현재 사용자의 모든 알림을 읽음 상태로 변경합니다.',
  })
  @ApiResponse({ status: 201, description: '모든 알림 읽음 처리 성공' })
  @Post('read-all')
  markAllAsRead(@CurrentUser() user: RequestUser) {
    return this.notificationsService.markAllAsRead(user);
  }

  /**
   * 알림 삭제 API
   */
  @ApiOperation({
    summary: '알림 삭제',
    description: '특정 알림을 삭제합니다.',
  })
  @ApiParam({ name: 'id', description: '알림 UUID' })
  @ApiResponse({ status: 200, description: '알림 삭제 성공' })
  @Delete(':id')
  remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.notificationsService.remove(id, user);
  }

  /**
   * 모든 알림 삭제 API
   */
  @ApiOperation({
    summary: '모든 알림 삭제',
    description: '현재 사용자의 모든 알림을 삭제합니다.',
  })
  @ApiResponse({ status: 200, description: '모든 알림 삭제 성공' })
  @Delete()
  removeAll(@CurrentUser() user: RequestUser) {
    return this.notificationsService.removeAll(user);
  }
}

import { Injectable, NotFoundException, Logger, Inject, forwardRef } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { CreateNotificationDto, NotificationQueryDto } from './dto';
import { ErrorCodes } from '../../common/constants';
import { RequestUser } from '../../common/interfaces';
import { Prisma } from '@prisma/client';
import { NotificationsGateway } from './notifications.gateway';

export enum NotificationType {
  TASK_ASSIGNED = 'TASK_ASSIGNED',
  TASK_UPDATED = 'TASK_UPDATED',
  TASK_COMPLETED = 'TASK_COMPLETED',
  TASK_COMMENT = 'TASK_COMMENT',
  TASK_DUE_SOON = 'TASK_DUE_SOON',
  TASK_OVERDUE = 'TASK_OVERDUE',
  TEAM_INVITE = 'TEAM_INVITE',
  TEAM_REMOVED = 'TEAM_REMOVED',
  USER_APPROVED = 'USER_APPROVED',
  USER_REJECTED = 'USER_REJECTED',
  MENTION = 'MENTION',
  SYSTEM = 'SYSTEM',
  SCHEDULE_REMINDER = 'SCHEDULE_REMINDER',
}

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private prisma: PrismaService,
    @Inject(forwardRef(() => NotificationsGateway))
    private notificationsGateway: NotificationsGateway,
  ) {}

  async create(dto: CreateNotificationDto, sendRealtime: boolean = true) {
    const notification = await this.prisma.notification.create({
      data: {
        userId: dto.userId,
        type: dto.type,
        title: dto.title,
        content: dto.content,
        payload: dto.payload || {},
      },
    });

    // Send real-time notification via WebSocket
    if (sendRealtime) {
      this.notificationsGateway.sendToUser(dto.userId, notification);
    }

    this.logger.log(`Notification created: ${dto.type} for user ${dto.userId}`);

    return notification;
  }

  async createMany(notifications: CreateNotificationDto[], sendRealtime: boolean = true) {
    const result = await this.prisma.notification.createMany({
      data: notifications.map((n) => ({
        userId: n.userId,
        type: n.type,
        title: n.title,
        content: n.content,
        payload: n.payload || {},
      })),
    });

    // Send real-time notifications via WebSocket
    if (sendRealtime) {
      for (const dto of notifications) {
        this.notificationsGateway.sendToUser(dto.userId, {
          type: dto.type,
          title: dto.title,
          content: dto.content,
          payload: dto.payload,
          createdAt: new Date().toISOString(),
        });
      }
    }

    this.logger.log(`Created ${result.count} notifications`);

    return result;
  }

  async findAll(query: NotificationQueryDto, user: RequestUser) {
    const { unreadOnly, type, page = 1, limit = 20 } = query;

    const where: Prisma.NotificationWhereInput = {
      userId: user.id,
      ...(unreadOnly ? { isRead: false } : {}),
      ...(type ? { type } : {}),
    };

    const [notifications, total, unreadCount] = await Promise.all([
      this.prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.notification.count({ where }),
      this.prisma.notification.count({
        where: { userId: user.id, isRead: false },
      }),
    ]);

    return {
      data: notifications,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        unreadCount,
      },
    };
  }

  async findOne(id: string, user: RequestUser) {
    const notification = await this.prisma.notification.findFirst({
      where: { id, userId: user.id },
    });

    if (!notification) {
      throw new NotFoundException(ErrorCodes.NOT_FOUND);
    }

    return notification;
  }

  async markAsRead(id: string, user: RequestUser) {
    const notification = await this.prisma.notification.findFirst({
      where: { id, userId: user.id },
    });

    if (!notification) {
      throw new NotFoundException(ErrorCodes.NOT_FOUND);
    }

    const updated = await this.prisma.notification.update({
      where: { id },
      data: {
        isRead: true,
        readAt: new Date(),
      },
    });

    return updated;
  }

  async markAllAsRead(user: RequestUser) {
    const result = await this.prisma.notification.updateMany({
      where: { userId: user.id, isRead: false },
      data: {
        isRead: true,
        readAt: new Date(),
      },
    });

    return { count: result.count, message: `${result.count}개의 알림을 읽음 처리했습니다.` };
  }

  async remove(id: string, user: RequestUser) {
    const notification = await this.prisma.notification.findFirst({
      where: { id, userId: user.id },
    });

    if (!notification) {
      throw new NotFoundException(ErrorCodes.NOT_FOUND);
    }

    await this.prisma.notification.delete({ where: { id } });

    return { message: '알림이 삭제되었습니다.' };
  }

  async removeAll(user: RequestUser) {
    const result = await this.prisma.notification.deleteMany({
      where: { userId: user.id },
    });

    return { count: result.count, message: `${result.count}개의 알림을 삭제했습니다.` };
  }

  async getUnreadCount(user: RequestUser) {
    const count = await this.prisma.notification.count({
      where: { userId: user.id, isRead: false },
    });

    return { count };
  }

  // Helper methods for creating specific notification types
  async notifyTaskAssigned(taskId: string, taskTitle: string, assigneeId: string, assignerName: string) {
    return this.create({
      userId: assigneeId,
      type: NotificationType.TASK_ASSIGNED,
      title: '새 Task가 할당되었습니다',
      content: `${assignerName}님이 "${taskTitle}" Task를 할당했습니다.`,
      payload: { taskId },
    });
  }

  async notifyTaskUpdated(taskId: string, taskTitle: string, userId: string, updaterName: string, changes: string) {
    return this.create({
      userId,
      type: NotificationType.TASK_UPDATED,
      title: 'Task가 업데이트되었습니다',
      content: `${updaterName}님이 "${taskTitle}"을(를) 업데이트했습니다. ${changes}`,
      payload: { taskId },
    });
  }

  async notifyTaskCompleted(taskId: string, taskTitle: string, userId: string, completerName: string) {
    return this.create({
      userId,
      type: NotificationType.TASK_COMPLETED,
      title: 'Task가 완료되었습니다',
      content: `${completerName}님이 "${taskTitle}"을(를) 완료했습니다.`,
      payload: { taskId },
    });
  }

  async notifyTaskComment(taskId: string, taskTitle: string, userId: string, commenterName: string, commentPreview: string) {
    return this.create({
      userId,
      type: NotificationType.TASK_COMMENT,
      title: '새 댓글이 달렸습니다',
      content: `${commenterName}님이 "${taskTitle}"에 댓글을 남겼습니다: ${commentPreview}`,
      payload: { taskId },
    });
  }

  async notifyTaskDueSoon(taskId: string, taskTitle: string, userId: string, dueDate: Date) {
    const dueDateStr = dueDate.toLocaleDateString('ko-KR');
    return this.create({
      userId,
      type: NotificationType.TASK_DUE_SOON,
      title: 'Task 마감일이 다가옵니다',
      content: `"${taskTitle}" Task가 ${dueDateStr}에 마감됩니다.`,
      payload: { taskId, dueDate: dueDate.toISOString() },
    });
  }

  async notifyTaskOverdue(taskId: string, taskTitle: string, userId: string) {
    return this.create({
      userId,
      type: NotificationType.TASK_OVERDUE,
      title: 'Task 마감일이 지났습니다',
      content: `"${taskTitle}" Task의 마감일이 지났습니다. 확인해주세요.`,
      payload: { taskId },
    });
  }

  async notifyUserApproved(userId: string) {
    return this.create({
      userId,
      type: NotificationType.USER_APPROVED,
      title: '가입이 승인되었습니다',
      content: '관리자가 가입 신청을 승인했습니다. 이제 서비스를 이용하실 수 있습니다.',
      payload: {},
    });
  }

  async notifyUserRejected(userId: string, reason?: string) {
    return this.create({
      userId,
      type: NotificationType.USER_REJECTED,
      title: '가입이 거절되었습니다',
      content: reason || '관리자가 가입 신청을 거절했습니다.',
      payload: {},
    });
  }

  async notifyTeamInvite(userId: string, teamName: string, inviterName: string) {
    return this.create({
      userId,
      type: NotificationType.TEAM_INVITE,
      title: '팀에 초대되었습니다',
      content: `${inviterName}님이 "${teamName}" 팀에 초대했습니다.`,
      payload: { teamName },
    });
  }

  async notifyTeamRemoved(userId: string, teamName: string) {
    return this.create({
      userId,
      type: NotificationType.TEAM_REMOVED,
      title: '팀에서 제외되었습니다',
      content: `"${teamName}" 팀에서 제외되었습니다.`,
      payload: { teamName },
    });
  }

  async notifyScheduleReminder(userId: string, scheduleTitle: string, scheduleType: string, scheduledAt: Date) {
    const scheduledAtStr = scheduledAt.toLocaleString('ko-KR');
    return this.create({
      userId,
      type: NotificationType.SCHEDULE_REMINDER,
      title: '스케줄 알림',
      content: `"${scheduleTitle}" ${scheduleType}이(가) ${scheduledAtStr}에 예정되어 있습니다.`,
      payload: { scheduleTitle, scheduleType, scheduledAt: scheduledAt.toISOString() },
    });
  }
}

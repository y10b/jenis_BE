import { Test, TestingModule } from '@nestjs/testing';
import { NotificationsService, NotificationType } from './notifications.service';
import { PrismaService } from '../../database/prisma.service';
import { NotificationsGateway } from './notifications.gateway';
import { NotFoundException } from '@nestjs/common';
import { UserRole, UserStatus } from '@prisma/client';

describe('NotificationsService', () => {
  let service: NotificationsService;

  const mockPrismaService = {
    notification: {
      create: jest.fn(),
      createMany: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      delete: jest.fn(),
      deleteMany: jest.fn(),
      count: jest.fn(),
    },
  };

  const mockNotificationsGateway = {
    sendToUser: jest.fn(),
  };

  const mockUser = {
    id: 'user-id',
    email: 'test@example.com',
    name: '테스트 사용자',
    role: UserRole.ACTOR,
    status: UserStatus.ACTIVE,
    teamId: 'team-id',
  };

  const mockNotification = {
    id: 'notification-id',
    userId: 'user-id',
    type: NotificationType.TASK_ASSIGNED,
    title: '테스트 알림',
    content: '테스트 알림 내용',
    payload: { taskId: 'task-id' },
    isRead: false,
    readAt: null,
    createdAt: new Date(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationsService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: NotificationsGateway, useValue: mockNotificationsGateway },
      ],
    }).compile();

    service = module.get<NotificationsService>(NotificationsService);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    const createDto = {
      userId: 'user-id',
      type: NotificationType.TASK_ASSIGNED,
      title: '새 알림',
      content: '새 알림 내용',
      payload: { taskId: 'task-id' },
    };

    it('should create notification and send realtime', async () => {
      mockPrismaService.notification.create.mockResolvedValue(mockNotification);

      const result = await service.create(createDto);

      expect(result).toBeDefined();
      expect(mockPrismaService.notification.create).toHaveBeenCalled();
      expect(mockNotificationsGateway.sendToUser).toHaveBeenCalledWith(
        createDto.userId,
        mockNotification,
      );
    });

    it('should create notification without realtime', async () => {
      mockPrismaService.notification.create.mockResolvedValue(mockNotification);

      await service.create(createDto, false);

      expect(mockNotificationsGateway.sendToUser).not.toHaveBeenCalled();
    });
  });

  describe('createMany', () => {
    const notifications = [
      {
        userId: 'user-1',
        type: NotificationType.TASK_ASSIGNED,
        title: '알림 1',
        content: '알림 내용 1',
      },
      {
        userId: 'user-2',
        type: NotificationType.TASK_ASSIGNED,
        title: '알림 2',
        content: '알림 내용 2',
      },
    ];

    it('should create multiple notifications', async () => {
      mockPrismaService.notification.createMany.mockResolvedValue({ count: 2 });

      const result = await service.createMany(notifications);

      expect(result.count).toBe(2);
      expect(mockNotificationsGateway.sendToUser).toHaveBeenCalledTimes(2);
    });
  });

  describe('findAll', () => {
    it('should return notifications with pagination', async () => {
      mockPrismaService.notification.findMany.mockResolvedValue([mockNotification]);
      mockPrismaService.notification.count
        .mockResolvedValueOnce(1)
        .mockResolvedValueOnce(1);

      const result = await service.findAll({ page: 1, limit: 20 }, mockUser);

      expect(result.data).toHaveLength(1);
      expect(result.meta.total).toBe(1);
      expect(result.meta.unreadCount).toBe(1);
    });

    it('should filter unread only', async () => {
      mockPrismaService.notification.findMany.mockResolvedValue([mockNotification]);
      mockPrismaService.notification.count.mockResolvedValue(1);

      await service.findAll({ unreadOnly: true }, mockUser);

      expect(mockPrismaService.notification.findMany).toHaveBeenCalled();
    });

    it('should filter by type', async () => {
      mockPrismaService.notification.findMany.mockResolvedValue([mockNotification]);
      mockPrismaService.notification.count.mockResolvedValue(1);

      await service.findAll({ type: NotificationType.TASK_ASSIGNED }, mockUser);

      expect(mockPrismaService.notification.findMany).toHaveBeenCalled();
    });
  });

  describe('findOne', () => {
    it('should return notification by id', async () => {
      mockPrismaService.notification.findFirst.mockResolvedValue(mockNotification);

      const result = await service.findOne('notification-id', mockUser);

      expect(result.id).toBe('notification-id');
    });

    it('should throw NotFoundException if not found', async () => {
      mockPrismaService.notification.findFirst.mockResolvedValue(null);

      await expect(service.findOne('non-existent-id', mockUser)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('markAsRead', () => {
    it('should mark notification as read', async () => {
      mockPrismaService.notification.findFirst.mockResolvedValue(mockNotification);
      mockPrismaService.notification.update.mockResolvedValue({
        ...mockNotification,
        isRead: true,
        readAt: new Date(),
      });

      const result = await service.markAsRead('notification-id', mockUser);

      expect(result.isRead).toBe(true);
    });

    it('should throw NotFoundException if not found', async () => {
      mockPrismaService.notification.findFirst.mockResolvedValue(null);

      await expect(service.markAsRead('non-existent-id', mockUser)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('markAllAsRead', () => {
    it('should mark all notifications as read', async () => {
      mockPrismaService.notification.updateMany.mockResolvedValue({ count: 5 });

      const result = await service.markAllAsRead(mockUser);

      expect(result.count).toBe(5);
      expect(result.message).toContain('5개');
    });
  });

  describe('remove', () => {
    it('should remove notification', async () => {
      mockPrismaService.notification.findFirst.mockResolvedValue(mockNotification);
      mockPrismaService.notification.delete.mockResolvedValue(mockNotification);

      const result = await service.remove('notification-id', mockUser);

      expect(result).toEqual({ message: '알림이 삭제되었습니다.' });
    });

    it('should throw NotFoundException if not found', async () => {
      mockPrismaService.notification.findFirst.mockResolvedValue(null);

      await expect(service.remove('non-existent-id', mockUser)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('removeAll', () => {
    it('should remove all notifications', async () => {
      mockPrismaService.notification.deleteMany.mockResolvedValue({ count: 10 });

      const result = await service.removeAll(mockUser);

      expect(result.count).toBe(10);
      expect(result.message).toContain('10개');
    });
  });

  describe('getUnreadCount', () => {
    it('should return unread count', async () => {
      mockPrismaService.notification.count.mockResolvedValue(5);

      const result = await service.getUnreadCount(mockUser);

      expect(result.count).toBe(5);
    });
  });

  describe('notification helper methods', () => {
    beforeEach(() => {
      mockPrismaService.notification.create.mockResolvedValue(mockNotification);
    });

    it('should notify task assigned', async () => {
      await service.notifyTaskAssigned('task-id', 'Task Title', 'user-id', 'Assigner');

      expect(mockPrismaService.notification.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            type: NotificationType.TASK_ASSIGNED,
          }),
        }),
      );
    });

    it('should notify task updated', async () => {
      await service.notifyTaskUpdated('task-id', 'Task Title', 'user-id', 'Updater', 'status');

      expect(mockPrismaService.notification.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            type: NotificationType.TASK_UPDATED,
          }),
        }),
      );
    });

    it('should notify task completed', async () => {
      await service.notifyTaskCompleted('task-id', 'Task Title', 'user-id', 'Completer');

      expect(mockPrismaService.notification.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            type: NotificationType.TASK_COMPLETED,
          }),
        }),
      );
    });

    it('should notify task comment', async () => {
      await service.notifyTaskComment('task-id', 'Task Title', 'user-id', 'Commenter', 'Preview');

      expect(mockPrismaService.notification.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            type: NotificationType.TASK_COMMENT,
          }),
        }),
      );
    });

    it('should notify task due soon', async () => {
      await service.notifyTaskDueSoon('task-id', 'Task Title', 'user-id', new Date());

      expect(mockPrismaService.notification.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            type: NotificationType.TASK_DUE_SOON,
          }),
        }),
      );
    });

    it('should notify task overdue', async () => {
      await service.notifyTaskOverdue('task-id', 'Task Title', 'user-id');

      expect(mockPrismaService.notification.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            type: NotificationType.TASK_OVERDUE,
          }),
        }),
      );
    });

    it('should notify user approved', async () => {
      await service.notifyUserApproved('user-id');

      expect(mockPrismaService.notification.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            type: NotificationType.USER_APPROVED,
          }),
        }),
      );
    });

    it('should notify user rejected', async () => {
      await service.notifyUserRejected('user-id', 'Reason');

      expect(mockPrismaService.notification.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            type: NotificationType.USER_REJECTED,
          }),
        }),
      );
    });

    it('should notify team invite', async () => {
      await service.notifyTeamInvite('user-id', 'Team Name', 'Inviter');

      expect(mockPrismaService.notification.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            type: NotificationType.TEAM_INVITE,
          }),
        }),
      );
    });

    it('should notify team removed', async () => {
      await service.notifyTeamRemoved('user-id', 'Team Name');

      expect(mockPrismaService.notification.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            type: NotificationType.TEAM_REMOVED,
          }),
        }),
      );
    });

    it('should notify schedule reminder', async () => {
      await service.notifyScheduleReminder('user-id', 'Schedule Title', 'CRON', new Date());

      expect(mockPrismaService.notification.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            type: NotificationType.SCHEDULE_REMINDER,
          }),
        }),
      );
    });
  });
});

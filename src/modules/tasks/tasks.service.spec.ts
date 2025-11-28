import { Test, TestingModule } from '@nestjs/testing';
import { TasksService } from './tasks.service';
import { PrismaService } from '../../database/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { NotFoundException, ForbiddenException } from '@nestjs/common';
import { UserRole, UserStatus, TaskStatus, TaskPriority } from '@prisma/client';

describe('TasksService', () => {
  let service: TasksService;

  const mockPrismaService = {
    task: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
    },
    taskHistory: {
      create: jest.fn(),
      findMany: jest.fn(),
    },
    taskRelation: {
      create: jest.fn(),
      delete: jest.fn(),
    },
    taskComment: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      delete: jest.fn(),
    },
  };

  const mockNotificationsService = {
    notifyTaskAssigned: jest.fn(),
    notifyTaskCompleted: jest.fn(),
    notifyTaskUpdated: jest.fn(),
    notifyTaskComment: jest.fn(),
  };

  const mockUser = {
    id: 'user-id',
    email: 'test@example.com',
    name: '테스트 사용자',
    role: UserRole.ACTOR,
    status: UserStatus.ACTIVE,
    teamId: 'team-id',
  };

  const mockOwnerUser = {
    ...mockUser,
    id: 'owner-id',
    role: UserRole.OWNER,
  };

  const mockTask = {
    id: 'task-id',
    title: '테스트 업무',
    description: '테스트 설명',
    status: TaskStatus.TODO,
    priority: TaskPriority.P2,
    dueDate: null,
    creatorId: 'user-id',
    assigneeId: 'user-id',
    teamId: 'team-id',
    createdAt: new Date(),
    updatedAt: new Date(),
    creator: { id: 'user-id', name: '테스트 사용자', email: 'test@example.com' },
    assignee: { id: 'user-id', name: '테스트 사용자', email: 'test@example.com' },
    team: { id: 'team-id', name: '테스트 팀' },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TasksService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: NotificationsService, useValue: mockNotificationsService },
      ],
    }).compile();

    service = module.get<TasksService>(TasksService);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    const createDto = {
      title: '새 업무',
      description: '새 업무 설명',
      status: TaskStatus.TODO,
      priority: TaskPriority.P2,
    };

    it('should create task successfully', async () => {
      const createdTask = { ...mockTask, title: createDto.title };
      mockPrismaService.task.create.mockResolvedValue(createdTask);
      mockPrismaService.taskHistory.create.mockResolvedValue({});

      const result = await service.create(createDto, mockUser);

      expect(result.title).toBe(createDto.title);
      expect(mockPrismaService.task.create).toHaveBeenCalled();
      expect(mockPrismaService.taskHistory.create).toHaveBeenCalled();
    });

    it('should create task with assignee and send notification', async () => {
      const createDtoWithAssignee = { ...createDto, assigneeId: 'other-user-id' };
      const createdTask = {
        ...mockTask,
        assigneeId: 'other-user-id',
        assignee: { id: 'other-user-id', name: 'Other User', email: 'other@example.com' },
      };

      mockPrismaService.user.findUnique.mockResolvedValue({ id: 'other-user-id' });
      mockPrismaService.task.create.mockResolvedValue(createdTask);
      mockPrismaService.taskHistory.create.mockResolvedValue({});
      mockNotificationsService.notifyTaskAssigned.mockResolvedValue(undefined);

      const result = await service.create(createDtoWithAssignee, mockUser);

      expect(result.assigneeId).toBe('other-user-id');
      expect(mockNotificationsService.notifyTaskAssigned).toHaveBeenCalledWith(
        createdTask.id,
        createdTask.title,
        'other-user-id',
        mockUser.name,
      );
    });

    it('should throw NotFoundException if assignee not found', async () => {
      const createDtoWithAssignee = { ...createDto, assigneeId: 'non-existent-id' };
      mockPrismaService.user.findUnique.mockResolvedValue(null);

      await expect(service.create(createDtoWithAssignee, mockUser)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('findAll', () => {
    it('should return tasks with pagination', async () => {
      mockPrismaService.task.findMany.mockResolvedValue([mockTask]);
      mockPrismaService.task.count.mockResolvedValue(1);

      const result = await service.findAll({ page: 1, limit: 20 }, mockUser);

      expect(result.data).toHaveLength(1);
      expect(result.meta.total).toBe(1);
    });

    it('should filter tasks by status', async () => {
      mockPrismaService.task.findMany.mockResolvedValue([mockTask]);
      mockPrismaService.task.count.mockResolvedValue(1);

      await service.findAll({ status: TaskStatus.TODO }, mockUser);

      expect(mockPrismaService.task.findMany).toHaveBeenCalled();
    });
  });

  describe('findOne', () => {
    it('should return task by id', async () => {
      mockPrismaService.task.findUnique.mockResolvedValue({
        ...mockTask,
        relationsFrom: [],
        relationsTo: [],
        comments: [],
      });

      const result = await service.findOne('task-id', mockUser);

      expect(result.id).toBe('task-id');
    });

    it('should throw NotFoundException if task not found', async () => {
      mockPrismaService.task.findUnique.mockResolvedValue(null);

      await expect(service.findOne('non-existent-id', mockUser)).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException if user cannot access task', async () => {
      const otherUserTask = {
        ...mockTask,
        creatorId: 'other-user-id',
        assigneeId: 'other-user-id',
        teamId: 'other-team-id',
        relationsFrom: [],
        relationsTo: [],
        comments: [],
      };
      mockPrismaService.task.findUnique.mockResolvedValue(otherUserTask);

      await expect(service.findOne('task-id', mockUser)).rejects.toThrow(ForbiddenException);
    });

    it('should allow OWNER to access any task', async () => {
      const otherUserTask = {
        ...mockTask,
        creatorId: 'other-user-id',
        assigneeId: 'other-user-id',
        teamId: 'other-team-id',
        relationsFrom: [],
        relationsTo: [],
        comments: [],
      };
      mockPrismaService.task.findUnique.mockResolvedValue(otherUserTask);

      const result = await service.findOne('task-id', mockOwnerUser);

      expect(result.id).toBe('task-id');
    });
  });

  describe('update', () => {
    const updateDto = {
      title: '업데이트된 업무',
      status: TaskStatus.IN_PROGRESS,
    };

    it('should update task successfully', async () => {
      mockPrismaService.task.findUnique.mockResolvedValue(mockTask);
      mockPrismaService.task.update.mockResolvedValue({
        ...mockTask,
        ...updateDto,
      });
      mockPrismaService.taskHistory.create.mockResolvedValue({});

      const result = await service.update('task-id', updateDto, mockUser);

      expect(result.title).toBe(updateDto.title);
      expect(result.status).toBe(updateDto.status);
    });

    it('should throw NotFoundException if task not found', async () => {
      mockPrismaService.task.findUnique.mockResolvedValue(null);

      await expect(service.update('non-existent-id', updateDto, mockUser)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw ForbiddenException if user cannot modify task', async () => {
      const otherUserTask = {
        ...mockTask,
        creatorId: 'other-user-id',
        assigneeId: 'other-user-id',
      };
      mockPrismaService.task.findUnique.mockResolvedValue(otherUserTask);

      await expect(service.update('task-id', updateDto, mockUser)).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe('remove', () => {
    it('should remove task successfully', async () => {
      mockPrismaService.task.findUnique.mockResolvedValue(mockTask);
      mockPrismaService.task.delete.mockResolvedValue(mockTask);

      const result = await service.remove('task-id', mockUser);

      expect(result).toEqual({ message: 'Task가 삭제되었습니다.' });
    });

    it('should throw NotFoundException if task not found', async () => {
      mockPrismaService.task.findUnique.mockResolvedValue(null);

      await expect(service.remove('non-existent-id', mockUser)).rejects.toThrow(NotFoundException);
    });
  });

  describe('addComment', () => {
    const commentDto = { content: '테스트 댓글' };

    it('should add comment successfully', async () => {
      const mockComment = {
        id: 'comment-id',
        taskId: 'task-id',
        userId: 'user-id',
        content: commentDto.content,
        createdAt: new Date(),
        user: { id: 'user-id', name: '테스트 사용자', email: 'test@example.com' },
      };

      mockPrismaService.task.findUnique.mockResolvedValue(mockTask);
      mockPrismaService.taskComment.create.mockResolvedValue(mockComment);
      mockNotificationsService.notifyTaskComment.mockResolvedValue(undefined);

      const result = await service.addComment('task-id', commentDto, mockUser);

      expect(result.content).toBe(commentDto.content);
    });

    it('should throw NotFoundException if task not found', async () => {
      mockPrismaService.task.findUnique.mockResolvedValue(null);

      await expect(service.addComment('non-existent-id', commentDto, mockUser)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('removeComment', () => {
    const mockComment = {
      id: 'comment-id',
      taskId: 'task-id',
      userId: 'user-id',
      content: '테스트 댓글',
      task: mockTask,
    };

    it('should remove comment as author', async () => {
      mockPrismaService.taskComment.findUnique.mockResolvedValue(mockComment);
      mockPrismaService.taskComment.delete.mockResolvedValue(mockComment);

      const result = await service.removeComment('task-id', 'comment-id', mockUser);

      expect(result).toEqual({ message: '댓글이 삭제되었습니다.' });
    });

    it('should throw NotFoundException if comment not found', async () => {
      mockPrismaService.taskComment.findUnique.mockResolvedValue(null);

      await expect(
        service.removeComment('task-id', 'non-existent-id', mockUser),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException if user is not author', async () => {
      const otherUserComment = {
        ...mockComment,
        userId: 'other-user-id',
        task: { ...mockTask, creatorId: 'other-user-id' },
      };
      mockPrismaService.taskComment.findUnique.mockResolvedValue(otherUserComment);

      await expect(
        service.removeComment('task-id', 'comment-id', mockUser),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('addRelation', () => {
    const relationDto = {
      targetTaskId: 'related-task-id',
      type: 'BLOCKS' as const,
    };

    it('should add relation successfully', async () => {
      const mockRelation = {
        id: 'relation-id',
        taskId: 'task-id',
        relatedTaskId: 'related-task-id',
        relationType: 'BLOCKS',
        relatedTask: { id: 'related-task-id', title: '관련 업무', status: TaskStatus.TODO },
      };

      mockPrismaService.task.findUnique
        .mockResolvedValueOnce(mockTask)
        .mockResolvedValueOnce({ id: 'related-task-id' });
      mockPrismaService.taskRelation.create.mockResolvedValue(mockRelation);

      const result = await service.addRelation('task-id', relationDto, mockUser);

      expect(result.relationType).toBe('BLOCKS');
    });

    it('should throw NotFoundException if target task not found', async () => {
      mockPrismaService.task.findUnique
        .mockResolvedValueOnce(mockTask)
        .mockResolvedValueOnce(null);

      await expect(service.addRelation('task-id', relationDto, mockUser)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('getHistory', () => {
    it('should return task history', async () => {
      const mockHistory = [
        {
          id: 'history-id',
          taskId: 'task-id',
          userId: 'user-id',
          fieldName: 'status',
          newValue: 'IN_PROGRESS',
          createdAt: new Date(),
          user: { id: 'user-id', name: '테스트 사용자', email: 'test@example.com' },
        },
      ];

      mockPrismaService.task.findUnique.mockResolvedValue(mockTask);
      mockPrismaService.taskHistory.findMany.mockResolvedValue(mockHistory);

      const result = await service.getHistory('task-id', mockUser);

      expect(result).toHaveLength(1);
      expect(result[0].fieldName).toBe('status');
    });

    it('should throw NotFoundException if task not found', async () => {
      mockPrismaService.task.findUnique.mockResolvedValue(null);

      await expect(service.getHistory('non-existent-id', mockUser)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('getMyTasks', () => {
    it('should return tasks assigned to current user', async () => {
      mockPrismaService.task.findMany.mockResolvedValue([mockTask]);
      mockPrismaService.task.count.mockResolvedValue(1);

      const result = await service.getMyTasks({}, mockUser);

      expect(result.data).toHaveLength(1);
    });
  });

  describe('getCreatedTasks', () => {
    it('should return tasks created by current user', async () => {
      mockPrismaService.task.findMany.mockResolvedValue([mockTask]);
      mockPrismaService.task.count.mockResolvedValue(1);

      const result = await service.getCreatedTasks({}, mockUser);

      expect(result.data).toHaveLength(1);
    });
  });
});

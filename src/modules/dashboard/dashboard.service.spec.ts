import { Test, TestingModule } from '@nestjs/testing';
import { DashboardService } from './dashboard.service';
import { PrismaService } from '../../database/prisma.service';
import { UserRole, UserStatus, TaskStatus, TaskPriority } from '@prisma/client';

describe('DashboardService', () => {
  let service: DashboardService;

  const mockPrismaService = {
    task: {
      count: jest.fn(),
      findMany: jest.fn(),
      groupBy: jest.fn(),
    },
    taskComment: {
      count: jest.fn(),
      findMany: jest.fn(),
    },
    team: {
      findMany: jest.fn(),
    },
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
    teamId: null,
  };

  const mockTask = {
    id: 'task-id',
    title: '테스트 업무',
    status: TaskStatus.TODO,
    priority: TaskPriority.P2,
    dueDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
    assigneeId: 'user-id',
    creatorId: 'user-id',
    teamId: 'team-id',
    assignee: { id: 'user-id', name: '테스트 사용자', profileImageUrl: null },
    team: { id: 'team-id', name: '테스트 팀' },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DashboardService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<DashboardService>(DashboardService);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getTaskStatusStats', () => {
    it('should return task status statistics', async () => {
      mockPrismaService.task.count.mockResolvedValue(10);
      mockPrismaService.task.groupBy.mockResolvedValue([
        { status: TaskStatus.TODO, _count: { status: 3 } },
        { status: TaskStatus.IN_PROGRESS, _count: { status: 4 } },
        { status: TaskStatus.DONE, _count: { status: 3 } },
      ]);

      const result = await service.getTaskStatusStats({}, {});

      expect(result.total).toBe(10);
      expect(result.todo).toBe(3);
      expect(result.inProgress).toBe(4);
      expect(result.done).toBe(3);
      expect(result.completionRate).toBe(30);
    });

    it('should return 0 completion rate when no tasks', async () => {
      mockPrismaService.task.count.mockResolvedValue(0);
      mockPrismaService.task.groupBy.mockResolvedValue([]);

      const result = await service.getTaskStatusStats({}, {});

      expect(result.total).toBe(0);
      expect(result.completionRate).toBe(0);
    });
  });

  describe('getTaskPriorityStats', () => {
    it('should return task priority statistics', async () => {
      mockPrismaService.task.groupBy.mockResolvedValue([
        { priority: TaskPriority.P0, _count: { priority: 1 } },
        { priority: TaskPriority.P1, _count: { priority: 2 } },
        { priority: TaskPriority.P2, _count: { priority: 5 } },
      ]);

      const result = await service.getTaskPriorityStats({}, {});

      expect(result.p0).toBe(1);
      expect(result.p1).toBe(2);
      expect(result.p2).toBe(5);
      expect(result.p3).toBe(0);
    });
  });

  describe('getUpcomingDeadlines', () => {
    it('should return tasks with upcoming deadlines', async () => {
      mockPrismaService.task.findMany.mockResolvedValue([mockTask]);

      const result = await service.getUpcomingDeadlines({}, mockUser);

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('task-id');
    });
  });

  describe('getTeamStats', () => {
    it('should return team stats for OWNER', async () => {
      const mockTeams = [
        {
          id: 'team-1',
          name: '팀 1',
          _count: { members: 5, tasks: 10 },
        },
      ];

      mockPrismaService.team.findMany.mockResolvedValue(mockTeams);
      mockPrismaService.task.count.mockResolvedValue(5);

      const result = await service.getTeamStats(mockOwnerUser);

      expect(result).toHaveLength(1);
      expect(result![0].completionRate).toBe(50);
    });

    it('should return null for non-OWNER/HEAD users', async () => {
      const result = await service.getTeamStats(mockUser);

      expect(result).toBeNull();
    });
  });

  describe('getMyDashboard', () => {
    it('should return my dashboard data', async () => {
      mockPrismaService.task.groupBy.mockResolvedValue([
        { status: TaskStatus.TODO, _count: { status: 2 } },
        { status: TaskStatus.IN_PROGRESS, _count: { status: 1 } },
      ]);
      mockPrismaService.task.findMany.mockResolvedValue([mockTask]);
      mockPrismaService.taskComment.findMany.mockResolvedValue([]);

      const result = await service.getMyDashboard(mockUser);

      expect(result).toHaveProperty('myTasks');
      expect(result).toHaveProperty('myRecentActivity');
      expect(result).toHaveProperty('myUpcomingDeadlines');
    });
  });

  describe('getMyTaskStats', () => {
    it('should return my task statistics', async () => {
      mockPrismaService.task.groupBy.mockResolvedValue([
        { status: TaskStatus.TODO, _count: { status: 3 } },
        { status: TaskStatus.IN_PROGRESS, _count: { status: 2 } },
        { status: TaskStatus.DONE, _count: { status: 5 } },
      ]);

      const result = await service.getMyTaskStats(mockUser);

      expect(result.total).toBe(10);
      expect(result.todo).toBe(3);
      expect(result.inProgress).toBe(2);
      expect(result.done).toBe(5);
    });
  });

  describe('getMyRecentActivity', () => {
    it('should return recent tasks and comments', async () => {
      mockPrismaService.task.findMany.mockResolvedValue([mockTask]);
      mockPrismaService.taskComment.findMany.mockResolvedValue([
        {
          id: 'comment-id',
          content: '테스트 댓글',
          task: { id: 'task-id', title: '테스트 업무' },
        },
      ]);

      const result = await service.getMyRecentActivity(mockUser);

      expect(result.recentTasks).toHaveLength(1);
      expect(result.recentComments).toHaveLength(1);
    });
  });

  describe('getMyUpcomingDeadlines', () => {
    it('should return my tasks with upcoming deadlines', async () => {
      mockPrismaService.task.findMany.mockResolvedValue([mockTask]);

      const result = await service.getMyUpcomingDeadlines(mockUser);

      expect(result).toHaveLength(1);
    });
  });

  describe('getOverview', () => {
    it('should return overview data', async () => {
      mockPrismaService.task.count.mockResolvedValue(10);
      mockPrismaService.task.groupBy.mockResolvedValue([
        { status: TaskStatus.TODO, _count: { status: 5 } },
        { status: TaskStatus.DONE, _count: { status: 5 } },
      ]);
      mockPrismaService.task.findMany.mockResolvedValue([mockTask]);
      mockPrismaService.team.findMany.mockResolvedValue([]);
      mockPrismaService.taskComment.count.mockResolvedValue(3);

      const result = await service.getOverview({}, mockOwnerUser);

      expect(result).toHaveProperty('taskStats');
      expect(result).toHaveProperty('priorityStats');
      expect(result).toHaveProperty('recentTasks');
      expect(result).toHaveProperty('upcomingDeadlines');
      expect(result).toHaveProperty('activityStats');
    });
  });
});

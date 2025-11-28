import { Test, TestingModule } from '@nestjs/testing';
import { SchedulesService } from './schedules.service';
import { PrismaService } from '../../database/prisma.service';
import { NotFoundException, ForbiddenException } from '@nestjs/common';
import { UserRole, UserStatus, ScheduleType } from '@prisma/client';

describe('SchedulesService', () => {
  let service: SchedulesService;

  const mockPrismaService = {
    schedule: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
    },
    teamSchedule: {
      deleteMany: jest.fn(),
      createMany: jest.fn(),
    },
    $transaction: jest.fn((callback) => callback(mockPrismaService)),
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

  const mockSchedule = {
    id: 'schedule-id',
    title: '테스트 스케줄',
    description: '테스트 설명',
    type: ScheduleType.ONCE,
    scheduledAt: new Date(),
    nextRunAt: new Date(),
    isActive: true,
    creatorId: 'user-id',
    createdAt: new Date(),
    updatedAt: new Date(),
    creator: { id: 'user-id', name: '테스트 사용자', email: 'test@example.com' },
    teamSchedules: [{ teamId: 'team-id', team: { id: 'team-id', name: '테스트 팀' } }],
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SchedulesService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<SchedulesService>(SchedulesService);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    const createDto = {
      title: '새 스케줄',
      description: '새 스케줄 설명',
      type: ScheduleType.ONCE,
      scheduledAt: '2024-12-31T10:00:00Z',
      teamIds: ['team-id'],
    };

    it('should create schedule successfully', async () => {
      const createdSchedule = { ...mockSchedule, title: createDto.title };
      mockPrismaService.schedule.create.mockResolvedValue(createdSchedule);

      const result = await service.create(createDto, mockUser);

      expect(result.title).toBe(createDto.title);
      expect(mockPrismaService.schedule.create).toHaveBeenCalled();
    });

    it('should create schedule without teams', async () => {
      const createDtoWithoutTeams = { ...createDto, teamIds: undefined };
      mockPrismaService.schedule.create.mockResolvedValue(mockSchedule);

      const result = await service.create(createDtoWithoutTeams, mockUser);

      expect(result).toBeDefined();
    });
  });

  describe('findAll', () => {
    it('should return schedules with pagination', async () => {
      mockPrismaService.schedule.findMany.mockResolvedValue([mockSchedule]);
      mockPrismaService.schedule.count.mockResolvedValue(1);

      const result = await service.findAll({ page: 1, limit: 20 }, mockUser);

      expect(result.data).toHaveLength(1);
      expect(result.meta.total).toBe(1);
    });

    it('should filter schedules by type', async () => {
      mockPrismaService.schedule.findMany.mockResolvedValue([mockSchedule]);
      mockPrismaService.schedule.count.mockResolvedValue(1);

      await service.findAll({ type: ScheduleType.ONCE }, mockUser);

      expect(mockPrismaService.schedule.findMany).toHaveBeenCalled();
    });

    it('should filter schedules by active status', async () => {
      mockPrismaService.schedule.findMany.mockResolvedValue([mockSchedule]);
      mockPrismaService.schedule.count.mockResolvedValue(1);

      await service.findAll({ isActive: true }, mockUser);

      expect(mockPrismaService.schedule.findMany).toHaveBeenCalled();
    });
  });

  describe('findOne', () => {
    it('should return schedule by id', async () => {
      mockPrismaService.schedule.findUnique.mockResolvedValue(mockSchedule);

      const result = await service.findOne('schedule-id', mockUser);

      expect(result.id).toBe('schedule-id');
    });

    it('should throw NotFoundException if schedule not found', async () => {
      mockPrismaService.schedule.findUnique.mockResolvedValue(null);

      await expect(service.findOne('non-existent-id', mockUser)).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException if user cannot access schedule', async () => {
      const otherUserSchedule = {
        ...mockSchedule,
        creatorId: 'other-user-id',
        teamSchedules: [{ teamId: 'other-team-id', team: { id: 'other-team-id', name: '다른 팀' } }],
      };
      mockPrismaService.schedule.findUnique.mockResolvedValue(otherUserSchedule);

      await expect(service.findOne('schedule-id', mockUser)).rejects.toThrow(ForbiddenException);
    });

    it('should allow OWNER to access any schedule', async () => {
      const otherUserSchedule = {
        ...mockSchedule,
        creatorId: 'other-user-id',
        teamSchedules: [],
      };
      mockPrismaService.schedule.findUnique.mockResolvedValue(otherUserSchedule);

      const result = await service.findOne('schedule-id', mockOwnerUser);

      expect(result.id).toBe('schedule-id');
    });
  });

  describe('update', () => {
    const updateDto = {
      title: '업데이트된 스케줄',
      isActive: false,
    };

    it('should update schedule successfully', async () => {
      mockPrismaService.schedule.findUnique.mockResolvedValue(mockSchedule);
      mockPrismaService.schedule.update.mockResolvedValue({
        ...mockSchedule,
        ...updateDto,
      });

      const result = await service.update('schedule-id', updateDto, mockUser);

      expect(result.title).toBe(updateDto.title);
    });

    it('should update schedule with new teams', async () => {
      const updateDtoWithTeams = { ...updateDto, teamIds: ['new-team-id'] };
      mockPrismaService.schedule.findUnique.mockResolvedValue(mockSchedule);
      mockPrismaService.teamSchedule.deleteMany.mockResolvedValue({ count: 1 });
      mockPrismaService.teamSchedule.createMany.mockResolvedValue({ count: 1 });
      mockPrismaService.schedule.update.mockResolvedValue({
        ...mockSchedule,
        ...updateDto,
      });

      await service.update('schedule-id', updateDtoWithTeams, mockUser);

      expect(mockPrismaService.teamSchedule.deleteMany).toHaveBeenCalled();
      expect(mockPrismaService.teamSchedule.createMany).toHaveBeenCalled();
    });

    it('should throw NotFoundException if schedule not found', async () => {
      mockPrismaService.schedule.findUnique.mockResolvedValue(null);

      await expect(service.update('non-existent-id', updateDto, mockUser)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw ForbiddenException if user cannot modify schedule', async () => {
      const otherUserSchedule = { ...mockSchedule, creatorId: 'other-user-id' };
      mockPrismaService.schedule.findUnique.mockResolvedValue(otherUserSchedule);

      await expect(service.update('schedule-id', updateDto, mockUser)).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe('remove', () => {
    it('should remove schedule successfully', async () => {
      mockPrismaService.schedule.findUnique.mockResolvedValue(mockSchedule);
      mockPrismaService.schedule.delete.mockResolvedValue(mockSchedule);

      const result = await service.remove('schedule-id', mockUser);

      expect(result).toEqual({ message: '스케줄이 삭제되었습니다.' });
    });

    it('should throw NotFoundException if schedule not found', async () => {
      mockPrismaService.schedule.findUnique.mockResolvedValue(null);

      await expect(service.remove('non-existent-id', mockUser)).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException if user cannot modify schedule', async () => {
      const otherUserSchedule = { ...mockSchedule, creatorId: 'other-user-id' };
      mockPrismaService.schedule.findUnique.mockResolvedValue(otherUserSchedule);

      await expect(service.remove('schedule-id', mockUser)).rejects.toThrow(ForbiddenException);
    });
  });

  describe('toggleActive', () => {
    it('should toggle schedule active status', async () => {
      mockPrismaService.schedule.findUnique.mockResolvedValue(mockSchedule);
      mockPrismaService.schedule.update.mockResolvedValue({
        ...mockSchedule,
        isActive: false,
      });

      const result = await service.toggleActive('schedule-id', mockUser);

      expect(result.isActive).toBe(false);
    });

    it('should throw NotFoundException if schedule not found', async () => {
      mockPrismaService.schedule.findUnique.mockResolvedValue(null);

      await expect(service.toggleActive('non-existent-id', mockUser)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('getMySchedules', () => {
    it('should return schedules created by current user', async () => {
      mockPrismaService.schedule.findMany.mockResolvedValue([mockSchedule]);
      mockPrismaService.schedule.count.mockResolvedValue(1);

      const result = await service.getMySchedules({}, mockUser);

      expect(result.data).toHaveLength(1);
    });
  });

  describe('getTeamSchedules', () => {
    it('should return team schedules', async () => {
      mockPrismaService.schedule.findMany.mockResolvedValue([mockSchedule]);
      mockPrismaService.schedule.count.mockResolvedValue(1);

      const result = await service.getTeamSchedules('team-id', {}, mockUser);

      expect(result.data).toHaveLength(1);
    });

    it('should throw ForbiddenException if user is not in team', async () => {
      const userWithDifferentTeam = { ...mockUser, teamId: 'other-team-id' };

      await expect(
        service.getTeamSchedules('team-id', {}, userWithDifferentTeam),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should allow OWNER to access any team schedules', async () => {
      mockPrismaService.schedule.findMany.mockResolvedValue([mockSchedule]);
      mockPrismaService.schedule.count.mockResolvedValue(1);

      const result = await service.getTeamSchedules('any-team-id', {}, mockOwnerUser);

      expect(result.data).toHaveLength(1);
    });
  });

  describe('getUpcoming', () => {
    it('should return upcoming schedules', async () => {
      mockPrismaService.schedule.findMany.mockResolvedValue([mockSchedule]);

      const result = await service.getUpcoming(10, mockUser);

      expect(result).toHaveLength(1);
    });
  });
});

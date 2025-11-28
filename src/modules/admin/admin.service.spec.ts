import { Test, TestingModule } from '@nestjs/testing';
import { AdminService } from './admin.service';
import { PrismaService } from '../../database/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { AuditService } from '../audit/audit.service';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { UserRole, UserStatus } from '@prisma/client';

describe('AdminService', () => {
  let service: AdminService;

  const mockPrismaService = {
    user: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
    },
    team: {
      findUnique: jest.fn(),
    },
    refreshToken: {
      updateMany: jest.fn(),
    },
  };

  const mockNotificationsService = {
    notifyUserApproved: jest.fn(),
    notifyUserRejected: jest.fn(),
  };

  const mockAuditService = {
    log: jest.fn(),
  };

  const mockUser = {
    id: 'user-id',
    email: 'test@example.com',
    name: '테스트 사용자',
    role: UserRole.ACTOR,
    status: UserStatus.PENDING,
    teamId: null,
    createdAt: new Date(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: NotificationsService, useValue: mockNotificationsService },
        { provide: AuditService, useValue: mockAuditService },
      ],
    }).compile();

    service = module.get<AdminService>(AdminService);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getPendingUsers', () => {
    it('should return pending users with pagination', async () => {
      const pendingUsers = [mockUser];
      mockPrismaService.user.findMany.mockResolvedValue(pendingUsers);
      mockPrismaService.user.count.mockResolvedValue(1);

      const result = await service.getPendingUsers({ page: 1, limit: 20, skip: 0 });

      expect(result.data).toHaveLength(1);
      expect(result.meta.total).toBe(1);
      expect(mockPrismaService.user.findMany).toHaveBeenCalledWith({
        where: { status: UserStatus.PENDING },
        select: expect.any(Object),
        skip: 0,
        take: 20,
        orderBy: { createdAt: 'desc' },
      });
    });
  });

  describe('approveUser', () => {
    const approveDto = {
      role: UserRole.ACTOR,
      teamId: 'team-id',
    };

    it('should approve user successfully', async () => {
      const approvedUser = {
        ...mockUser,
        status: UserStatus.ACTIVE,
        role: UserRole.ACTOR,
        teamId: 'team-id',
      };

      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
      mockPrismaService.team.findUnique.mockResolvedValue({ id: 'team-id', name: '테스트 팀' });
      mockPrismaService.user.update.mockResolvedValue(approvedUser);
      mockNotificationsService.notifyUserApproved.mockResolvedValue(undefined);
      mockAuditService.log.mockResolvedValue(undefined);

      const result = await service.approveUser('user-id', approveDto);

      expect(result.status).toBe(UserStatus.ACTIVE);
      expect(result.role).toBe(UserRole.ACTOR);
      expect(mockNotificationsService.notifyUserApproved).toHaveBeenCalledWith('user-id');
      expect(mockAuditService.log).toHaveBeenCalled();
    });

    it('should throw NotFoundException if user not found', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);

      await expect(service.approveUser('non-existent-id', approveDto)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw BadRequestException if user is not pending', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({
        ...mockUser,
        status: UserStatus.ACTIVE,
      });

      await expect(service.approveUser('user-id', approveDto)).rejects.toThrow(BadRequestException);
    });

    it('should throw NotFoundException if team not found', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
      mockPrismaService.team.findUnique.mockResolvedValue(null);

      await expect(service.approveUser('user-id', approveDto)).rejects.toThrow(NotFoundException);
    });
  });

  describe('rejectUser', () => {
    const rejectDto = {
      reason: '가입 조건을 충족하지 않음',
    };

    it('should reject user successfully', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
      mockPrismaService.user.update.mockResolvedValue({
        ...mockUser,
        status: UserStatus.INACTIVE,
      });
      mockNotificationsService.notifyUserRejected.mockResolvedValue(undefined);
      mockAuditService.log.mockResolvedValue(undefined);

      const result = await service.rejectUser('user-id', rejectDto);

      expect(result.status).toBe(UserStatus.INACTIVE);
      expect(mockNotificationsService.notifyUserRejected).toHaveBeenCalledWith(
        'user-id',
        rejectDto.reason,
      );
    });

    it('should throw NotFoundException if user not found', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);

      await expect(service.rejectUser('non-existent-id', rejectDto)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw BadRequestException if user is not pending', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({
        ...mockUser,
        status: UserStatus.ACTIVE,
      });

      await expect(service.rejectUser('user-id', rejectDto)).rejects.toThrow(BadRequestException);
    });
  });

  describe('updateUserRole', () => {
    const updateRoleDto = {
      role: UserRole.LEAD,
    };

    it('should update user role successfully', async () => {
      const activeUser = { ...mockUser, status: UserStatus.ACTIVE };
      mockPrismaService.user.findUnique.mockResolvedValue(activeUser);
      mockPrismaService.user.update.mockResolvedValue({
        ...activeUser,
        role: UserRole.LEAD,
      });
      mockAuditService.log.mockResolvedValue(undefined);

      const result = await service.updateUserRole('user-id', updateRoleDto);

      expect(result.role).toBe(UserRole.LEAD);
      expect(mockAuditService.log).toHaveBeenCalled();
    });

    it('should throw NotFoundException if user not found', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);

      await expect(service.updateUserRole('non-existent-id', updateRoleDto)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('updateUserTeam', () => {
    const updateTeamDto = {
      teamId: 'new-team-id',
    };

    it('should update user team successfully', async () => {
      const activeUser = { ...mockUser, status: UserStatus.ACTIVE };
      mockPrismaService.user.findUnique.mockResolvedValue(activeUser);
      mockPrismaService.team.findUnique.mockResolvedValue({ id: 'new-team-id', name: '새 팀' });
      mockPrismaService.user.update.mockResolvedValue({
        ...activeUser,
        teamId: 'new-team-id',
        team: { id: 'new-team-id', name: '새 팀' },
      });
      mockAuditService.log.mockResolvedValue(undefined);

      const result = await service.updateUserTeam('user-id', updateTeamDto);

      expect(result.teamId).toBe('new-team-id');
    });

    it('should throw NotFoundException if team not found', async () => {
      const activeUser = { ...mockUser, status: UserStatus.ACTIVE };
      mockPrismaService.user.findUnique.mockResolvedValue(activeUser);
      mockPrismaService.team.findUnique.mockResolvedValue(null);

      await expect(service.updateUserTeam('user-id', updateTeamDto)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('getAllUsers', () => {
    it('should return all users with pagination', async () => {
      const users = [mockUser];
      mockPrismaService.user.findMany.mockResolvedValue(users);
      mockPrismaService.user.count.mockResolvedValue(1);

      const result = await service.getAllUsers({ page: 1, limit: 20, skip: 0 });

      expect(result.data).toHaveLength(1);
      expect(result.meta.total).toBe(1);
    });
  });

  describe('deactivateUser', () => {
    it('should deactivate user successfully', async () => {
      const activeUser = { ...mockUser, status: UserStatus.ACTIVE };
      mockPrismaService.user.findUnique.mockResolvedValue(activeUser);
      mockPrismaService.user.update.mockResolvedValue({
        ...activeUser,
        status: UserStatus.INACTIVE,
      });
      mockPrismaService.refreshToken.updateMany.mockResolvedValue({ count: 1 });

      const result = await service.deactivateUser('user-id');

      expect(result).toEqual({ message: '사용자가 비활성화되었습니다.' });
      expect(mockPrismaService.refreshToken.updateMany).toHaveBeenCalled();
    });

    it('should throw NotFoundException if user not found', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);

      await expect(service.deactivateUser('non-existent-id')).rejects.toThrow(NotFoundException);
    });
  });

  describe('activateUser', () => {
    it('should activate user successfully', async () => {
      const inactiveUser = { ...mockUser, status: UserStatus.INACTIVE };
      mockPrismaService.user.findUnique.mockResolvedValue(inactiveUser);
      mockPrismaService.user.update.mockResolvedValue({
        ...inactiveUser,
        status: UserStatus.ACTIVE,
      });

      const result = await service.activateUser('user-id');

      expect(result).toEqual({ message: '사용자가 활성화되었습니다.' });
    });

    it('should throw NotFoundException if user not found', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);

      await expect(service.activateUser('non-existent-id')).rejects.toThrow(NotFoundException);
    });
  });
});

import { Test, TestingModule } from '@nestjs/testing';
import { TeamsService } from './teams.service';
import { PrismaService } from '../../database/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import {
  NotFoundException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import { UserRole, UserStatus } from '@prisma/client';

describe('TeamsService', () => {
  let service: TeamsService;

  const mockPrismaService = {
    team: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
      update: jest.fn(),
      findMany: jest.fn(),
    },
    teamShare: {
      create: jest.fn(),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    task: {
      findMany: jest.fn(),
    },
    schedule: {
      findMany: jest.fn(),
    },
  };

  const mockNotificationsService = {
    notifyTeamInvite: jest.fn(),
    notifyTeamRemoved: jest.fn(),
  };

  const mockOwnerUser = {
    id: 'owner-id',
    email: 'owner@example.com',
    name: 'Owner',
    role: UserRole.OWNER,
    status: UserStatus.ACTIVE,
    teamId: null,
  };

  const mockHeadUser = {
    id: 'head-id',
    email: 'head@example.com',
    name: 'Head',
    role: UserRole.HEAD,
    status: UserStatus.ACTIVE,
    teamId: 'team-id',
  };

  const mockActorUser = {
    id: 'actor-id',
    email: 'actor@example.com',
    name: 'Actor',
    role: UserRole.ACTOR,
    status: UserStatus.ACTIVE,
    teamId: 'team-id',
  };

  const mockTeam = {
    id: 'team-id',
    name: '테스트 팀',
    description: '테스트 팀 설명',
    ownerId: 'owner-id',
    createdAt: new Date(),
    owner: { id: 'owner-id', email: 'owner@example.com', name: 'Owner' },
    _count: { members: 2 },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TeamsService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: NotificationsService, useValue: mockNotificationsService },
      ],
    }).compile();

    service = module.get<TeamsService>(TeamsService);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    const createDto = {
      name: '새 팀',
      description: '새 팀 설명',
    };

    it('should create team successfully as OWNER', async () => {
      mockPrismaService.team.create.mockResolvedValue({
        ...mockTeam,
        name: createDto.name,
        description: createDto.description,
      });

      const result = await service.create(createDto, mockOwnerUser);

      expect(result.name).toBe(createDto.name);
      expect(mockPrismaService.team.create).toHaveBeenCalled();
    });

    it('should throw ForbiddenException if not OWNER', async () => {
      await expect(service.create(createDto, mockActorUser)).rejects.toThrow(ForbiddenException);
    });
  });

  describe('findAll', () => {
    it('should return all teams', async () => {
      mockPrismaService.team.findMany.mockResolvedValue([mockTeam]);

      const result = await service.findAll(mockOwnerUser);

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe(mockTeam.name);
    });
  });

  describe('findOne', () => {
    it('should return team by id', async () => {
      mockPrismaService.team.findUnique.mockResolvedValue({
        ...mockTeam,
        members: [],
      });

      const result = await service.findOne('team-id', mockOwnerUser);

      expect(result.id).toBe('team-id');
    });

    it('should throw NotFoundException if team not found', async () => {
      mockPrismaService.team.findUnique.mockResolvedValue(null);

      await expect(service.findOne('non-existent-id', mockOwnerUser)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('update', () => {
    const updateDto = {
      name: '업데이트된 팀',
      description: '업데이트된 설명',
    };

    it('should update team successfully as OWNER', async () => {
      mockPrismaService.team.findUnique.mockResolvedValue(mockTeam);
      mockPrismaService.team.update.mockResolvedValue({
        ...mockTeam,
        ...updateDto,
      });

      const result = await service.update('team-id', updateDto, mockOwnerUser);

      expect(result.name).toBe(updateDto.name);
    });

    it('should throw NotFoundException if team not found', async () => {
      mockPrismaService.team.findUnique.mockResolvedValue(null);

      await expect(service.update('non-existent-id', updateDto, mockOwnerUser)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw ForbiddenException if not OWNER', async () => {
      mockPrismaService.team.findUnique.mockResolvedValue(mockTeam);

      await expect(service.update('team-id', updateDto, mockActorUser)).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe('remove', () => {
    it('should remove team successfully as OWNER', async () => {
      mockPrismaService.team.findUnique.mockResolvedValue({
        ...mockTeam,
        _count: { members: 0 },
      });
      mockPrismaService.team.delete.mockResolvedValue(mockTeam);

      const result = await service.remove('team-id', mockOwnerUser);

      expect(result).toEqual({ message: '팀이 삭제되었습니다.' });
    });

    it('should throw ConflictException if team has members', async () => {
      mockPrismaService.team.findUnique.mockResolvedValue(mockTeam);

      await expect(service.remove('team-id', mockOwnerUser)).rejects.toThrow(ConflictException);
    });

    it('should throw ForbiddenException if not OWNER', async () => {
      mockPrismaService.team.findUnique.mockResolvedValue({
        ...mockTeam,
        _count: { members: 0 },
      });

      await expect(service.remove('team-id', mockActorUser)).rejects.toThrow(ForbiddenException);
    });
  });

  describe('addMember', () => {
    const addMemberDto = { userId: 'new-user-id' };

    it('should add member successfully as OWNER', async () => {
      const newUser = { ...mockActorUser, id: 'new-user-id', teamId: null };
      mockPrismaService.team.findUnique.mockResolvedValue(mockTeam);
      mockPrismaService.user.findUnique.mockResolvedValue(newUser);
      mockPrismaService.user.update.mockResolvedValue({ ...newUser, teamId: 'team-id' });
      mockNotificationsService.notifyTeamInvite.mockResolvedValue(undefined);

      const result = await service.addMember('team-id', addMemberDto, mockOwnerUser);

      expect(result.teamId).toBe('team-id');
      expect(mockNotificationsService.notifyTeamInvite).toHaveBeenCalled();
    });

    it('should throw ConflictException if user already in team', async () => {
      mockPrismaService.team.findUnique.mockResolvedValue(mockTeam);
      mockPrismaService.user.findUnique.mockResolvedValue(mockActorUser);

      await expect(
        service.addMember('team-id', { userId: mockActorUser.id }, mockOwnerUser),
      ).rejects.toThrow(ConflictException);
    });

    it('should throw ForbiddenException if not OWNER or HEAD', async () => {
      mockPrismaService.team.findUnique.mockResolvedValue(mockTeam);

      await expect(service.addMember('team-id', addMemberDto, mockActorUser)).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe('removeMember', () => {
    it('should remove member successfully', async () => {
      mockPrismaService.team.findUnique.mockResolvedValue(mockTeam);
      mockPrismaService.user.findUnique.mockResolvedValue(mockActorUser);
      mockPrismaService.user.update.mockResolvedValue({ ...mockActorUser, teamId: null });
      mockNotificationsService.notifyTeamRemoved.mockResolvedValue(undefined);

      const result = await service.removeMember('team-id', mockActorUser.id, mockOwnerUser);

      expect(result).toEqual({ message: '멤버가 팀에서 제외되었습니다.' });
    });

    it('should throw ForbiddenException when trying to remove team owner', async () => {
      mockPrismaService.team.findUnique.mockResolvedValue(mockTeam);
      mockPrismaService.user.findUnique.mockResolvedValue({
        ...mockOwnerUser,
        teamId: 'team-id',
      });

      await expect(
        service.removeMember('team-id', mockOwnerUser.id, mockOwnerUser),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('createShare', () => {
    const createShareDto = {
      toTeamId: 'target-team-id',
      shareTasks: true,
      shareSchedules: false,
    };

    it('should create share successfully', async () => {
      mockPrismaService.team.findUnique
        .mockResolvedValueOnce(mockTeam)
        .mockResolvedValueOnce({ id: 'target-team-id', name: '대상 팀' });
      mockPrismaService.teamShare.findFirst.mockResolvedValue(null);
      mockPrismaService.teamShare.create.mockResolvedValue({
        id: 'share-id',
        fromTeamId: 'team-id',
        toTeamId: 'target-team-id',
        shareTasks: true,
        shareSchedules: false,
        fromTeam: { id: 'team-id', name: '테스트 팀' },
        toTeam: { id: 'target-team-id', name: '대상 팀' },
      });

      const result = await service.createShare('team-id', createShareDto, mockOwnerUser);

      expect(result.shareTasks).toBe(true);
      expect(result.shareSchedules).toBe(false);
    });

    it('should throw ConflictException if share already exists', async () => {
      mockPrismaService.team.findUnique
        .mockResolvedValueOnce(mockTeam)
        .mockResolvedValueOnce({ id: 'target-team-id', name: '대상 팀' });
      mockPrismaService.teamShare.findFirst.mockResolvedValue({ id: 'existing-share' });

      await expect(
        service.createShare('team-id', createShareDto, mockOwnerUser),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('getShares', () => {
    it('should return team shares', async () => {
      mockPrismaService.team.findUnique.mockResolvedValue(mockTeam);
      mockPrismaService.teamShare.findMany
        .mockResolvedValueOnce([{ id: 'share-1', toTeam: { id: 'team-2', name: '팀 2' } }])
        .mockResolvedValueOnce([{ id: 'share-2', fromTeam: { id: 'team-3', name: '팀 3' } }]);

      const result = await service.getShares('team-id', mockOwnerUser);

      expect(result.sharingTo).toHaveLength(1);
      expect(result.receivingFrom).toHaveLength(1);
    });
  });

  describe('removeShare', () => {
    it('should remove share successfully', async () => {
      mockPrismaService.teamShare.findUnique.mockResolvedValue({
        id: 'share-id',
        fromTeamId: 'team-id',
      });
      mockPrismaService.teamShare.delete.mockResolvedValue({});

      const result = await service.removeShare('share-id', mockOwnerUser);

      expect(result).toEqual({ message: '공유 설정이 삭제되었습니다.' });
    });

    it('should throw NotFoundException if share not found', async () => {
      mockPrismaService.teamShare.findUnique.mockResolvedValue(null);

      await expect(service.removeShare('non-existent-id', mockOwnerUser)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('getMyTeam', () => {
    it('should return user team', async () => {
      mockPrismaService.team.findUnique.mockResolvedValue({
        ...mockTeam,
        members: [],
      });

      const result = await service.getMyTeam(mockActorUser);

      expect(result?.id).toBe('team-id');
    });

    it('should return null if user has no team', async () => {
      const result = await service.getMyTeam(mockOwnerUser);

      expect(result).toBeNull();
    });
  });
});

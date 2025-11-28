import { Test, TestingModule } from '@nestjs/testing';
import { RetrospectivesService } from './retrospectives.service';
import { PrismaService } from '../../database/prisma.service';
import { NotFoundException, ForbiddenException } from '@nestjs/common';
import { UserRole, UserStatus, Visibility, RetroType } from '@prisma/client';

describe('RetrospectivesService', () => {
  let service: RetrospectivesService;

  const mockPrismaService = {
    retrospective: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
    },
    retrospectiveShare: {
      createMany: jest.fn(),
      deleteMany: jest.fn(),
      delete: jest.fn(),
    },
    $transaction: jest.fn(),
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

  const mockRetrospective = {
    id: 'retro-id',
    userId: 'user-id',
    type: RetroType.WEEKLY,
    title: '주간 회고',
    content: { good: '잘한 점', bad: '개선할 점', next: '다음 목표' },
    periodStart: new Date('2024-01-01'),
    periodEnd: new Date('2024-01-07'),
    isDraft: false,
    visibility: Visibility.PRIVATE,
    createdAt: new Date(),
    updatedAt: new Date(),
    user: {
      id: 'user-id',
      name: '테스트 사용자',
      email: 'test@example.com',
      teamId: 'team-id',
    },
    shares: [],
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RetrospectivesService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<RetrospectivesService>(RetrospectivesService);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    const createDto = {
      type: RetroType.WEEKLY,
      title: '새 회고',
      content: { good: '잘한 점', bad: '개선할 점' },
      periodStart: '2024-01-01',
      periodEnd: '2024-01-07',
      isDraft: true,
      visibility: Visibility.PRIVATE,
    };

    it('should create retrospective successfully', async () => {
      const createdRetro = { ...mockRetrospective, title: createDto.title };
      mockPrismaService.retrospective.create.mockResolvedValue(createdRetro);

      const result = await service.create(createDto, mockUser);

      expect(result.title).toBe(createDto.title);
      expect(mockPrismaService.retrospective.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: mockUser.id,
          type: createDto.type,
          title: createDto.title,
        }),
        include: expect.any(Object),
      });
    });

    it('should create retrospective with default values', async () => {
      const minimalDto = {
        type: RetroType.WEEKLY,
        title: '최소 회고',
        content: {},
        periodStart: '2024-01-01',
        periodEnd: '2024-01-07',
      };
      mockPrismaService.retrospective.create.mockResolvedValue(mockRetrospective);

      await service.create(minimalDto, mockUser);

      expect(mockPrismaService.retrospective.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          isDraft: true,
          visibility: Visibility.PRIVATE,
        }),
        include: expect.any(Object),
      });
    });
  });

  describe('findAll', () => {
    it('should return retrospectives with pagination', async () => {
      mockPrismaService.retrospective.findMany.mockResolvedValue([mockRetrospective]);
      mockPrismaService.retrospective.count.mockResolvedValue(1);

      const result = await service.findAll({ page: 1, limit: 20 }, mockUser);

      expect(result.data).toHaveLength(1);
      expect(result.meta.total).toBe(1);
      expect(result.meta.page).toBe(1);
      expect(result.meta.limit).toBe(20);
    });

    it('should filter by type', async () => {
      mockPrismaService.retrospective.findMany.mockResolvedValue([mockRetrospective]);
      mockPrismaService.retrospective.count.mockResolvedValue(1);

      await service.findAll({ type: RetroType.WEEKLY }, mockUser);

      expect(mockPrismaService.retrospective.findMany).toHaveBeenCalled();
    });

    it('should filter by visibility', async () => {
      mockPrismaService.retrospective.findMany.mockResolvedValue([mockRetrospective]);
      mockPrismaService.retrospective.count.mockResolvedValue(1);

      await service.findAll({ visibility: Visibility.PRIVATE }, mockUser);

      expect(mockPrismaService.retrospective.findMany).toHaveBeenCalled();
    });

    it('should filter by isDraft', async () => {
      mockPrismaService.retrospective.findMany.mockResolvedValue([mockRetrospective]);
      mockPrismaService.retrospective.count.mockResolvedValue(1);

      await service.findAll({ isDraft: false }, mockUser);

      expect(mockPrismaService.retrospective.findMany).toHaveBeenCalled();
    });

    it('should filter by period range', async () => {
      mockPrismaService.retrospective.findMany.mockResolvedValue([mockRetrospective]);
      mockPrismaService.retrospective.count.mockResolvedValue(1);

      await service.findAll(
        {
          periodStartFrom: '2024-01-01',
          periodStartTo: '2024-01-31',
        },
        mockUser,
      );

      expect(mockPrismaService.retrospective.findMany).toHaveBeenCalled();
    });
  });

  describe('findMy', () => {
    it('should return user own retrospectives', async () => {
      mockPrismaService.retrospective.findMany.mockResolvedValue([mockRetrospective]);
      mockPrismaService.retrospective.count.mockResolvedValue(1);

      const result = await service.findMy({ page: 1, limit: 20 }, mockUser);

      expect(result.data).toHaveLength(1);
      expect(result.meta.total).toBe(1);
    });

    it('should filter my retrospectives by type', async () => {
      mockPrismaService.retrospective.findMany.mockResolvedValue([mockRetrospective]);
      mockPrismaService.retrospective.count.mockResolvedValue(1);

      await service.findMy({ type: RetroType.WEEKLY }, mockUser);

      expect(mockPrismaService.retrospective.findMany).toHaveBeenCalled();
    });
  });

  describe('findOne', () => {
    it('should return retrospective by id for owner', async () => {
      mockPrismaService.retrospective.findUnique.mockResolvedValue(mockRetrospective);

      const result = await service.findOne('retro-id', mockUser);

      expect(result.id).toBe('retro-id');
    });

    it('should throw NotFoundException if not found', async () => {
      mockPrismaService.retrospective.findUnique.mockResolvedValue(null);

      await expect(service.findOne('non-existent-id', mockUser)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw ForbiddenException if user cannot access', async () => {
      const otherUserRetro = {
        ...mockRetrospective,
        userId: 'other-user-id',
        visibility: Visibility.PRIVATE,
        user: { ...mockRetrospective.user, id: 'other-user-id', teamId: 'other-team-id' },
        shares: [],
      };
      mockPrismaService.retrospective.findUnique.mockResolvedValue(otherUserRetro);

      await expect(service.findOne('retro-id', mockUser)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should allow access for ALL visibility', async () => {
      const publicRetro = {
        ...mockRetrospective,
        userId: 'other-user-id',
        visibility: Visibility.ALL,
        isDraft: false,
        user: { ...mockRetrospective.user, id: 'other-user-id' },
      };
      mockPrismaService.retrospective.findUnique.mockResolvedValue(publicRetro);

      const result = await service.findOne('retro-id', mockUser);

      expect(result.id).toBe('retro-id');
    });

    it('should allow access for TEAM visibility and same team', async () => {
      const teamRetro = {
        ...mockRetrospective,
        userId: 'other-user-id',
        visibility: Visibility.TEAM,
        isDraft: false,
        user: { ...mockRetrospective.user, id: 'other-user-id', teamId: 'team-id' },
      };
      mockPrismaService.retrospective.findUnique.mockResolvedValue(teamRetro);

      const result = await service.findOne('retro-id', mockUser);

      expect(result.id).toBe('retro-id');
    });

    it('should allow OWNER role to access any retrospective', async () => {
      const privateRetro = {
        ...mockRetrospective,
        userId: 'other-user-id',
        visibility: Visibility.PRIVATE,
        user: { ...mockRetrospective.user, id: 'other-user-id' },
      };
      mockPrismaService.retrospective.findUnique.mockResolvedValue(privateRetro);

      const result = await service.findOne('retro-id', mockOwnerUser);

      expect(result.id).toBe('retro-id');
    });

    it('should allow access if shared with user directly', async () => {
      const sharedRetro = {
        ...mockRetrospective,
        userId: 'other-user-id',
        visibility: Visibility.PRIVATE,
        user: { ...mockRetrospective.user, id: 'other-user-id', teamId: 'other-team-id' },
        shares: [{ sharedWithUserId: 'user-id', sharedWithTeamId: null }],
      };
      mockPrismaService.retrospective.findUnique.mockResolvedValue(sharedRetro);

      const result = await service.findOne('retro-id', mockUser);

      expect(result.id).toBe('retro-id');
    });

    it('should allow access if shared with user team', async () => {
      const sharedRetro = {
        ...mockRetrospective,
        userId: 'other-user-id',
        visibility: Visibility.PRIVATE,
        user: { ...mockRetrospective.user, id: 'other-user-id', teamId: 'other-team-id' },
        shares: [{ sharedWithUserId: null, sharedWithTeamId: 'team-id' }],
      };
      mockPrismaService.retrospective.findUnique.mockResolvedValue(sharedRetro);

      const result = await service.findOne('retro-id', mockUser);

      expect(result.id).toBe('retro-id');
    });
  });

  describe('update', () => {
    const updateDto = {
      title: '업데이트된 회고',
      content: { good: '좋은 점 수정' },
    };

    it('should update retrospective successfully', async () => {
      mockPrismaService.retrospective.findUnique.mockResolvedValue(mockRetrospective);
      mockPrismaService.retrospective.update.mockResolvedValue({
        ...mockRetrospective,
        ...updateDto,
      });

      const result = await service.update('retro-id', updateDto, mockUser);

      expect(result.title).toBe(updateDto.title);
    });

    it('should throw NotFoundException if not found', async () => {
      mockPrismaService.retrospective.findUnique.mockResolvedValue(null);

      await expect(service.update('non-existent-id', updateDto, mockUser)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw ForbiddenException if not owner', async () => {
      const otherUserRetro = { ...mockRetrospective, userId: 'other-user-id' };
      mockPrismaService.retrospective.findUnique.mockResolvedValue(otherUserRetro);

      await expect(service.update('retro-id', updateDto, mockUser)).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe('remove', () => {
    it('should remove retrospective as owner', async () => {
      mockPrismaService.retrospective.findUnique.mockResolvedValue(mockRetrospective);
      mockPrismaService.retrospective.delete.mockResolvedValue(mockRetrospective);

      const result = await service.remove('retro-id', mockUser);

      expect(result).toEqual({ message: '회고가 삭제되었습니다.' });
    });

    it('should throw NotFoundException if not found', async () => {
      mockPrismaService.retrospective.findUnique.mockResolvedValue(null);

      await expect(service.remove('non-existent-id', mockUser)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw ForbiddenException if not owner and not OWNER role', async () => {
      const otherUserRetro = { ...mockRetrospective, userId: 'other-user-id' };
      mockPrismaService.retrospective.findUnique.mockResolvedValue(otherUserRetro);

      await expect(service.remove('retro-id', mockUser)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should allow OWNER role to delete any retrospective', async () => {
      const otherUserRetro = { ...mockRetrospective, userId: 'other-user-id' };
      mockPrismaService.retrospective.findUnique.mockResolvedValue(otherUserRetro);
      mockPrismaService.retrospective.delete.mockResolvedValue(otherUserRetro);

      const result = await service.remove('retro-id', mockOwnerUser);

      expect(result).toEqual({ message: '회고가 삭제되었습니다.' });
    });
  });

  describe('publish', () => {
    it('should publish retrospective', async () => {
      mockPrismaService.retrospective.findUnique.mockResolvedValue({
        ...mockRetrospective,
        isDraft: true,
      });
      mockPrismaService.retrospective.update.mockResolvedValue({
        ...mockRetrospective,
        isDraft: false,
      });

      const result = await service.publish('retro-id', mockUser);

      expect(result.isDraft).toBe(false);
    });

    it('should throw NotFoundException if not found', async () => {
      mockPrismaService.retrospective.findUnique.mockResolvedValue(null);

      await expect(service.publish('non-existent-id', mockUser)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw ForbiddenException if not owner', async () => {
      const otherUserRetro = { ...mockRetrospective, userId: 'other-user-id' };
      mockPrismaService.retrospective.findUnique.mockResolvedValue(otherUserRetro);

      await expect(service.publish('retro-id', mockUser)).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe('share', () => {
    const shareDto = {
      userIds: ['shared-user-1', 'shared-user-2'],
      teamIds: ['shared-team-1'],
    };

    it('should share retrospective with users and teams', async () => {
      mockPrismaService.retrospective.findUnique.mockResolvedValue(mockRetrospective);
      mockPrismaService.$transaction.mockResolvedValue([{ count: 0 }, { count: 3 }]);
      mockPrismaService.retrospective.findUnique.mockResolvedValue({
        ...mockRetrospective,
        shares: [
          { sharedWithUserId: 'shared-user-1', sharedWithTeamId: null },
          { sharedWithUserId: 'shared-user-2', sharedWithTeamId: null },
          { sharedWithUserId: null, sharedWithTeamId: 'shared-team-1' },
        ],
      });

      const result = await service.share('retro-id', shareDto, mockUser);

      expect(result).toBeDefined();
      expect(mockPrismaService.$transaction).toHaveBeenCalled();
    });

    it('should throw NotFoundException if not found', async () => {
      mockPrismaService.retrospective.findUnique.mockResolvedValue(null);

      await expect(service.share('non-existent-id', shareDto, mockUser)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw ForbiddenException if not owner', async () => {
      const otherUserRetro = { ...mockRetrospective, userId: 'other-user-id' };
      mockPrismaService.retrospective.findUnique.mockResolvedValue(otherUserRetro);

      await expect(service.share('retro-id', shareDto, mockUser)).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe('addShare', () => {
    const shareDto = {
      userIds: ['new-shared-user'],
    };

    it('should add shares to retrospective', async () => {
      mockPrismaService.retrospective.findUnique.mockResolvedValue(mockRetrospective);
      mockPrismaService.retrospectiveShare.createMany.mockResolvedValue({ count: 1 });

      const result = await service.addShare('retro-id', shareDto, mockUser);

      expect(result).toBeDefined();
      expect(mockPrismaService.retrospectiveShare.createMany).toHaveBeenCalled();
    });

    it('should throw NotFoundException if not found', async () => {
      mockPrismaService.retrospective.findUnique.mockResolvedValue(null);

      await expect(service.addShare('non-existent-id', shareDto, mockUser)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw ForbiddenException if not owner', async () => {
      const otherUserRetro = { ...mockRetrospective, userId: 'other-user-id' };
      mockPrismaService.retrospective.findUnique.mockResolvedValue(otherUserRetro);

      await expect(service.addShare('retro-id', shareDto, mockUser)).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe('removeShare', () => {
    it('should remove share from retrospective', async () => {
      mockPrismaService.retrospective.findUnique.mockResolvedValue(mockRetrospective);
      mockPrismaService.retrospectiveShare.delete.mockResolvedValue({});

      const result = await service.removeShare('retro-id', 'share-id', mockUser);

      expect(result).toEqual({ message: '공유가 해제되었습니다.' });
    });

    it('should throw NotFoundException if retrospective not found', async () => {
      mockPrismaService.retrospective.findUnique.mockResolvedValue(null);

      await expect(
        service.removeShare('non-existent-id', 'share-id', mockUser),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException if not owner', async () => {
      const otherUserRetro = { ...mockRetrospective, userId: 'other-user-id' };
      mockPrismaService.retrospective.findUnique.mockResolvedValue(otherUserRetro);

      await expect(
        service.removeShare('retro-id', 'share-id', mockUser),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('getSharedWithMe', () => {
    it('should return retrospectives shared with user', async () => {
      const sharedRetro = {
        ...mockRetrospective,
        userId: 'other-user-id',
        user: { ...mockRetrospective.user, id: 'other-user-id' },
      };
      mockPrismaService.retrospective.findMany.mockResolvedValue([sharedRetro]);
      mockPrismaService.retrospective.count.mockResolvedValue(1);

      const result = await service.getSharedWithMe({ page: 1, limit: 20 }, mockUser);

      expect(result.data).toHaveLength(1);
      expect(result.meta.total).toBe(1);
    });

    it('should filter shared retrospectives by type', async () => {
      mockPrismaService.retrospective.findMany.mockResolvedValue([]);
      mockPrismaService.retrospective.count.mockResolvedValue(0);

      await service.getSharedWithMe(
        { type: RetroType.WEEKLY },
        mockUser,
      );

      expect(mockPrismaService.retrospective.findMany).toHaveBeenCalled();
    });
  });
});

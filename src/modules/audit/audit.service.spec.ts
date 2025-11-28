import { Test, TestingModule } from '@nestjs/testing';
import { AuditService, AuditAction, EntityType } from './audit.service';
import { PrismaService } from '../../database/prisma.service';
import { UserRole, UserStatus } from '@prisma/client';

describe('AuditService', () => {
  let service: AuditService;

  const mockPrismaService = {
    auditLog: {
      create: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      groupBy: jest.fn(),
    },
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

  const mockAuditLog = {
    id: 'audit-id',
    userId: 'user-id',
    action: AuditAction.LOGIN,
    entityType: EntityType.USER,
    entityId: 'user-id',
    oldData: null,
    newData: null,
    ipAddress: '127.0.0.1',
    userAgent: 'Mozilla/5.0',
    createdAt: new Date(),
    user: {
      id: 'user-id',
      name: '테스트 사용자',
      email: 'test@example.com',
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuditService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<AuditService>(AuditService);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('log', () => {
    it('should create audit log successfully', async () => {
      mockPrismaService.auditLog.create.mockResolvedValue(mockAuditLog);

      await service.log({
        action: AuditAction.LOGIN,
        entityType: EntityType.USER,
        entityId: 'user-id',
        userId: 'user-id',
        ipAddress: '127.0.0.1',
        userAgent: 'Mozilla/5.0',
      });

      expect(mockPrismaService.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          action: AuditAction.LOGIN,
          entityType: EntityType.USER,
          entityId: 'user-id',
        }),
      });
    });

    it('should create audit log with old and new data', async () => {
      mockPrismaService.auditLog.create.mockResolvedValue(mockAuditLog);

      await service.log({
        action: AuditAction.USER_ROLE_CHANGE,
        entityType: EntityType.USER,
        entityId: 'user-id',
        userId: 'admin-id',
        oldData: { role: UserRole.ACTOR },
        newData: { role: UserRole.LEAD },
      });

      expect(mockPrismaService.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          oldData: { role: UserRole.ACTOR },
          newData: { role: UserRole.LEAD },
        }),
      });
    });

    it('should handle audit log creation error gracefully', async () => {
      mockPrismaService.auditLog.create.mockRejectedValue(new Error('DB Error'));

      // Should not throw
      await expect(
        service.log({
          action: AuditAction.LOGIN,
          entityType: EntityType.USER,
          userId: 'user-id',
        }),
      ).resolves.not.toThrow();
    });
  });

  describe('findAll', () => {
    it('should return audit logs for OWNER', async () => {
      mockPrismaService.auditLog.findMany.mockResolvedValue([mockAuditLog]);
      mockPrismaService.auditLog.count.mockResolvedValue(1);

      const result = await service.findAll({ page: 1, limit: 20 }, mockOwnerUser);

      expect(result.data).toHaveLength(1);
      expect(result.meta.total).toBe(1);
    });

    it('should return audit logs for HEAD', async () => {
      mockPrismaService.auditLog.findMany.mockResolvedValue([mockAuditLog]);
      mockPrismaService.auditLog.count.mockResolvedValue(1);

      const result = await service.findAll({ page: 1, limit: 20 }, mockHeadUser);

      expect(result.data).toHaveLength(1);
    });

    it('should return empty for non-OWNER/HEAD users', async () => {
      const result = await service.findAll({ page: 1, limit: 20 }, mockActorUser);

      expect(result.data).toEqual([]);
      expect(result.meta.total).toBe(0);
      expect(mockPrismaService.auditLog.findMany).not.toHaveBeenCalled();
    });

    it('should filter by userId', async () => {
      mockPrismaService.auditLog.findMany.mockResolvedValue([mockAuditLog]);
      mockPrismaService.auditLog.count.mockResolvedValue(1);

      await service.findAll({ userId: 'specific-user-id' }, mockOwnerUser);

      expect(mockPrismaService.auditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            userId: 'specific-user-id',
          }),
        }),
      );
    });

    it('should filter by action', async () => {
      mockPrismaService.auditLog.findMany.mockResolvedValue([mockAuditLog]);
      mockPrismaService.auditLog.count.mockResolvedValue(1);

      await service.findAll({ action: AuditAction.LOGIN }, mockOwnerUser);

      expect(mockPrismaService.auditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            action: AuditAction.LOGIN,
          }),
        }),
      );
    });

    it('should filter by entityType', async () => {
      mockPrismaService.auditLog.findMany.mockResolvedValue([mockAuditLog]);
      mockPrismaService.auditLog.count.mockResolvedValue(1);

      await service.findAll({ entityType: EntityType.USER }, mockOwnerUser);

      expect(mockPrismaService.auditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            entityType: EntityType.USER,
          }),
        }),
      );
    });

    it('should filter by entityId', async () => {
      mockPrismaService.auditLog.findMany.mockResolvedValue([mockAuditLog]);
      mockPrismaService.auditLog.count.mockResolvedValue(1);

      await service.findAll({ entityId: 'specific-entity-id' }, mockOwnerUser);

      expect(mockPrismaService.auditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            entityId: 'specific-entity-id',
          }),
        }),
      );
    });

    it('should filter by date range', async () => {
      mockPrismaService.auditLog.findMany.mockResolvedValue([mockAuditLog]);
      mockPrismaService.auditLog.count.mockResolvedValue(1);

      await service.findAll(
        {
          startDate: '2024-01-01',
          endDate: '2024-01-31',
        },
        mockOwnerUser,
      );

      expect(mockPrismaService.auditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            createdAt: expect.objectContaining({
              gte: expect.any(Date),
              lte: expect.any(Date),
            }),
          }),
        }),
      );
    });

    it('should support sorting', async () => {
      mockPrismaService.auditLog.findMany.mockResolvedValue([mockAuditLog]);
      mockPrismaService.auditLog.count.mockResolvedValue(1);

      await service.findAll(
        { sortBy: 'action', sortOrder: 'asc' },
        mockOwnerUser,
      );

      expect(mockPrismaService.auditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { action: 'asc' },
        }),
      );
    });

    it('should use default sorting', async () => {
      mockPrismaService.auditLog.findMany.mockResolvedValue([mockAuditLog]);
      mockPrismaService.auditLog.count.mockResolvedValue(1);

      await service.findAll({}, mockOwnerUser);

      expect(mockPrismaService.auditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { createdAt: 'desc' },
        }),
      );
    });
  });

  describe('findByEntity', () => {
    it('should return audit logs for entity for OWNER', async () => {
      mockPrismaService.auditLog.findMany.mockResolvedValue([mockAuditLog]);

      const result = await service.findByEntity(
        EntityType.USER,
        'user-id',
        mockOwnerUser,
      );

      expect(result).toHaveLength(1);
      expect(mockPrismaService.auditLog.findMany).toHaveBeenCalledWith({
        where: {
          entityType: EntityType.USER,
          entityId: 'user-id',
        },
        include: expect.any(Object),
        orderBy: { createdAt: 'desc' },
        take: 50,
      });
    });

    it('should return audit logs for entity for HEAD', async () => {
      mockPrismaService.auditLog.findMany.mockResolvedValue([mockAuditLog]);

      const result = await service.findByEntity(
        EntityType.TASK,
        'task-id',
        mockHeadUser,
      );

      expect(result).toHaveLength(1);
    });

    it('should return empty for non-OWNER/HEAD users', async () => {
      const result = await service.findByEntity(
        EntityType.USER,
        'user-id',
        mockActorUser,
      );

      expect(result).toEqual([]);
      expect(mockPrismaService.auditLog.findMany).not.toHaveBeenCalled();
    });
  });

  describe('getStats', () => {
    it('should return stats for OWNER', async () => {
      mockPrismaService.auditLog.count
        .mockResolvedValueOnce(10)
        .mockResolvedValueOnce(50);
      mockPrismaService.auditLog.groupBy.mockResolvedValue([
        { action: AuditAction.LOGIN, _count: { action: 20 } },
        { action: AuditAction.TASK_CREATE, _count: { action: 15 } },
        { action: AuditAction.TASK_UPDATE, _count: { action: 10 } },
      ]);

      const result = await service.getStats(mockOwnerUser);

      expect(result.todayCount).toBe(10);
      expect(result.weekCount).toBe(50);
      expect(result.topActions).toHaveLength(3);
      expect(result.topActions[0]).toEqual({
        action: AuditAction.LOGIN,
        count: 20,
      });
    });

    it('should return empty for non-OWNER users', async () => {
      const result = await service.getStats(mockHeadUser);

      expect(result).toEqual({});
      expect(mockPrismaService.auditLog.count).not.toHaveBeenCalled();
    });

    it('should return empty for ACTOR users', async () => {
      const result = await service.getStats(mockActorUser);

      expect(result).toEqual({});
    });
  });
});

import { Test, TestingModule } from '@nestjs/testing';
import { NetworkWhitelistService } from './network-whitelist.service';
import { PrismaService } from '../../database/prisma.service';
import { NotFoundException } from '@nestjs/common';
import { UserRole, UserStatus } from '@prisma/client';

describe('NetworkWhitelistService', () => {
  let service: NetworkWhitelistService;

  const mockPrismaService = {
    networkWhitelist: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  };

  const mockUser = {
    id: 'owner-id',
    email: 'owner@example.com',
    name: 'Owner',
    role: UserRole.OWNER,
    status: UserStatus.ACTIVE,
    teamId: null,
  };

  const mockWhitelistEntry = {
    id: 'whitelist-id',
    cidr: '192.168.1.0/24',
    description: '사내 네트워크',
    isEnabled: true,
    createdBy: 'owner-id',
    createdAt: new Date(),
    updatedAt: new Date(),
    creator: {
      id: 'owner-id',
      name: 'Owner',
      email: 'owner@example.com',
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NetworkWhitelistService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<NetworkWhitelistService>(NetworkWhitelistService);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    const createDto = {
      cidr: '10.0.0.0/8',
      description: '새 화이트리스트',
      isEnabled: true,
    };

    it('should create whitelist entry successfully', async () => {
      const createdEntry = { ...mockWhitelistEntry, cidr: createDto.cidr };
      mockPrismaService.networkWhitelist.create.mockResolvedValue(createdEntry);

      const result = await service.create(createDto, mockUser);

      expect(result.cidr).toBe(createDto.cidr);
      expect(mockPrismaService.networkWhitelist.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          cidr: createDto.cidr,
          description: createDto.description,
          isEnabled: true,
          createdBy: mockUser.id,
        }),
        include: expect.any(Object),
      });
    });

    it('should create with default isEnabled = true', async () => {
      const dtoWithoutEnabled = {
        cidr: '10.0.0.0/8',
        description: '테스트',
      };
      mockPrismaService.networkWhitelist.create.mockResolvedValue(mockWhitelistEntry);

      await service.create(dtoWithoutEnabled, mockUser);

      expect(mockPrismaService.networkWhitelist.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          isEnabled: true,
        }),
        include: expect.any(Object),
      });
    });
  });

  describe('findAll', () => {
    it('should return all whitelist entries', async () => {
      mockPrismaService.networkWhitelist.findMany.mockResolvedValue([mockWhitelistEntry]);

      const result = await service.findAll();

      expect(result).toHaveLength(1);
      expect(result[0].cidr).toBe(mockWhitelistEntry.cidr);
      expect(mockPrismaService.networkWhitelist.findMany).toHaveBeenCalledWith({
        include: expect.any(Object),
        orderBy: { createdAt: 'desc' },
      });
    });

    it('should return empty array when no entries', async () => {
      mockPrismaService.networkWhitelist.findMany.mockResolvedValue([]);

      const result = await service.findAll();

      expect(result).toEqual([]);
    });
  });

  describe('findEnabled', () => {
    it('should return only enabled entries', async () => {
      mockPrismaService.networkWhitelist.findMany.mockResolvedValue([
        { cidr: '192.168.1.0/24' },
        { cidr: '10.0.0.0/8' },
      ]);

      const result = await service.findEnabled();

      expect(result).toHaveLength(2);
      expect(mockPrismaService.networkWhitelist.findMany).toHaveBeenCalledWith({
        where: { isEnabled: true },
        select: { cidr: true },
      });
    });
  });

  describe('findOne', () => {
    it('should return whitelist entry by id', async () => {
      mockPrismaService.networkWhitelist.findUnique.mockResolvedValue(mockWhitelistEntry);

      const result = await service.findOne('whitelist-id');

      expect(result.id).toBe('whitelist-id');
      expect(result.cidr).toBe(mockWhitelistEntry.cidr);
    });

    it('should throw NotFoundException if not found', async () => {
      mockPrismaService.networkWhitelist.findUnique.mockResolvedValue(null);

      await expect(service.findOne('non-existent-id')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('update', () => {
    const updateDto = {
      cidr: '172.16.0.0/12',
      description: '업데이트된 설명',
      isEnabled: false,
    };

    it('should update whitelist entry successfully', async () => {
      mockPrismaService.networkWhitelist.findUnique.mockResolvedValue(mockWhitelistEntry);
      mockPrismaService.networkWhitelist.update.mockResolvedValue({
        ...mockWhitelistEntry,
        ...updateDto,
      });

      const result = await service.update('whitelist-id', updateDto, mockUser);

      expect(result.cidr).toBe(updateDto.cidr);
      expect(result.description).toBe(updateDto.description);
      expect(result.isEnabled).toBe(false);
    });

    it('should throw NotFoundException if not found', async () => {
      mockPrismaService.networkWhitelist.findUnique.mockResolvedValue(null);

      await expect(
        service.update('non-existent-id', updateDto, mockUser),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('remove', () => {
    it('should remove whitelist entry successfully', async () => {
      mockPrismaService.networkWhitelist.findUnique.mockResolvedValue(mockWhitelistEntry);
      mockPrismaService.networkWhitelist.delete.mockResolvedValue(mockWhitelistEntry);

      const result = await service.remove('whitelist-id', mockUser);

      expect(result).toEqual({ message: '화이트리스트 항목이 삭제되었습니다.' });
      expect(mockPrismaService.networkWhitelist.delete).toHaveBeenCalledWith({
        where: { id: 'whitelist-id' },
      });
    });

    it('should throw NotFoundException if not found', async () => {
      mockPrismaService.networkWhitelist.findUnique.mockResolvedValue(null);

      await expect(service.remove('non-existent-id', mockUser)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('toggleEnabled', () => {
    it('should toggle enabled to disabled', async () => {
      mockPrismaService.networkWhitelist.findUnique.mockResolvedValue({
        ...mockWhitelistEntry,
        isEnabled: true,
      });
      mockPrismaService.networkWhitelist.update.mockResolvedValue({
        ...mockWhitelistEntry,
        isEnabled: false,
      });

      const result = await service.toggleEnabled('whitelist-id', mockUser);

      expect(result.isEnabled).toBe(false);
      expect(mockPrismaService.networkWhitelist.update).toHaveBeenCalledWith({
        where: { id: 'whitelist-id' },
        data: { isEnabled: false },
        include: expect.any(Object),
      });
    });

    it('should toggle disabled to enabled', async () => {
      mockPrismaService.networkWhitelist.findUnique.mockResolvedValue({
        ...mockWhitelistEntry,
        isEnabled: false,
      });
      mockPrismaService.networkWhitelist.update.mockResolvedValue({
        ...mockWhitelistEntry,
        isEnabled: true,
      });

      const result = await service.toggleEnabled('whitelist-id', mockUser);

      expect(result.isEnabled).toBe(true);
    });

    it('should throw NotFoundException if not found', async () => {
      mockPrismaService.networkWhitelist.findUnique.mockResolvedValue(null);

      await expect(
        service.toggleEnabled('non-existent-id', mockUser),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('isIpAllowed', () => {
    it('should return true when whitelist is empty', () => {
      const result = service.isIpAllowed('192.168.1.100', []);

      expect(result).toBe(true);
    });

    it('should return true when IP is in CIDR range', () => {
      const result = service.isIpAllowed('192.168.1.100', [
        { cidr: '192.168.1.0/24' },
      ]);

      expect(result).toBe(true);
    });

    it('should return false when IP is not in CIDR range', () => {
      const result = service.isIpAllowed('10.0.0.1', [
        { cidr: '192.168.1.0/24' },
      ]);

      expect(result).toBe(false);
    });

    it('should return true when IP matches exact CIDR', () => {
      const result = service.isIpAllowed('192.168.1.1', [
        { cidr: '192.168.1.1/32' },
      ]);

      expect(result).toBe(true);
    });

    it('should return false when IP does not match exact CIDR', () => {
      const result = service.isIpAllowed('192.168.1.2', [
        { cidr: '192.168.1.1/32' },
      ]);

      expect(result).toBe(false);
    });

    it('should return true when IP matches any CIDR in list', () => {
      const result = service.isIpAllowed('10.0.0.50', [
        { cidr: '192.168.1.0/24' },
        { cidr: '10.0.0.0/8' },
        { cidr: '172.16.0.0/12' },
      ]);

      expect(result).toBe(true);
    });

    it('should handle /0 CIDR (all IPs)', () => {
      const result = service.isIpAllowed('1.2.3.4', [{ cidr: '0.0.0.0/0' }]);

      expect(result).toBe(true);
    });

    it('should handle /8 class A network', () => {
      const result = service.isIpAllowed('10.255.255.255', [
        { cidr: '10.0.0.0/8' },
      ]);

      expect(result).toBe(true);
    });

    it('should handle /16 class B network', () => {
      const result = service.isIpAllowed('172.16.255.255', [
        { cidr: '172.16.0.0/16' },
      ]);

      expect(result).toBe(true);
    });

    it('should handle CIDR without mask (treat as /32)', () => {
      const result = service.isIpAllowed('192.168.1.1', [
        { cidr: '192.168.1.1' },
      ]);

      expect(result).toBe(true);
    });

    it('should return false for IP outside CIDR without mask', () => {
      const result = service.isIpAllowed('192.168.1.2', [
        { cidr: '192.168.1.1' },
      ]);

      expect(result).toBe(false);
    });
  });
});

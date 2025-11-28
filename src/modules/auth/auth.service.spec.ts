import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { PrismaService } from '../../database/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { UserStatus, UserRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';

// Mock bcrypt
jest.mock('bcrypt', () => ({
  hash: jest.fn(),
  compare: jest.fn(),
}));

describe('AuthService', () => {
  let service: AuthService;
  let prismaService: PrismaService;
  let jwtService: JwtService;

  const mockPrismaService = {
    user: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
    refreshToken: {
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
  };

  const mockJwtService = {
    sign: jest.fn(),
  };

  const mockConfigService = {
    get: jest.fn((key: string) => {
      const config: Record<string, string> = {
        'jwt.secret': 'test-secret',
        'jwt.refreshSecret': 'test-refresh-secret',
        'app.env': 'test',
      };
      return config[key];
    }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: JwtService, useValue: mockJwtService },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    prismaService = module.get<PrismaService>(PrismaService);
    jwtService = module.get<JwtService>(JwtService);

    // Reset all mocks
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('signup', () => {
    const signupDto = {
      email: 'test@example.com',
      password: 'password123',
      name: '테스트 사용자',
    };

    it('should create a new user successfully', async () => {
      const mockUser = {
        id: 'user-id',
        email: signupDto.email,
        name: signupDto.name,
        status: UserStatus.PENDING,
      };

      mockPrismaService.user.findUnique.mockResolvedValue(null);
      mockPrismaService.user.create.mockResolvedValue(mockUser);
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed-password');

      const result = await service.signup(signupDto);

      expect(result).toEqual({
        id: mockUser.id,
        email: mockUser.email,
        name: mockUser.name,
        status: UserStatus.PENDING,
        message: '가입 신청이 완료되었습니다. 관리자 승인 후 이용 가능합니다.',
      });
      expect(mockPrismaService.user.create).toHaveBeenCalledWith({
        data: {
          email: signupDto.email,
          passwordHash: 'hashed-password',
          name: signupDto.name,
          status: UserStatus.PENDING,
        },
        select: {
          id: true,
          email: true,
          name: true,
          status: true,
        },
      });
    });

    it('should throw ConflictException if email already exists', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({
        id: 'existing-user',
        email: signupDto.email,
      });

      await expect(service.signup(signupDto)).rejects.toThrow(ConflictException);
    });
  });

  describe('login', () => {
    const loginDto = {
      email: 'test@example.com',
      password: 'password123',
    };

    const mockUser = {
      id: 'user-id',
      email: 'test@example.com',
      name: '테스트 사용자',
      passwordHash: 'hashed-password',
      role: UserRole.ACTOR,
      status: UserStatus.ACTIVE,
      teamId: 'team-id',
      profileImageUrl: null,
    };

    it('should login successfully with valid credentials', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      mockJwtService.sign.mockReturnValueOnce('access-token').mockReturnValueOnce('refresh-token');
      mockPrismaService.refreshToken.create.mockResolvedValue({});

      const result = await service.login(loginDto);

      expect(result).toHaveProperty('accessToken', 'access-token');
      expect(result).toHaveProperty('refreshToken', 'refresh-token');
      expect(result.user).toEqual({
        id: mockUser.id,
        email: mockUser.email,
        name: mockUser.name,
        role: mockUser.role,
        teamId: mockUser.teamId,
        profileImageUrl: mockUser.profileImageUrl,
      });
    });

    it('should throw UnauthorizedException if user not found', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);

      await expect(service.login(loginDto)).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException if password is invalid', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(service.login(loginDto)).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException if user status is PENDING', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({
        ...mockUser,
        status: UserStatus.PENDING,
      });
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      await expect(service.login(loginDto)).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException if user status is INACTIVE', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({
        ...mockUser,
        status: UserStatus.INACTIVE,
      });
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      await expect(service.login(loginDto)).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('logout', () => {
    it('should logout successfully', async () => {
      mockPrismaService.refreshToken.updateMany.mockResolvedValue({ count: 1 });

      const result = await service.logout('user-id', 'refresh-token');

      expect(result).toEqual({ message: '로그아웃되었습니다.' });
    });

    it('should logout without refresh token', async () => {
      const result = await service.logout('user-id');

      expect(result).toEqual({ message: '로그아웃되었습니다.' });
      expect(mockPrismaService.refreshToken.updateMany).not.toHaveBeenCalled();
    });
  });

  describe('getMe', () => {
    it('should return current user info', async () => {
      const mockUser = {
        id: 'user-id',
        email: 'test@example.com',
        name: '테스트 사용자',
        role: UserRole.ACTOR,
        status: UserStatus.ACTIVE,
        teamId: 'team-id',
        profileImageUrl: null,
        createdAt: new Date(),
        team: { id: 'team-id', name: '테스트 팀' },
        integrations: [{ provider: 'GITHUB' }],
      };

      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);

      const result = await service.getMe('user-id');

      expect(result.id).toBe(mockUser.id);
      expect(result.integrations).toEqual({
        github: true,
        slack: false,
      });
    });

    it('should throw UnauthorizedException if user not found', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);

      await expect(service.getMe('non-existent-id')).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('refresh', () => {
    it('should refresh tokens successfully', async () => {
      const mockUser = {
        id: 'user-id',
        email: 'test@example.com',
        name: '테스트 사용자',
        role: UserRole.ACTOR,
        status: UserStatus.ACTIVE,
        teamId: 'team-id',
      };

      mockPrismaService.refreshToken.update.mockResolvedValue({});
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
      mockJwtService.sign.mockReturnValueOnce('new-access-token').mockReturnValueOnce('new-refresh-token');
      mockPrismaService.refreshToken.create.mockResolvedValue({});

      const result = await service.refresh({
        id: 'user-id',
        email: 'test@example.com',
        name: '테스트 사용자',
        role: UserRole.ACTOR,
        status: UserStatus.ACTIVE,
        teamId: 'team-id',
        tokenId: 'token-id',
      });

      expect(result).toHaveProperty('accessToken', 'new-access-token');
      expect(result).toHaveProperty('refreshToken', 'new-refresh-token');
    });

    it('should throw UnauthorizedException if user not found during refresh', async () => {
      mockPrismaService.refreshToken.update.mockResolvedValue({});
      mockPrismaService.user.findUnique.mockResolvedValue(null);

      await expect(
        service.refresh({
          id: 'user-id',
          email: 'test@example.com',
          name: '테스트 사용자',
          role: UserRole.ACTOR,
          status: UserStatus.ACTIVE,
          teamId: 'team-id',
          tokenId: 'token-id',
        }),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('getCookieOptions', () => {
    it('should return access token cookie options', () => {
      const options = service.getCookieOptions('access');

      expect(options).toHaveProperty('httpOnly', true);
      expect(options).toHaveProperty('path', '/');
      expect(options).toHaveProperty('maxAge', 15 * 60 * 1000);
    });

    it('should return refresh token cookie options', () => {
      const options = service.getCookieOptions('refresh');

      expect(options).toHaveProperty('httpOnly', true);
      expect(options).toHaveProperty('path', '/api/v1/auth');
      expect(options).toHaveProperty('maxAge', 7 * 24 * 60 * 60 * 1000);
    });
  });
});

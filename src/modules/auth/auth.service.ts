import {
  Injectable,
  ConflictException,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../database/prisma.service';
import { SignupDto, LoginDto } from './dto';
import { ErrorCodes } from '../../common/constants';
import { JwtPayload, RequestUser } from '../../common/interfaces';
import { CryptoUtil } from '../../common/utils';
import { UserStatus } from '@prisma/client';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {}

  async signup(dto: SignupDto) {
    const existingUser = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (existingUser) {
      throw new ConflictException(ErrorCodes.EMAIL_ALREADY_EXISTS);
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);

    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        passwordHash,
        name: dto.name,
        status: UserStatus.PENDING,
      },
      select: {
        id: true,
        email: true,
        name: true,
        status: true,
      },
    });

    this.logger.log(`New user registered: ${user.email}`);

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      status: user.status,
      message: '가입 신청이 완료되었습니다. 관리자 승인 후 이용 가능합니다.',
    };
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (!user) {
      throw new UnauthorizedException(ErrorCodes.INVALID_CREDENTIALS);
    }

    const isPasswordValid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!isPasswordValid) {
      throw new UnauthorizedException(ErrorCodes.INVALID_CREDENTIALS);
    }

    if (user.status === UserStatus.PENDING) {
      throw new UnauthorizedException(ErrorCodes.USER_PENDING);
    }

    if (user.status === UserStatus.INACTIVE) {
      throw new UnauthorizedException(ErrorCodes.USER_INACTIVE);
    }

    const tokens = await this.generateTokens(user);

    this.logger.log(`User logged in: ${user.email}`);

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        teamId: user.teamId,
        profileImageUrl: user.profileImageUrl,
      },
      ...tokens,
    };
  }

  async refresh(user: RequestUser & { tokenId: string }) {
    // Revoke the old refresh token
    await this.prisma.refreshToken.update({
      where: { id: user.tokenId },
      data: { isRevoked: true },
    });

    const dbUser = await this.prisma.user.findUnique({
      where: { id: user.id },
    });

    if (!dbUser) {
      throw new UnauthorizedException(ErrorCodes.UNAUTHORIZED);
    }

    const tokens = await this.generateTokens(dbUser);

    return tokens;
  }

  async logout(userId: string, refreshToken?: string) {
    if (refreshToken) {
      const tokenHash = CryptoUtil.hash(refreshToken);
      await this.prisma.refreshToken.updateMany({
        where: { tokenHash },
        data: { isRevoked: true },
      });
    }

    // Optionally revoke all refresh tokens for the user
    // await this.prisma.refreshToken.updateMany({
    //   where: { userId },
    //   data: { isRevoked: true },
    // });

    return { message: '로그아웃되었습니다.' };
  }

  async getMe(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        status: true,
        teamId: true,
        profileImageUrl: true,
        createdAt: true,
        team: {
          select: {
            id: true,
            name: true,
          },
        },
        integrations: {
          select: {
            provider: true,
          },
        },
      },
    });

    if (!user) {
      throw new UnauthorizedException(ErrorCodes.UNAUTHORIZED);
    }

    return {
      ...user,
      integrations: {
        github: user.integrations.some((i) => i.provider === 'GITHUB'),
        slack: user.integrations.some((i) => i.provider === 'SLACK'),
      },
    };
  }

  private async generateTokens(user: {
    id: string;
    email: string;
    name: string;
    role: any;
    status: any;
    teamId: string | null;
  }) {
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      status: user.status,
      teamId: user.teamId,
    };

    const accessToken = this.jwtService.sign(payload as any, {
      secret: this.configService.get<string>('jwt.secret') || 'default-secret',
      expiresIn: '15m' as const,
    });

    const refreshToken = this.jwtService.sign(
      { sub: user.id } as any,
      {
        secret: this.configService.get<string>('jwt.refreshSecret') || 'default-refresh-secret',
        expiresIn: '7d' as const,
      },
    );

    // Store refresh token in database
    const tokenHash = CryptoUtil.hash(refreshToken);
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 days

    await this.prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash,
        expiresAt,
      },
    });

    return { accessToken, refreshToken };
  }

  getCookieOptions(type: 'access' | 'refresh') {
    const isProduction = this.configService.get<string>('app.env') === 'production';

    const baseOptions = {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? ('strict' as const) : ('lax' as const),
    };

    if (type === 'access') {
      return {
        ...baseOptions,
        path: '/',
        maxAge: 15 * 60 * 1000, // 15 minutes
      };
    }

    return {
      ...baseOptions,
      path: '/api/v1/auth',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    };
  }
}

import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { Request } from 'express';
import { JwtRefreshPayload } from '../../../common/interfaces';
import { ErrorCodes } from '../../../common/constants';
import { PrismaService } from '../../../database/prisma.service';
import { CryptoUtil } from '../../../common/utils';

@Injectable()
export class JwtRefreshStrategy extends PassportStrategy(Strategy, 'jwt-refresh') {
  constructor(
    private configService: ConfigService,
    private prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        (request: Request) => {
          return request?.cookies?.refreshToken;
        },
      ]),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('jwt.refreshSecret') || 'default-refresh-secret',
      passReqToCallback: true,
    } as any);
  }

  async validate(request: Request, payload: JwtRefreshPayload) {
    const refreshToken = request.cookies?.refreshToken;
    if (!refreshToken) {
      throw new UnauthorizedException(ErrorCodes.INVALID_TOKEN);
    }

    const tokenHash = CryptoUtil.hash(refreshToken);
    const storedToken = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
      include: { user: true },
    });

    if (!storedToken || storedToken.isRevoked) {
      throw new UnauthorizedException(ErrorCodes.INVALID_TOKEN);
    }

    if (storedToken.expiresAt < new Date()) {
      throw new UnauthorizedException(ErrorCodes.TOKEN_EXPIRED);
    }

    return {
      id: storedToken.user.id,
      email: storedToken.user.email,
      name: storedToken.user.name,
      role: storedToken.user.role,
      status: storedToken.user.status,
      teamId: storedToken.user.teamId,
      tokenId: storedToken.id,
    };
  }
}

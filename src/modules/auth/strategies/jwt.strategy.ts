import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { Request } from 'express';
import { JwtPayload, RequestUser } from '../../../common/interfaces';
import { ErrorCodes } from '../../../common/constants';
import { PrismaService } from '../../../database/prisma.service';
import { UserStatus } from '@prisma/client';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    private configService: ConfigService,
    private prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        (request: Request) => {
          return request?.cookies?.accessToken;
        },
        ExtractJwt.fromAuthHeaderAsBearerToken(),
      ]),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('jwt.secret') || 'default-secret',
    });
  }

  async validate(payload: JwtPayload): Promise<RequestUser> {
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        status: true,
        teamId: true,
      },
    });

    if (!user) {
      throw new UnauthorizedException(ErrorCodes.UNAUTHORIZED);
    }

    if (user.status === UserStatus.PENDING) {
      throw new UnauthorizedException(ErrorCodes.USER_PENDING);
    }

    if (user.status === UserStatus.INACTIVE) {
      throw new UnauthorizedException(ErrorCodes.USER_INACTIVE);
    }

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      status: user.status,
      teamId: user.teamId,
    };
  }
}

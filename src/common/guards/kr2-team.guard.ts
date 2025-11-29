import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { RequestUser } from '../interfaces/request-user.interface';

/**
 * 개발팀 전용 가드
 *
 * KR2, KR3팀에 소속된 사용자만 접근할 수 있도록 제한합니다.
 * OWNER 역할은 팀에 관계없이 항상 접근 가능합니다.
 */
@Injectable()
export class Kr2TeamGuard implements CanActivate {
  private static readonly DEV_TEAM_NAMES = ['KR2', 'KR3'];

  constructor(private prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user as RequestUser;

    if (!user) {
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message: '인증이 필요합니다.',
      });
    }

    // OWNER는 항상 접근 가능
    if (user.role === 'OWNER') {
      return true;
    }

    // 팀이 없는 경우
    if (!user.teamId) {
      throw new ForbiddenException({
        code: 'DEV_TEAM_REQUIRED',
        message: '개발팀(KR2, KR3) 소속 사용자만 이 기능을 사용할 수 있습니다.',
      });
    }

    // 팀 이름 확인
    const team = await this.prisma.team.findUnique({
      where: { id: user.teamId },
      select: { name: true },
    });

    if (!team || !Kr2TeamGuard.DEV_TEAM_NAMES.includes(team.name)) {
      throw new ForbiddenException({
        code: 'DEV_TEAM_REQUIRED',
        message: '개발팀(KR2, KR3) 소속 사용자만 이 기능을 사용할 수 있습니다.',
      });
    }

    return true;
  }
}

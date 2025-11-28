import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import {
  ApproveUserDto,
  RejectUserDto,
  UpdateUserRoleDto,
  UpdateUserTeamDto,
} from './dto';
import { ErrorCodes } from '../../common/constants';
import { UserStatus } from '@prisma/client';
import { PaginationDto, PaginationMeta } from '../../common/dto';
import { NotificationsService } from '../notifications/notifications.service';
import { AuditService, AuditAction, EntityType } from '../audit/audit.service';

@Injectable()
export class AdminService {
  private readonly logger = new Logger(AdminService.name);

  constructor(
    private prisma: PrismaService,
    private notificationsService: NotificationsService,
    private auditService: AuditService,
  ) {}

  async getPendingUsers(pagination: PaginationDto) {
    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where: { status: UserStatus.PENDING },
        select: {
          id: true,
          email: true,
          name: true,
          createdAt: true,
        },
        skip: pagination.skip,
        take: pagination.limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.user.count({
        where: { status: UserStatus.PENDING },
      }),
    ]);

    return {
      data: users.map((user) => ({
        ...user,
        requestedAt: user.createdAt,
      })),
      meta: new PaginationMeta(
        pagination.page || 1,
        pagination.limit || 20,
        total,
      ),
    };
  }

  async approveUser(id: string, dto: ApproveUserDto) {
    const user = await this.prisma.user.findUnique({
      where: { id },
    });

    if (!user) {
      throw new NotFoundException(ErrorCodes.USER_NOT_FOUND);
    }

    if (user.status !== UserStatus.PENDING) {
      throw new BadRequestException({
        code: 'USER_NOT_PENDING',
        message: '승인 대기 상태의 사용자만 승인할 수 있습니다.',
      });
    }

    // Verify team exists if provided
    if (dto.teamId) {
      const team = await this.prisma.team.findUnique({
        where: { id: dto.teamId },
      });

      if (!team) {
        throw new NotFoundException(ErrorCodes.TEAM_NOT_FOUND);
      }
    }

    const updatedUser = await this.prisma.user.update({
      where: { id },
      data: {
        status: UserStatus.ACTIVE,
        role: dto.role,
        teamId: dto.teamId || null,
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        status: true,
        teamId: true,
      },
    });

    // Send notification to the approved user
    await this.notificationsService.notifyUserApproved(id);

    // Audit log
    await this.auditService.log({
      action: AuditAction.USER_APPROVE,
      entityType: EntityType.USER,
      entityId: id,
      oldData: { status: UserStatus.PENDING },
      newData: { status: UserStatus.ACTIVE, role: dto.role, teamId: dto.teamId },
    });

    this.logger.log(`User approved: ${updatedUser.email}, role: ${dto.role}`);

    return updatedUser;
  }

  async rejectUser(id: string, dto: RejectUserDto) {
    const user = await this.prisma.user.findUnique({
      where: { id },
    });

    if (!user) {
      throw new NotFoundException(ErrorCodes.USER_NOT_FOUND);
    }

    if (user.status !== UserStatus.PENDING) {
      throw new BadRequestException({
        code: 'USER_NOT_PENDING',
        message: '승인 대기 상태의 사용자만 거절할 수 있습니다.',
      });
    }

    await this.prisma.user.update({
      where: { id },
      data: { status: UserStatus.INACTIVE },
    });

    // Send notification to the rejected user
    await this.notificationsService.notifyUserRejected(id, dto.reason);

    // Audit log
    await this.auditService.log({
      action: AuditAction.USER_REJECT,
      entityType: EntityType.USER,
      entityId: id,
      oldData: { status: UserStatus.PENDING },
      newData: { status: UserStatus.INACTIVE, reason: dto.reason },
    });

    this.logger.log(`User rejected: ${user.email}, reason: ${dto.reason}`);

    return {
      id,
      status: UserStatus.INACTIVE,
      message: '사용자 가입이 거절되었습니다.',
    };
  }

  async updateUserRole(id: string, dto: UpdateUserRoleDto) {
    const user = await this.prisma.user.findUnique({
      where: { id },
    });

    if (!user) {
      throw new NotFoundException(ErrorCodes.USER_NOT_FOUND);
    }

    const oldRole = user.role;

    const updatedUser = await this.prisma.user.update({
      where: { id },
      data: { role: dto.role },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
      },
    });

    // Audit log
    await this.auditService.log({
      action: AuditAction.USER_ROLE_CHANGE,
      entityType: EntityType.USER,
      entityId: id,
      oldData: { role: oldRole },
      newData: { role: dto.role },
    });

    this.logger.log(`User role updated: ${user.email}, new role: ${dto.role}`);

    return updatedUser;
  }

  async updateUserTeam(id: string, dto: UpdateUserTeamDto) {
    const user = await this.prisma.user.findUnique({
      where: { id },
    });

    if (!user) {
      throw new NotFoundException(ErrorCodes.USER_NOT_FOUND);
    }

    if (dto.teamId) {
      const team = await this.prisma.team.findUnique({
        where: { id: dto.teamId },
      });

      if (!team) {
        throw new NotFoundException(ErrorCodes.TEAM_NOT_FOUND);
      }
    }

    const oldTeamId = user.teamId;

    const updatedUser = await this.prisma.user.update({
      where: { id },
      data: { teamId: dto.teamId || null },
      select: {
        id: true,
        email: true,
        name: true,
        teamId: true,
        team: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    // Audit log
    await this.auditService.log({
      action: AuditAction.USER_TEAM_CHANGE,
      entityType: EntityType.USER,
      entityId: id,
      oldData: { teamId: oldTeamId },
      newData: { teamId: dto.teamId },
    });

    this.logger.log(`User team updated: ${user.email}, teamId: ${dto.teamId}`);

    return updatedUser;
  }

  async getAllUsers(pagination: PaginationDto) {
    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          status: true,
          teamId: true,
          createdAt: true,
          team: {
            select: {
              id: true,
              name: true,
            },
          },
        },
        skip: pagination.skip,
        take: pagination.limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.user.count(),
    ]);

    return {
      data: users,
      meta: new PaginationMeta(
        pagination.page || 1,
        pagination.limit || 20,
        total,
      ),
    };
  }

  async deactivateUser(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
    });

    if (!user) {
      throw new NotFoundException(ErrorCodes.USER_NOT_FOUND);
    }

    await this.prisma.user.update({
      where: { id },
      data: { status: UserStatus.INACTIVE },
    });

    // Revoke all refresh tokens
    await this.prisma.refreshToken.updateMany({
      where: { userId: id },
      data: { isRevoked: true },
    });

    this.logger.log(`User deactivated: ${user.email}`);

    return { message: '사용자가 비활성화되었습니다.' };
  }

  async activateUser(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
    });

    if (!user) {
      throw new NotFoundException(ErrorCodes.USER_NOT_FOUND);
    }

    await this.prisma.user.update({
      where: { id },
      data: { status: UserStatus.ACTIVE },
    });

    this.logger.log(`User activated: ${user.email}`);

    return { message: '사용자가 활성화되었습니다.' };
  }
}

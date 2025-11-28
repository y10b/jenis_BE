import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { AuditQueryDto } from './dto';
import { RequestUser } from '../../common/interfaces';
import { Prisma, UserRole } from '@prisma/client';

export enum AuditAction {
  // Auth actions
  LOGIN = 'LOGIN',
  LOGOUT = 'LOGOUT',
  SIGNUP = 'SIGNUP',
  PASSWORD_CHANGE = 'PASSWORD_CHANGE',

  // User management
  USER_APPROVE = 'USER_APPROVE',
  USER_REJECT = 'USER_REJECT',
  USER_ROLE_CHANGE = 'USER_ROLE_CHANGE',
  USER_TEAM_CHANGE = 'USER_TEAM_CHANGE',
  USER_DEACTIVATE = 'USER_DEACTIVATE',
  USER_ACTIVATE = 'USER_ACTIVATE',

  // Team actions
  TEAM_CREATE = 'TEAM_CREATE',
  TEAM_UPDATE = 'TEAM_UPDATE',
  TEAM_DELETE = 'TEAM_DELETE',
  TEAM_MEMBER_ADD = 'TEAM_MEMBER_ADD',
  TEAM_MEMBER_REMOVE = 'TEAM_MEMBER_REMOVE',

  // Task actions
  TASK_CREATE = 'TASK_CREATE',
  TASK_UPDATE = 'TASK_UPDATE',
  TASK_DELETE = 'TASK_DELETE',
  TASK_STATUS_CHANGE = 'TASK_STATUS_CHANGE',
  TASK_PRIORITY_CHANGE = 'TASK_PRIORITY_CHANGE',
  TASK_ASSIGN = 'TASK_ASSIGN',

  // Retrospective actions
  RETRO_CREATE = 'RETRO_CREATE',
  RETRO_UPDATE = 'RETRO_UPDATE',
  RETRO_DELETE = 'RETRO_DELETE',
  RETRO_PUBLISH = 'RETRO_PUBLISH',
  RETRO_SHARE = 'RETRO_SHARE',

  // Schedule actions
  SCHEDULE_CREATE = 'SCHEDULE_CREATE',
  SCHEDULE_UPDATE = 'SCHEDULE_UPDATE',
  SCHEDULE_DELETE = 'SCHEDULE_DELETE',

  // Integration actions
  INTEGRATION_CONNECT = 'INTEGRATION_CONNECT',
  INTEGRATION_DISCONNECT = 'INTEGRATION_DISCONNECT',
}

export enum EntityType {
  USER = 'USER',
  TEAM = 'TEAM',
  TASK = 'TASK',
  RETROSPECTIVE = 'RETROSPECTIVE',
  SCHEDULE = 'SCHEDULE',
  INTEGRATION = 'INTEGRATION',
}

interface AuditLogData {
  action: AuditAction | string;
  entityType: EntityType | string;
  entityId?: string;
  oldData?: Record<string, any>;
  newData?: Record<string, any>;
  userId?: string;
  ipAddress?: string;
  userAgent?: string;
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private prisma: PrismaService) {}

  async log(data: AuditLogData): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: {
          userId: data.userId,
          action: data.action,
          entityType: data.entityType,
          entityId: data.entityId,
          oldData: data.oldData ?? Prisma.JsonNull,
          newData: data.newData ?? Prisma.JsonNull,
          ipAddress: data.ipAddress,
          userAgent: data.userAgent,
        },
      });

      this.logger.debug(`Audit log: ${data.action} on ${data.entityType}${data.entityId ? `/${data.entityId}` : ''}`);
    } catch (error) {
      this.logger.error(`Failed to create audit log: ${error}`);
    }
  }

  async findAll(query: AuditQueryDto, user: RequestUser) {
    // Only OWNER and HEAD can view audit logs
    if (user.role !== UserRole.OWNER && user.role !== UserRole.HEAD) {
      return {
        data: [],
        meta: {
          total: 0,
          page: query.page || 1,
          limit: query.limit || 20,
          totalPages: 0,
        },
      };
    }

    const {
      userId,
      action,
      entityType,
      entityId,
      startDate,
      endDate,
      page = 1,
      limit = 20,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = query;

    const where: Prisma.AuditLogWhereInput = {
      ...(userId ? { userId } : {}),
      ...(action ? { action } : {}),
      ...(entityType ? { entityType } : {}),
      ...(entityId ? { entityId } : {}),
      ...(startDate || endDate
        ? {
            createdAt: {
              ...(startDate ? { gte: new Date(startDate) } : {}),
              ...(endDate ? { lte: new Date(endDate) } : {}),
            },
          }
        : {}),
    };

    const [logs, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
        orderBy: { [sortBy]: sortOrder },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return {
      data: logs,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findByEntity(entityType: string, entityId: string, user: RequestUser) {
    // Only OWNER and HEAD can view audit logs
    if (user.role !== UserRole.OWNER && user.role !== UserRole.HEAD) {
      return [];
    }

    return this.prisma.auditLog.findMany({
      where: {
        entityType,
        entityId,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  async getStats(user: RequestUser) {
    // Only OWNER can view stats
    if (user.role !== UserRole.OWNER) {
      return {};
    }

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekStart = new Date(todayStart.getTime() - 7 * 24 * 60 * 60 * 1000);

    const [todayCount, weekCount, actionCounts] = await Promise.all([
      this.prisma.auditLog.count({
        where: { createdAt: { gte: todayStart } },
      }),
      this.prisma.auditLog.count({
        where: { createdAt: { gte: weekStart } },
      }),
      this.prisma.auditLog.groupBy({
        by: ['action'],
        _count: { action: true },
        where: { createdAt: { gte: weekStart } },
        orderBy: { _count: { action: 'desc' } },
        take: 10,
      }),
    ]);

    return {
      todayCount,
      weekCount,
      topActions: actionCounts.map((item) => ({
        action: item.action,
        count: item._count.action,
      })),
    };
  }
}

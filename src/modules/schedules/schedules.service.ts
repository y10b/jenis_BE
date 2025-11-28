import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import {
  CreateScheduleDto,
  UpdateScheduleDto,
  ScheduleQueryDto,
} from './dto';
import { ErrorCodes } from '../../common/constants';
import { RequestUser } from '../../common/interfaces';
import { UserRole, Prisma } from '@prisma/client';

@Injectable()
export class SchedulesService {
  private readonly logger = new Logger(SchedulesService.name);

  constructor(private prisma: PrismaService) {}

  async create(dto: CreateScheduleDto, user: RequestUser) {
    const { teamIds, ...scheduleData } = dto;

    // Calculate nextRunAt based on scheduledAt
    let nextRunAt: Date | null = null;
    if (dto.scheduledAt) {
      nextRunAt = new Date(dto.scheduledAt);
    }

    const schedule = await this.prisma.schedule.create({
      data: {
        ...scheduleData,
        scheduledAt: dto.scheduledAt ? new Date(dto.scheduledAt) : null,
        nextRunAt,
        creatorId: user.id,
        teamSchedules: teamIds?.length
          ? {
              create: teamIds.map((teamId) => ({ teamId })),
            }
          : undefined,
      },
      include: {
        creator: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        teamSchedules: {
          include: {
            team: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
    });

    this.logger.log(`Schedule created: ${schedule.title} by ${user.email}`);

    return schedule;
  }

  async findAll(query: ScheduleQueryDto, user: RequestUser) {
    const {
      type,
      teamId,
      creatorId,
      isActive,
      search,
      page = 1,
      limit = 20,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = query;

    const where: Prisma.ScheduleWhereInput = {
      AND: [
        // Access control
        this.buildAccessFilter(user, teamId),
        // Additional filters
        ...(type ? [{ type }] : []),
        ...(creatorId ? [{ creatorId }] : []),
        ...(isActive !== undefined ? [{ isActive }] : []),
        ...(search
          ? [
              {
                OR: [
                  { title: { contains: search, mode: Prisma.QueryMode.insensitive } },
                  { description: { contains: search, mode: Prisma.QueryMode.insensitive } },
                ],
              },
            ]
          : []),
      ],
    };

    const [schedules, total] = await Promise.all([
      this.prisma.schedule.findMany({
        where,
        include: {
          creator: {
            select: {
              id: true,
              name: true,
              email: true,
              profileImageUrl: true,
            },
          },
          teamSchedules: {
            include: {
              team: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
        },
        orderBy: { [sortBy]: sortOrder },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.schedule.count({ where }),
    ]);

    return {
      data: schedules,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: string, user: RequestUser) {
    const schedule = await this.prisma.schedule.findUnique({
      where: { id },
      include: {
        creator: {
          select: {
            id: true,
            name: true,
            email: true,
            profileImageUrl: true,
          },
        },
        teamSchedules: {
          include: {
            team: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
    });

    if (!schedule) {
      throw new NotFoundException(ErrorCodes.NOT_FOUND);
    }

    if (!this.canAccessSchedule(schedule, user)) {
      throw new ForbiddenException(ErrorCodes.FORBIDDEN);
    }

    return schedule;
  }

  async update(id: string, dto: UpdateScheduleDto, user: RequestUser) {
    const schedule = await this.prisma.schedule.findUnique({
      where: { id },
      include: {
        teamSchedules: true,
      },
    });

    if (!schedule) {
      throw new NotFoundException(ErrorCodes.NOT_FOUND);
    }

    if (!this.canModifySchedule(schedule, user)) {
      throw new ForbiddenException(ErrorCodes.FORBIDDEN);
    }

    const { teamIds, ...updateData } = dto;

    // Calculate nextRunAt if scheduledAt changed
    let nextRunAt: Date | undefined;
    if (dto.scheduledAt) {
      nextRunAt = new Date(dto.scheduledAt);
    }

    const updatedSchedule = await this.prisma.$transaction(async (tx) => {
      // Update team schedules if teamIds provided
      if (teamIds !== undefined) {
        // Delete existing team schedules
        await tx.teamSchedule.deleteMany({
          where: { scheduleId: id },
        });

        // Create new team schedules
        if (teamIds.length > 0) {
          await tx.teamSchedule.createMany({
            data: teamIds.map((teamId) => ({
              scheduleId: id,
              teamId,
            })),
          });
        }
      }

      // Update schedule
      return tx.schedule.update({
        where: { id },
        data: {
          ...updateData,
          scheduledAt: dto.scheduledAt ? new Date(dto.scheduledAt) : undefined,
          nextRunAt,
        },
        include: {
          creator: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          teamSchedules: {
            include: {
              team: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
        },
      });
    });

    this.logger.log(`Schedule updated: ${updatedSchedule.title} by ${user.email}`);

    return updatedSchedule;
  }

  async remove(id: string, user: RequestUser) {
    const schedule = await this.prisma.schedule.findUnique({
      where: { id },
    });

    if (!schedule) {
      throw new NotFoundException(ErrorCodes.NOT_FOUND);
    }

    if (!this.canModifySchedule(schedule, user)) {
      throw new ForbiddenException(ErrorCodes.FORBIDDEN);
    }

    await this.prisma.schedule.delete({
      where: { id },
    });

    this.logger.log(`Schedule deleted: ${schedule.title} by ${user.email}`);

    return { message: '스케줄이 삭제되었습니다.' };
  }

  async toggleActive(id: string, user: RequestUser) {
    const schedule = await this.prisma.schedule.findUnique({
      where: { id },
    });

    if (!schedule) {
      throw new NotFoundException(ErrorCodes.NOT_FOUND);
    }

    if (!this.canModifySchedule(schedule, user)) {
      throw new ForbiddenException(ErrorCodes.FORBIDDEN);
    }

    const updatedSchedule = await this.prisma.schedule.update({
      where: { id },
      data: {
        isActive: !schedule.isActive,
      },
      include: {
        creator: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        teamSchedules: {
          include: {
            team: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
    });

    this.logger.log(
      `Schedule ${updatedSchedule.isActive ? 'activated' : 'deactivated'}: ${updatedSchedule.title} by ${user.email}`,
    );

    return updatedSchedule;
  }

  async getMySchedules(query: ScheduleQueryDto, user: RequestUser) {
    return this.findAll({ ...query, creatorId: user.id }, user);
  }

  async getTeamSchedules(teamId: string, query: ScheduleQueryDto, user: RequestUser) {
    // Verify user has access to the team
    if (user.role !== UserRole.OWNER && user.teamId !== teamId) {
      throw new ForbiddenException(ErrorCodes.FORBIDDEN);
    }

    const { page = 1, limit = 20, sortBy = 'createdAt', sortOrder = 'desc' } = query;

    const where: Prisma.ScheduleWhereInput = {
      teamSchedules: {
        some: { teamId },
      },
      ...(query.type ? { type: query.type } : {}),
      ...(query.isActive !== undefined ? { isActive: query.isActive } : {}),
    };

    const [schedules, total] = await Promise.all([
      this.prisma.schedule.findMany({
        where,
        include: {
          creator: {
            select: {
              id: true,
              name: true,
              email: true,
              profileImageUrl: true,
            },
          },
          teamSchedules: {
            include: {
              team: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
        },
        orderBy: { [sortBy]: sortOrder },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.schedule.count({ where }),
    ]);

    return {
      data: schedules,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getUpcoming(limit: number = 10, user: RequestUser) {
    const now = new Date();

    const schedules = await this.prisma.schedule.findMany({
      where: {
        AND: [
          this.buildAccessFilter(user),
          {
            isActive: true,
            nextRunAt: { gte: now },
          },
        ],
      },
      include: {
        creator: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        teamSchedules: {
          include: {
            team: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
      orderBy: { nextRunAt: 'asc' },
      take: limit,
    });

    return schedules;
  }

  // Helper methods
  private buildAccessFilter(user: RequestUser, teamId?: string): Prisma.ScheduleWhereInput {
    if (user.role === UserRole.OWNER) {
      return teamId ? { teamSchedules: { some: { teamId } } } : {};
    }

    // Users can see schedules they created or schedules for their team
    return {
      OR: [
        { creatorId: user.id },
        ...(user.teamId
          ? [{ teamSchedules: { some: { teamId: teamId || user.teamId } } }]
          : []),
      ],
    };
  }

  private canAccessSchedule(schedule: any, user: RequestUser): boolean {
    if (user.role === UserRole.OWNER) return true;
    if (schedule.creatorId === user.id) return true;

    // Check if user's team is associated with this schedule
    if (user.teamId) {
      const teamIds = schedule.teamSchedules?.map((ts: any) => ts.teamId) || [];
      if (teamIds.includes(user.teamId)) return true;
    }

    return false;
  }

  private canModifySchedule(schedule: any, user: RequestUser): boolean {
    if (user.role === UserRole.OWNER) return true;
    if (schedule.creatorId === user.id) return true;
    return false;
  }
}

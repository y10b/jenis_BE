import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { DashboardQueryDto } from './dto';
import { RequestUser } from '../../common/interfaces';
import { TaskStatus, TaskPriority, UserRole, Prisma } from '@prisma/client';

@Injectable()
export class DashboardService {
  constructor(private prisma: PrismaService) {}

  async getOverview(query: DashboardQueryDto, user: RequestUser) {
    const dateFilter = this.buildDateFilter(query.startDate, query.endDate);
    const teamFilter = this.buildTeamFilter(query.teamId, user);

    const [
      taskStats,
      priorityStats,
      recentTasks,
      upcomingDeadlines,
      teamStats,
      activityStats,
    ] = await Promise.all([
      this.getTaskStatusStats(teamFilter, dateFilter),
      this.getTaskPriorityStats(teamFilter, dateFilter),
      this.getRecentTasks(teamFilter, user),
      this.getUpcomingDeadlines(teamFilter, user),
      this.getTeamStats(user),
      this.getActivityStats(teamFilter, dateFilter),
    ]);

    return {
      taskStats,
      priorityStats,
      recentTasks,
      upcomingDeadlines,
      teamStats,
      activityStats,
    };
  }

  async getTaskStatusStats(
    teamFilter: Prisma.TaskWhereInput,
    dateFilter: Prisma.TaskWhereInput,
  ) {
    const where: Prisma.TaskWhereInput = {
      AND: [teamFilter, dateFilter],
    };

    const [total, byStatus] = await Promise.all([
      this.prisma.task.count({ where }),
      this.prisma.task.groupBy({
        by: ['status'],
        where,
        _count: { status: true },
      }),
    ]);

    const statusMap = new Map(
      byStatus.map((s) => [s.status, s._count.status]),
    );

    return {
      total,
      todo: statusMap.get(TaskStatus.TODO) || 0,
      inProgress: statusMap.get(TaskStatus.IN_PROGRESS) || 0,
      review: statusMap.get(TaskStatus.REVIEW) || 0,
      done: statusMap.get(TaskStatus.DONE) || 0,
      cancelled: statusMap.get(TaskStatus.CANCELLED) || 0,
      completionRate: total > 0
        ? Math.round(((statusMap.get(TaskStatus.DONE) || 0) / total) * 100)
        : 0,
    };
  }

  async getTaskPriorityStats(
    teamFilter: Prisma.TaskWhereInput,
    dateFilter: Prisma.TaskWhereInput,
  ) {
    const where: Prisma.TaskWhereInput = {
      AND: [
        teamFilter,
        dateFilter,
        { status: { not: TaskStatus.DONE } },
        { status: { not: TaskStatus.CANCELLED } },
      ],
    };

    const byPriority = await this.prisma.task.groupBy({
      by: ['priority'],
      where,
      _count: { priority: true },
    });

    const priorityMap = new Map(
      byPriority.map((p) => [p.priority, p._count.priority]),
    );

    return {
      p0: priorityMap.get(TaskPriority.P0) || 0,
      p1: priorityMap.get(TaskPriority.P1) || 0,
      p2: priorityMap.get(TaskPriority.P2) || 0,
      p3: priorityMap.get(TaskPriority.P3) || 0,
    };
  }

  async getRecentTasks(teamFilter: Prisma.TaskWhereInput, user: RequestUser) {
    const accessFilter = this.buildAccessFilter(user);

    const tasks = await this.prisma.task.findMany({
      where: {
        AND: [teamFilter, accessFilter],
      },
      include: {
        assignee: {
          select: {
            id: true,
            name: true,
            profileImageUrl: true,
          },
        },
        team: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: { updatedAt: 'desc' },
      take: 5,
    });

    return tasks;
  }

  async getUpcomingDeadlines(
    teamFilter: Prisma.TaskWhereInput,
    user: RequestUser,
  ) {
    const accessFilter = this.buildAccessFilter(user);
    const now = new Date();
    const nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    const tasks = await this.prisma.task.findMany({
      where: {
        AND: [
          teamFilter,
          accessFilter,
          {
            dueDate: {
              gte: now,
              lte: nextWeek,
            },
          },
          {
            status: {
              notIn: [TaskStatus.DONE, TaskStatus.CANCELLED],
            },
          },
        ],
      },
      include: {
        assignee: {
          select: {
            id: true,
            name: true,
            profileImageUrl: true,
          },
        },
      },
      orderBy: { dueDate: 'asc' },
      take: 10,
    });

    return tasks;
  }

  async getTeamStats(user: RequestUser) {
    if (user.role !== UserRole.OWNER && user.role !== UserRole.HEAD) {
      return null;
    }

    const teams = await this.prisma.team.findMany({
      where: { isActive: true },
      select: {
        id: true,
        name: true,
        _count: {
          select: {
            members: true,
            tasks: true,
          },
        },
      },
    });

    const teamTaskStats = await Promise.all(
      teams.map(async (team) => {
        const completedTasks = await this.prisma.task.count({
          where: {
            teamId: team.id,
            status: TaskStatus.DONE,
          },
        });

        return {
          id: team.id,
          name: team.name,
          memberCount: team._count.members,
          totalTasks: team._count.tasks,
          completedTasks,
          completionRate: team._count.tasks > 0
            ? Math.round((completedTasks / team._count.tasks) * 100)
            : 0,
        };
      }),
    );

    return teamTaskStats;
  }

  async getActivityStats(
    teamFilter: Prisma.TaskWhereInput,
    dateFilter: Prisma.TaskWhereInput,
  ) {
    const where: Prisma.TaskWhereInput = {
      AND: [teamFilter, dateFilter],
    };

    // Tasks created in the period
    const tasksCreated = await this.prisma.task.count({
      where: {
        ...where,
        createdAt: dateFilter.createdAt as any,
      },
    });

    // Tasks completed in the period
    const tasksCompleted = await this.prisma.task.count({
      where: {
        AND: [
          teamFilter,
          { status: TaskStatus.DONE },
          dateFilter.createdAt
            ? { completedAt: dateFilter.createdAt as any }
            : {},
        ],
      },
    });

    // Comments added in the period
    const commentsAdded = await this.prisma.taskComment.count({
      where: dateFilter.createdAt
        ? { createdAt: dateFilter.createdAt as any }
        : {},
    });

    return {
      tasksCreated,
      tasksCompleted,
      commentsAdded,
    };
  }

  async getMyDashboard(user: RequestUser) {
    const [myTasks, myRecentActivity, myUpcomingDeadlines] = await Promise.all([
      this.getMyTaskStats(user),
      this.getMyRecentActivity(user),
      this.getMyUpcomingDeadlines(user),
    ]);

    return {
      myTasks,
      myRecentActivity,
      myUpcomingDeadlines,
    };
  }

  async getMyTaskStats(user: RequestUser) {
    const byStatus = await this.prisma.task.groupBy({
      by: ['status'],
      where: { assigneeId: user.id },
      _count: { status: true },
    });

    const statusMap = new Map(
      byStatus.map((s) => [s.status, s._count.status]),
    );

    const total = byStatus.reduce((sum, s) => sum + s._count.status, 0);

    return {
      total,
      todo: statusMap.get(TaskStatus.TODO) || 0,
      inProgress: statusMap.get(TaskStatus.IN_PROGRESS) || 0,
      review: statusMap.get(TaskStatus.REVIEW) || 0,
      done: statusMap.get(TaskStatus.DONE) || 0,
    };
  }

  async getMyRecentActivity(user: RequestUser) {
    const [recentTasks, recentComments] = await Promise.all([
      this.prisma.task.findMany({
        where: {
          OR: [{ assigneeId: user.id }, { creatorId: user.id }],
        },
        include: {
          team: {
            select: { id: true, name: true },
          },
        },
        orderBy: { updatedAt: 'desc' },
        take: 5,
      }),
      this.prisma.taskComment.findMany({
        where: { userId: user.id },
        include: {
          task: {
            select: { id: true, title: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: 5,
      }),
    ]);

    return {
      recentTasks,
      recentComments,
    };
  }

  async getMyUpcomingDeadlines(user: RequestUser) {
    const now = new Date();
    const nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    return this.prisma.task.findMany({
      where: {
        assigneeId: user.id,
        dueDate: {
          gte: now,
          lte: nextWeek,
        },
        status: {
          notIn: [TaskStatus.DONE, TaskStatus.CANCELLED],
        },
      },
      orderBy: { dueDate: 'asc' },
      take: 10,
    });
  }

  // Helper methods
  private buildDateFilter(
    startDate?: string,
    endDate?: string,
  ): Prisma.TaskWhereInput {
    if (!startDate && !endDate) {
      return {};
    }

    const dateFilter: Prisma.DateTimeFilter = {};

    if (startDate) {
      dateFilter.gte = new Date(startDate);
    }

    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      dateFilter.lte = end;
    }

    return { createdAt: dateFilter };
  }

  private buildTeamFilter(
    teamId: string | undefined,
    user: RequestUser,
  ): Prisma.TaskWhereInput {
    if (teamId) {
      return { teamId };
    }

    if (user.role === UserRole.OWNER) {
      return {};
    }

    if (user.teamId) {
      return { teamId: user.teamId };
    }

    return {};
  }

  private buildAccessFilter(user: RequestUser): Prisma.TaskWhereInput {
    if (user.role === UserRole.OWNER) {
      return {};
    }

    return {
      OR: [
        { creatorId: user.id },
        { assigneeId: user.id },
        ...(user.teamId ? [{ teamId: user.teamId }] : []),
      ],
    };
  }
}

import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../database/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { ScheduleType } from '@prisma/client';

@Injectable()
export class ScheduleRunnerService implements OnModuleInit {
  private readonly logger = new Logger(ScheduleRunnerService.name);

  constructor(
    private prisma: PrismaService,
    private notificationsService: NotificationsService,
  ) {}

  onModuleInit() {
    this.logger.log('Schedule runner service initialized');
  }

  // Run every minute to check for due schedules
  @Cron(CronExpression.EVERY_MINUTE)
  async checkDueSchedules() {
    const now = new Date();
    const oneMinuteAgo = new Date(now.getTime() - 60000);

    // Find schedules that are due (nextRunAt is in the past minute)
    const dueSchedules = await this.prisma.schedule.findMany({
      where: {
        isActive: true,
        nextRunAt: {
          gte: oneMinuteAgo,
          lte: now,
        },
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
                members: {
                  select: {
                    id: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    for (const schedule of dueSchedules) {
      await this.executeSchedule(schedule);
    }
  }

  // Check for task due dates every hour
  @Cron(CronExpression.EVERY_HOUR)
  async checkTaskDueDates() {
    const now = new Date();
    const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    // Find tasks due within 24 hours that haven't been completed
    const dueSoonTasks = await this.prisma.task.findMany({
      where: {
        status: {
          notIn: ['DONE', 'CANCELLED'],
        },
        dueDate: {
          gte: now,
          lte: tomorrow,
        },
        assigneeId: {
          not: null,
        },
      },
      select: {
        id: true,
        title: true,
        dueDate: true,
        assigneeId: true,
      },
    });

    for (const task of dueSoonTasks) {
      if (task.assigneeId && task.dueDate) {
        await this.notificationsService.notifyTaskDueSoon(
          task.id,
          task.title,
          task.assigneeId,
          task.dueDate,
        );
      }
    }

    this.logger.log(`Sent ${dueSoonTasks.length} task due soon notifications`);
  }

  // Check for overdue tasks every day at 9 AM
  @Cron('0 9 * * *')
  async checkOverdueTasks() {
    const now = new Date();

    // Find overdue tasks that haven't been completed
    const overdueTasks = await this.prisma.task.findMany({
      where: {
        status: {
          notIn: ['DONE', 'CANCELLED'],
        },
        dueDate: {
          lt: now,
        },
        assigneeId: {
          not: null,
        },
      },
      select: {
        id: true,
        title: true,
        assigneeId: true,
      },
    });

    for (const task of overdueTasks) {
      if (task.assigneeId) {
        await this.notificationsService.notifyTaskOverdue(
          task.id,
          task.title,
          task.assigneeId,
        );
      }
    }

    this.logger.log(`Sent ${overdueTasks.length} task overdue notifications`);
  }

  private async executeSchedule(schedule: any) {
    this.logger.log(`Executing schedule: ${schedule.title} (${schedule.type})`);

    try {
      // Collect all user IDs to notify
      const userIds = new Set<string>();

      // Add creator
      userIds.add(schedule.creatorId);

      // Add all team members
      for (const teamSchedule of schedule.teamSchedules) {
        for (const member of teamSchedule.team.members) {
          userIds.add(member.id);
        }
      }

      // Send notifications based on schedule type
      switch (schedule.type) {
        case ScheduleType.MEETING:
          await this.sendMeetingReminder(schedule, Array.from(userIds));
          break;
        case ScheduleType.REMINDER:
          await this.sendGeneralReminder(schedule, Array.from(userIds));
          break;
        case ScheduleType.REPORT:
          await this.sendReportNotification(schedule, Array.from(userIds));
          break;
      }

      // Update lastRunAt and calculate next run
      const nextRunAt = this.calculateNextRun(schedule);

      await this.prisma.schedule.update({
        where: { id: schedule.id },
        data: {
          lastRunAt: new Date(),
          nextRunAt,
          // Deactivate if it was a one-time schedule
          isActive: nextRunAt ? true : false,
        },
      });

      this.logger.log(`Schedule executed successfully: ${schedule.title}`);
    } catch (error) {
      this.logger.error(`Failed to execute schedule ${schedule.id}: ${error}`);
    }
  }

  private async sendMeetingReminder(schedule: any, userIds: string[]) {
    const scheduledAt = schedule.scheduledAt || schedule.nextRunAt;
    const scheduledAtStr = scheduledAt
      ? new Date(scheduledAt).toLocaleString('ko-KR')
      : '예정됨';

    const notifications = userIds.map((userId) => ({
      userId,
      type: 'SCHEDULE_REMINDER',
      title: '회의 알림',
      content: `"${schedule.title}" 회의가 ${scheduledAtStr}에 예정되어 있습니다.`,
      payload: {
        scheduleId: schedule.id,
        scheduleType: schedule.type,
        scheduledAt: scheduledAt?.toISOString(),
      },
    }));

    await this.notificationsService.createMany(notifications);
  }

  private async sendGeneralReminder(schedule: any, userIds: string[]) {
    const notifications = userIds.map((userId) => ({
      userId,
      type: 'SCHEDULE_REMINDER',
      title: '리마인더',
      content: schedule.description || `"${schedule.title}" 리마인더입니다.`,
      payload: {
        scheduleId: schedule.id,
        scheduleType: schedule.type,
      },
    }));

    await this.notificationsService.createMany(notifications);
  }

  private async sendReportNotification(schedule: any, userIds: string[]) {
    const notifications = userIds.map((userId) => ({
      userId,
      type: 'SCHEDULE_REMINDER',
      title: '리포트 알림',
      content: `"${schedule.title}" 리포트 제출 시간입니다.`,
      payload: {
        scheduleId: schedule.id,
        scheduleType: schedule.type,
      },
    }));

    await this.notificationsService.createMany(notifications);
  }

  private calculateNextRun(schedule: any): Date | null {
    // If it's a one-time schedule (scheduledAt is set but no cron), return null
    if (schedule.scheduledAt && !schedule.cronExpression) {
      return null;
    }

    // If cronExpression is set, calculate next run based on cron
    if (schedule.cronExpression) {
      return this.getNextCronRun(schedule.cronExpression);
    }

    return null;
  }

  private getNextCronRun(cronExpression: string): Date {
    // Simple cron parser for common patterns
    // Format: minute hour dayOfMonth month dayOfWeek
    const parts = cronExpression.split(' ');
    if (parts.length !== 5) {
      // Invalid cron, return next hour
      return new Date(Date.now() + 60 * 60 * 1000);
    }

    const now = new Date();
    const next = new Date(now);

    // Parse minute
    if (parts[0] !== '*') {
      next.setMinutes(parseInt(parts[0], 10));
    }

    // Parse hour
    if (parts[1] !== '*') {
      next.setHours(parseInt(parts[1], 10));
    }

    // If the calculated time is in the past, move to next day/week/month
    if (next <= now) {
      // Check day of week
      if (parts[4] !== '*') {
        const targetDay = parseInt(parts[4], 10);
        let daysToAdd = targetDay - now.getDay();
        if (daysToAdd <= 0) daysToAdd += 7;
        next.setDate(next.getDate() + daysToAdd);
      } else if (parts[2] !== '*') {
        // Specific day of month
        next.setMonth(next.getMonth() + 1);
      } else {
        // Move to next day
        next.setDate(next.getDate() + 1);
      }
    }

    next.setSeconds(0);
    next.setMilliseconds(0);

    return next;
  }
}

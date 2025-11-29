import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { CreateAttendanceDto } from './dto';
import { RequestUser } from '../../common/interfaces';
import { AttendanceType, UserRole } from '@prisma/client';

@Injectable()
export class AttendanceService {
  private readonly logger = new Logger(AttendanceService.name);

  constructor(
    private prisma: PrismaService,
    private notificationsService: NotificationsService,
  ) {}

  /**
   * 출퇴근 기록 생성
   */
  async create(dto: CreateAttendanceDto, user: RequestUser) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // 오늘 이미 같은 타입의 기록이 있는지 확인
    const existingRecord = await this.prisma.attendance.findFirst({
      where: {
        userId: user.id,
        type: dto.type,
        createdAt: {
          gte: today,
        },
      },
    });

    if (existingRecord) {
      const typeLabel = dto.type === AttendanceType.CHECK_IN ? '출근' : '퇴근';
      throw new BadRequestException(`오늘 이미 ${typeLabel} 기록이 있습니다.`);
    }

    // 출퇴근 기록 생성
    const attendance = await this.prisma.attendance.create({
      data: {
        userId: user.id,
        type: dto.type,
        note: dto.note,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            teamId: true,
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

    // 알림 전송 (팀 리드와 대표에게)
    await this.sendAttendanceNotification(attendance);

    this.logger.log(
      `User ${user.email} recorded ${dto.type} at ${attendance.createdAt}`,
    );

    return attendance;
  }

  /**
   * 팀 리드와 대표에게 알림 전송
   */
  private async sendAttendanceNotification(attendance: any) {
    const user = attendance.user;
    const typeLabel =
      attendance.type === AttendanceType.CHECK_IN ? '출근' : '퇴근';

    // 알림 받을 대상: OWNER와 해당 팀의 LEAD/HEAD
    const notifyTargets = await this.prisma.user.findMany({
      where: {
        OR: [
          // 대표 (OWNER)
          { role: UserRole.OWNER },
          // 같은 팀의 LEAD 또는 HEAD
          ...(user.teamId
            ? [
                {
                  teamId: user.teamId,
                  role: { in: [UserRole.LEAD, UserRole.HEAD] },
                },
              ]
            : []),
        ],
        // 본인 제외
        NOT: { id: user.id },
      },
      select: { id: true },
    });

    // 각 대상에게 알림 전송
    for (const target of notifyTargets) {
      await this.notificationsService.create({
        userId: target.id,
        type: 'ATTENDANCE',
        title: `${user.name}님이 ${typeLabel}했습니다`,
        content: user.team
          ? `[${user.team.name}] ${user.name}님이 ${typeLabel}했습니다.${attendance.note ? ` (${attendance.note})` : ''}`
          : `${user.name}님이 ${typeLabel}했습니다.${attendance.note ? ` (${attendance.note})` : ''}`,
        payload: {
          attendanceId: attendance.id,
          userId: user.id,
          userName: user.name,
          type: attendance.type,
          teamName: user.team?.name,
        },
      });
    }
  }

  /**
   * 오늘의 출퇴근 상태 조회
   */
  async getTodayStatus(user: RequestUser) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const records = await this.prisma.attendance.findMany({
      where: {
        userId: user.id,
        createdAt: {
          gte: today,
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    const checkIn = records.find((r) => r.type === AttendanceType.CHECK_IN);
    const checkOut = records.find((r) => r.type === AttendanceType.CHECK_OUT);

    return {
      checkIn: checkIn || null,
      checkOut: checkOut || null,
      isCheckedIn: !!checkIn,
      isCheckedOut: !!checkOut,
    };
  }

  /**
   * 출퇴근 기록 목록 조회 (관리자용)
   */
  async findAll(query: { date?: string; teamId?: string; page?: number; limit?: number }) {
    const { date, teamId, page = 1, limit = 50 } = query;

    const targetDate = date ? new Date(date) : new Date();
    targetDate.setHours(0, 0, 0, 0);
    const nextDate = new Date(targetDate);
    nextDate.setDate(nextDate.getDate() + 1);

    const where: any = {
      createdAt: {
        gte: targetDate,
        lt: nextDate,
      },
    };

    if (teamId) {
      where.user = { teamId };
    }

    const [records, total] = await Promise.all([
      this.prisma.attendance.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              profileImageUrl: true,
              team: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.attendance.count({ where }),
    ]);

    return {
      data: records,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }
}

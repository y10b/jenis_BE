import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { CreateTeamDto, UpdateTeamDto, AddMemberDto, CreateTeamShareDto, UpdateTeamShareDto } from './dto';
import { ErrorCodes } from '../../common/constants';
import { RequestUser } from '../../common/interfaces';
import { UserRole, UserStatus } from '@prisma/client';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class TeamsService {
  private readonly logger = new Logger(TeamsService.name);

  constructor(
    private prisma: PrismaService,
    private notificationsService: NotificationsService,
  ) {}

  async create(dto: CreateTeamDto, user: RequestUser) {
    // Only OWNER can create teams
    if (user.role !== UserRole.OWNER) {
      throw new ForbiddenException(ErrorCodes.FORBIDDEN);
    }

    const team = await this.prisma.team.create({
      data: {
        name: dto.name,
        description: dto.description,
        ownerId: user.id,
      },
      include: {
        owner: {
          select: {
            id: true,
            email: true,
            name: true,
          },
        },
        _count: {
          select: { members: true },
        },
      },
    });

    this.logger.log(`Team created: ${team.name} by ${user.email}`);

    return team;
  }

  async findAll(user: RequestUser) {
    const teams = await this.prisma.team.findMany({
      include: {
        owner: {
          select: {
            id: true,
            email: true,
            name: true,
          },
        },
        _count: {
          select: { members: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return teams;
  }

  async findOne(id: string, user: RequestUser) {
    const team = await this.prisma.team.findUnique({
      where: { id },
      include: {
        owner: {
          select: {
            id: true,
            email: true,
            name: true,
            role: true,
          },
        },
        members: {
          select: {
            id: true,
            email: true,
            name: true,
            role: true,
            status: true,
            profileImageUrl: true,
          },
          orderBy: { name: 'asc' },
        },
        _count: {
          select: { members: true },
        },
      },
    });

    if (!team) {
      throw new NotFoundException(ErrorCodes.NOT_FOUND);
    }

    return team;
  }

  async update(id: string, dto: UpdateTeamDto, user: RequestUser) {
    const team = await this.prisma.team.findUnique({
      where: { id },
    });

    if (!team) {
      throw new NotFoundException(ErrorCodes.NOT_FOUND);
    }

    // Only OWNER can update teams
    if (user.role !== UserRole.OWNER) {
      throw new ForbiddenException(ErrorCodes.FORBIDDEN);
    }

    // If changing owner, verify new owner exists
    if (dto.ownerId) {
      const newOwner = await this.prisma.user.findUnique({
        where: { id: dto.ownerId },
      });

      if (!newOwner) {
        throw new NotFoundException(ErrorCodes.USER_NOT_FOUND);
      }
    }

    const updatedTeam = await this.prisma.team.update({
      where: { id },
      data: {
        name: dto.name,
        description: dto.description,
        ownerId: dto.ownerId,
      },
      include: {
        owner: {
          select: {
            id: true,
            email: true,
            name: true,
          },
        },
        _count: {
          select: { members: true },
        },
      },
    });

    this.logger.log(`Team updated: ${updatedTeam.name} by ${user.email}`);

    return updatedTeam;
  }

  async remove(id: string, user: RequestUser) {
    const team = await this.prisma.team.findUnique({
      where: { id },
      include: {
        _count: {
          select: { members: true },
        },
      },
    });

    if (!team) {
      throw new NotFoundException(ErrorCodes.NOT_FOUND);
    }

    // Only OWNER can delete teams
    if (user.role !== UserRole.OWNER) {
      throw new ForbiddenException(ErrorCodes.FORBIDDEN);
    }

    // Cannot delete team with members
    if (team._count.members > 0) {
      throw new ConflictException(ErrorCodes.TEAM_HAS_MEMBERS);
    }

    await this.prisma.team.delete({
      where: { id },
    });

    this.logger.log(`Team deleted: ${team.name} by ${user.email}`);

    return { message: '팀이 삭제되었습니다.' };
  }

  async addMember(teamId: string, dto: AddMemberDto, user: RequestUser) {
    const team = await this.prisma.team.findUnique({
      where: { id: teamId },
    });

    if (!team) {
      throw new NotFoundException(ErrorCodes.NOT_FOUND);
    }

    // Only OWNER or HEAD can add members
    if (user.role !== UserRole.OWNER && user.role !== UserRole.HEAD) {
      throw new ForbiddenException(ErrorCodes.FORBIDDEN);
    }

    const targetUser = await this.prisma.user.findUnique({
      where: { id: dto.userId },
    });

    if (!targetUser) {
      throw new NotFoundException(ErrorCodes.USER_NOT_FOUND);
    }

    if (targetUser.teamId === teamId) {
      throw new ConflictException(ErrorCodes.USER_ALREADY_IN_TEAM);
    }

    const updatedUser = await this.prisma.user.update({
      where: { id: dto.userId },
      data: { teamId },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        status: true,
      },
    });

    // Send notification to the added user
    await this.notificationsService.notifyTeamInvite(dto.userId, team.name, user.name);

    this.logger.log(`User ${updatedUser.email} added to team ${team.name} by ${user.email}`);

    return updatedUser;
  }

  async removeMember(teamId: string, userId: string, user: RequestUser) {
    const team = await this.prisma.team.findUnique({
      where: { id: teamId },
    });

    if (!team) {
      throw new NotFoundException(ErrorCodes.NOT_FOUND);
    }

    // Only OWNER or HEAD can remove members
    if (user.role !== UserRole.OWNER && user.role !== UserRole.HEAD) {
      throw new ForbiddenException(ErrorCodes.FORBIDDEN);
    }

    const targetUser = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!targetUser) {
      throw new NotFoundException(ErrorCodes.USER_NOT_FOUND);
    }

    if (targetUser.teamId !== teamId) {
      throw new ConflictException(ErrorCodes.USER_NOT_IN_TEAM);
    }

    // Cannot remove team owner
    if (team.ownerId === userId) {
      throw new ForbiddenException(ErrorCodes.CANNOT_REMOVE_TEAM_OWNER);
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: { teamId: null },
    });

    // Send notification to the removed user
    await this.notificationsService.notifyTeamRemoved(userId, team.name);

    this.logger.log(`User ${targetUser.email} removed from team ${team.name} by ${user.email}`);

    return { message: '멤버가 팀에서 제외되었습니다.' };
  }

  async getMyTeam(user: RequestUser) {
    if (!user.teamId) {
      return null;
    }

    return this.findOne(user.teamId, user);
  }

  async getTeamMembers(teamId: string, user: RequestUser) {
    const team = await this.prisma.team.findUnique({
      where: { id: teamId },
    });

    if (!team) {
      throw new NotFoundException(ErrorCodes.NOT_FOUND);
    }

    const members = await this.prisma.user.findMany({
      where: { teamId },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        status: true,
        profileImageUrl: true,
        createdAt: true,
      },
      orderBy: [
        { role: 'asc' },
        { name: 'asc' },
      ],
    });

    return members;
  }

  // Team Share methods
  async createShare(teamId: string, dto: CreateTeamShareDto, user: RequestUser) {
    const team = await this.prisma.team.findUnique({
      where: { id: teamId },
    });

    if (!team) {
      throw new NotFoundException(ErrorCodes.TEAM_NOT_FOUND);
    }

    // Only OWNER or HEAD can create shares
    if (user.role !== UserRole.OWNER && user.role !== UserRole.HEAD) {
      throw new ForbiddenException(ErrorCodes.FORBIDDEN);
    }

    const targetTeam = await this.prisma.team.findUnique({
      where: { id: dto.toTeamId },
    });

    if (!targetTeam) {
      throw new NotFoundException(ErrorCodes.TEAM_NOT_FOUND);
    }

    // Check if share already exists
    const existingShare = await this.prisma.teamShare.findFirst({
      where: {
        fromTeamId: teamId,
        toTeamId: dto.toTeamId,
      },
    });

    if (existingShare) {
      throw new ConflictException({
        code: 'SHARE_ALREADY_EXISTS',
        message: '해당 팀과의 공유 설정이 이미 존재합니다.',
      });
    }

    const share = await this.prisma.teamShare.create({
      data: {
        fromTeamId: teamId,
        toTeamId: dto.toTeamId,
        shareTasks: dto.shareTasks ?? false,
        shareSchedules: dto.shareSchedules ?? false,
      },
      include: {
        fromTeam: {
          select: { id: true, name: true },
        },
        toTeam: {
          select: { id: true, name: true },
        },
      },
    });

    this.logger.log(`Team share created: ${team.name} -> ${targetTeam.name}`);

    return share;
  }

  async getShares(teamId: string, user: RequestUser) {
    const team = await this.prisma.team.findUnique({
      where: { id: teamId },
    });

    if (!team) {
      throw new NotFoundException(ErrorCodes.TEAM_NOT_FOUND);
    }

    // Get shares where this team is sharing to others
    const sharesFrom = await this.prisma.teamShare.findMany({
      where: { fromTeamId: teamId },
      include: {
        toTeam: {
          select: { id: true, name: true },
        },
      },
    });

    // Get shares where others are sharing to this team
    const sharesTo = await this.prisma.teamShare.findMany({
      where: { toTeamId: teamId },
      include: {
        fromTeam: {
          select: { id: true, name: true },
        },
      },
    });

    return {
      sharingTo: sharesFrom,
      receivingFrom: sharesTo,
    };
  }

  async updateShare(shareId: string, dto: UpdateTeamShareDto, user: RequestUser) {
    const share = await this.prisma.teamShare.findUnique({
      where: { id: shareId },
      include: {
        fromTeam: true,
      },
    });

    if (!share) {
      throw new NotFoundException(ErrorCodes.NOT_FOUND);
    }

    // Only OWNER or HEAD can update shares
    if (user.role !== UserRole.OWNER && user.role !== UserRole.HEAD) {
      throw new ForbiddenException(ErrorCodes.FORBIDDEN);
    }

    const updatedShare = await this.prisma.teamShare.update({
      where: { id: shareId },
      data: {
        shareTasks: dto.shareTasks,
        shareSchedules: dto.shareSchedules,
      },
      include: {
        fromTeam: {
          select: { id: true, name: true },
        },
        toTeam: {
          select: { id: true, name: true },
        },
      },
    });

    return updatedShare;
  }

  async removeShare(shareId: string, user: RequestUser) {
    const share = await this.prisma.teamShare.findUnique({
      where: { id: shareId },
    });

    if (!share) {
      throw new NotFoundException(ErrorCodes.NOT_FOUND);
    }

    // Only OWNER or HEAD can remove shares
    if (user.role !== UserRole.OWNER && user.role !== UserRole.HEAD) {
      throw new ForbiddenException(ErrorCodes.FORBIDDEN);
    }

    await this.prisma.teamShare.delete({
      where: { id: shareId },
    });

    return { message: '공유 설정이 삭제되었습니다.' };
  }

  async getSharedTasks(teamId: string, user: RequestUser) {
    // Find teams that are sharing tasks with this team
    const shares = await this.prisma.teamShare.findMany({
      where: {
        toTeamId: teamId,
        shareTasks: true,
      },
    });

    const sharedFromTeamIds = shares.map((s) => s.fromTeamId);

    if (sharedFromTeamIds.length === 0) {
      return [];
    }

    // Get tasks from those teams
    const tasks = await this.prisma.task.findMany({
      where: {
        teamId: { in: sharedFromTeamIds },
      },
      include: {
        team: {
          select: { id: true, name: true },
        },
        assignee: {
          select: { id: true, name: true, email: true },
        },
        creator: {
          select: { id: true, name: true, email: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    return tasks;
  }

  async getSharedSchedules(teamId: string, user: RequestUser) {
    // Find teams that are sharing schedules with this team
    const shares = await this.prisma.teamShare.findMany({
      where: {
        toTeamId: teamId,
        shareSchedules: true,
      },
    });

    const sharedFromTeamIds = shares.map((s) => s.fromTeamId);

    if (sharedFromTeamIds.length === 0) {
      return [];
    }

    // Get schedules from those teams
    const schedules = await this.prisma.schedule.findMany({
      where: {
        teamSchedules: {
          some: {
            teamId: { in: sharedFromTeamIds },
          },
        },
      },
      include: {
        creator: {
          select: { id: true, name: true, email: true },
        },
        teamSchedules: {
          include: {
            team: {
              select: { id: true, name: true },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    return schedules;
  }
}

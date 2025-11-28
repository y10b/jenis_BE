import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import {
  CreateRetrospectiveDto,
  UpdateRetrospectiveDto,
  RetrospectiveQueryDto,
  ShareRetrospectiveDto,
} from './dto';
import { ErrorCodes } from '../../common/constants';
import { RequestUser } from '../../common/interfaces';
import { Visibility, UserRole, Prisma } from '@prisma/client';

@Injectable()
export class RetrospectivesService {
  private readonly logger = new Logger(RetrospectivesService.name);

  constructor(private prisma: PrismaService) {}

  async create(dto: CreateRetrospectiveDto, user: RequestUser) {
    const retrospective = await this.prisma.retrospective.create({
      data: {
        userId: user.id,
        type: dto.type,
        title: dto.title,
        content: dto.content,
        periodStart: new Date(dto.periodStart),
        periodEnd: new Date(dto.periodEnd),
        isDraft: dto.isDraft ?? true,
        visibility: dto.visibility || Visibility.PRIVATE,
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
    });

    this.logger.log(`Retrospective created: ${retrospective.id} by ${user.email}`);

    return retrospective;
  }

  async findAll(query: RetrospectiveQueryDto, user: RequestUser) {
    const {
      type,
      visibility,
      isDraft,
      periodStartFrom,
      periodStartTo,
      page = 1,
      limit = 20,
    } = query;

    // Build where clause based on visibility and access
    const where: Prisma.RetrospectiveWhereInput = {
      AND: [
        // Access control
        {
          OR: [
            // Own retrospectives
            { userId: user.id },
            // ALL visibility
            { visibility: Visibility.ALL },
            // TEAM visibility if in same team
            ...(user.teamId
              ? [
                  {
                    AND: [
                      { visibility: Visibility.TEAM },
                      { user: { teamId: user.teamId } },
                    ],
                  },
                ]
              : []),
            // Shared with user directly
            { shares: { some: { sharedWithUserId: user.id } } },
            // Shared with user's team
            ...(user.teamId
              ? [{ shares: { some: { sharedWithTeamId: user.teamId } } }]
              : []),
            // OWNER can see all
            ...(user.role === UserRole.OWNER ? [{}] : []),
          ],
        },
        // Additional filters
        ...(type ? [{ type }] : []),
        ...(visibility ? [{ visibility }] : []),
        ...(isDraft !== undefined ? [{ isDraft }] : []),
        ...(periodStartFrom
          ? [{ periodStart: { gte: new Date(periodStartFrom) } }]
          : []),
        ...(periodStartTo
          ? [{ periodStart: { lte: new Date(periodStartTo) } }]
          : []),
      ],
    };

    const [retrospectives, total] = await Promise.all([
      this.prisma.retrospective.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              profileImageUrl: true,
            },
          },
          _count: {
            select: { shares: true },
          },
        },
        orderBy: { periodStart: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.retrospective.count({ where }),
    ]);

    return {
      data: retrospectives,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findMy(query: RetrospectiveQueryDto, user: RequestUser) {
    const { type, isDraft, periodStartFrom, periodStartTo, page = 1, limit = 20 } = query;

    const where: Prisma.RetrospectiveWhereInput = {
      userId: user.id,
      ...(type ? { type } : {}),
      ...(isDraft !== undefined ? { isDraft } : {}),
      ...(periodStartFrom
        ? { periodStart: { gte: new Date(periodStartFrom) } }
        : {}),
      ...(periodStartTo
        ? { periodStart: { lte: new Date(periodStartTo) } }
        : {}),
    };

    const [retrospectives, total] = await Promise.all([
      this.prisma.retrospective.findMany({
        where,
        include: {
          _count: {
            select: { shares: true },
          },
        },
        orderBy: { periodStart: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.retrospective.count({ where }),
    ]);

    return {
      data: retrospectives,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: string, user: RequestUser) {
    const retrospective = await this.prisma.retrospective.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            profileImageUrl: true,
            teamId: true,
          },
        },
        shares: {
          include: {
            sharedWithUser: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
            sharedWithTeam: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
    });

    if (!retrospective) {
      throw new NotFoundException(ErrorCodes.NOT_FOUND);
    }

    // Check access
    if (!this.canAccess(retrospective, user)) {
      throw new ForbiddenException(ErrorCodes.FORBIDDEN);
    }

    return retrospective;
  }

  async update(id: string, dto: UpdateRetrospectiveDto, user: RequestUser) {
    const retrospective = await this.prisma.retrospective.findUnique({
      where: { id },
    });

    if (!retrospective) {
      throw new NotFoundException(ErrorCodes.NOT_FOUND);
    }

    // Only owner can update
    if (retrospective.userId !== user.id) {
      throw new ForbiddenException(ErrorCodes.FORBIDDEN);
    }

    const updated = await this.prisma.retrospective.update({
      where: { id },
      data: {
        type: dto.type,
        title: dto.title,
        content: dto.content,
        periodStart: dto.periodStart ? new Date(dto.periodStart) : undefined,
        periodEnd: dto.periodEnd ? new Date(dto.periodEnd) : undefined,
        isDraft: dto.isDraft,
        visibility: dto.visibility,
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
    });

    this.logger.log(`Retrospective updated: ${id} by ${user.email}`);

    return updated;
  }

  async remove(id: string, user: RequestUser) {
    const retrospective = await this.prisma.retrospective.findUnique({
      where: { id },
    });

    if (!retrospective) {
      throw new NotFoundException(ErrorCodes.NOT_FOUND);
    }

    // Only owner or OWNER role can delete
    if (retrospective.userId !== user.id && user.role !== UserRole.OWNER) {
      throw new ForbiddenException(ErrorCodes.FORBIDDEN);
    }

    await this.prisma.retrospective.delete({ where: { id } });

    this.logger.log(`Retrospective deleted: ${id} by ${user.email}`);

    return { message: '회고가 삭제되었습니다.' };
  }

  async publish(id: string, user: RequestUser) {
    const retrospective = await this.prisma.retrospective.findUnique({
      where: { id },
    });

    if (!retrospective) {
      throw new NotFoundException(ErrorCodes.NOT_FOUND);
    }

    if (retrospective.userId !== user.id) {
      throw new ForbiddenException(ErrorCodes.FORBIDDEN);
    }

    const updated = await this.prisma.retrospective.update({
      where: { id },
      data: { isDraft: false },
    });

    this.logger.log(`Retrospective published: ${id} by ${user.email}`);

    return updated;
  }

  async share(id: string, dto: ShareRetrospectiveDto, user: RequestUser) {
    const retrospective = await this.prisma.retrospective.findUnique({
      where: { id },
    });

    if (!retrospective) {
      throw new NotFoundException(ErrorCodes.NOT_FOUND);
    }

    if (retrospective.userId !== user.id) {
      throw new ForbiddenException(ErrorCodes.FORBIDDEN);
    }

    const shares: Prisma.RetrospectiveShareCreateManyInput[] = [];

    // Add user shares
    if (dto.userIds?.length) {
      for (const userId of dto.userIds) {
        shares.push({
          retrospectiveId: id,
          sharedWithUserId: userId,
        });
      }
    }

    // Add team shares
    if (dto.teamIds?.length) {
      for (const teamId of dto.teamIds) {
        shares.push({
          retrospectiveId: id,
          sharedWithTeamId: teamId,
        });
      }
    }

    // Delete existing shares and create new ones
    await this.prisma.$transaction([
      this.prisma.retrospectiveShare.deleteMany({
        where: { retrospectiveId: id },
      }),
      this.prisma.retrospectiveShare.createMany({
        data: shares,
        skipDuplicates: true,
      }),
    ]);

    this.logger.log(`Retrospective shared: ${id} by ${user.email}`);

    return this.findOne(id, user);
  }

  async addShare(id: string, dto: ShareRetrospectiveDto, user: RequestUser) {
    const retrospective = await this.prisma.retrospective.findUnique({
      where: { id },
    });

    if (!retrospective) {
      throw new NotFoundException(ErrorCodes.NOT_FOUND);
    }

    if (retrospective.userId !== user.id) {
      throw new ForbiddenException(ErrorCodes.FORBIDDEN);
    }

    const shares: Prisma.RetrospectiveShareCreateManyInput[] = [];

    if (dto.userIds?.length) {
      for (const userId of dto.userIds) {
        shares.push({
          retrospectiveId: id,
          sharedWithUserId: userId,
        });
      }
    }

    if (dto.teamIds?.length) {
      for (const teamId of dto.teamIds) {
        shares.push({
          retrospectiveId: id,
          sharedWithTeamId: teamId,
        });
      }
    }

    await this.prisma.retrospectiveShare.createMany({
      data: shares,
      skipDuplicates: true,
    });

    return this.findOne(id, user);
  }

  async removeShare(id: string, shareId: string, user: RequestUser) {
    const retrospective = await this.prisma.retrospective.findUnique({
      where: { id },
    });

    if (!retrospective) {
      throw new NotFoundException(ErrorCodes.NOT_FOUND);
    }

    if (retrospective.userId !== user.id) {
      throw new ForbiddenException(ErrorCodes.FORBIDDEN);
    }

    await this.prisma.retrospectiveShare.delete({
      where: { id: shareId },
    });

    return { message: '공유가 해제되었습니다.' };
  }

  async getSharedWithMe(query: RetrospectiveQueryDto, user: RequestUser) {
    const { type, periodStartFrom, periodStartTo, page = 1, limit = 20 } = query;

    const where: Prisma.RetrospectiveWhereInput = {
      AND: [
        {
          OR: [
            { shares: { some: { sharedWithUserId: user.id } } },
            ...(user.teamId
              ? [{ shares: { some: { sharedWithTeamId: user.teamId } } }]
              : []),
          ],
        },
        { userId: { not: user.id } }, // Exclude own retrospectives
        { isDraft: false }, // Only published
        ...(type ? [{ type }] : []),
        ...(periodStartFrom
          ? [{ periodStart: { gte: new Date(periodStartFrom) } }]
          : []),
        ...(periodStartTo
          ? [{ periodStart: { lte: new Date(periodStartTo) } }]
          : []),
      ],
    };

    const [retrospectives, total] = await Promise.all([
      this.prisma.retrospective.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              profileImageUrl: true,
            },
          },
        },
        orderBy: { periodStart: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.retrospective.count({ where }),
    ]);

    return {
      data: retrospectives,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  private canAccess(retrospective: any, user: RequestUser): boolean {
    // Owner can access
    if (retrospective.userId === user.id) return true;

    // OWNER role can access all
    if (user.role === UserRole.OWNER) return true;

    // ALL visibility
    if (retrospective.visibility === Visibility.ALL && !retrospective.isDraft) {
      return true;
    }

    // TEAM visibility and same team
    if (
      retrospective.visibility === Visibility.TEAM &&
      !retrospective.isDraft &&
      retrospective.user.teamId === user.teamId
    ) {
      return true;
    }

    // Shared with user directly
    if (retrospective.shares?.some((s: any) => s.sharedWithUserId === user.id)) {
      return true;
    }

    // Shared with user's team
    if (
      user.teamId &&
      retrospective.shares?.some((s: any) => s.sharedWithTeamId === user.teamId)
    ) {
      return true;
    }

    return false;
  }
}

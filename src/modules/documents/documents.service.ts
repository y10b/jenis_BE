import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { CreateDocumentDto, UpdateDocumentDto, DocumentQueryDto } from './dto';
import { RequestUser } from '../../common/interfaces/request-user.interface';
import { canAccessAllTeams } from '../../common/constants/roles';

@Injectable()
export class DocumentsService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateDocumentDto, user: RequestUser) {
    // OWNER와 TEAM_LEAD는 모든 팀에 문서 생성 가능
    // 그 외에는 자신의 팀에만 생성 가능
    if (!canAccessAllTeams(user.role) && user.teamId !== dto.teamId) {
      throw new ForbiddenException('자신의 팀에만 문서를 생성할 수 있습니다.');
    }

    // 팀 존재 확인
    const team = await this.prisma.team.findUnique({
      where: { id: dto.teamId },
    });

    if (!team) {
      throw new NotFoundException('팀을 찾을 수 없습니다.');
    }

    return this.prisma.teamDocument.create({
      data: {
        teamId: dto.teamId,
        creatorId: user.id,
        title: dto.title,
        content: dto.content,
        tags: dto.tags || [],
      },
      include: {
        creator: {
          select: { id: true, name: true, email: true, profileImageUrl: true },
        },
        team: {
          select: { id: true, name: true },
        },
        favorites: {
          where: { userId: user.id },
          select: { id: true },
        },
      },
    });
  }

  async findAll(query: DocumentQueryDto, user: RequestUser) {
    const { page = 1, limit = 10, teamId, search, tag, favoritesOnly } = query;
    const skip = (page - 1) * limit;

    // 접근 가능한 팀 필터링
    let teamFilter: string | undefined;

    if (canAccessAllTeams(user.role)) {
      // OWNER와 TEAM_LEAD는 모든 팀 또는 특정 팀 조회 가능
      teamFilter = teamId;
    } else {
      // 그 외에는 자신의 팀만 조회 가능
      if (!user.teamId) {
        return { data: [], meta: { total: 0, page, limit, totalPages: 0 }, allTags: [] };
      }
      teamFilter = user.teamId;
    }

    // where 조건 구성
    const where: Prisma.TeamDocumentWhereInput = {};

    if (teamFilter) {
      where.teamId = teamFilter;
    }

    // 검색 조건 (제목 또는 내용)
    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { content: { contains: search, mode: 'insensitive' } },
      ];
    }

    // 태그 필터
    if (tag) {
      where.tags = { has: tag };
    }

    // 즐겨찾기만 보기
    if (favoritesOnly) {
      where.favorites = {
        some: { userId: user.id },
      };
    }

    const [data, total] = await Promise.all([
      this.prisma.teamDocument.findMany({
        where,
        skip,
        take: limit,
        orderBy: { updatedAt: 'desc' },
        include: {
          creator: {
            select: { id: true, name: true, email: true, profileImageUrl: true },
          },
          team: {
            select: { id: true, name: true },
          },
          favorites: {
            where: { userId: user.id },
            select: { id: true },
          },
        },
      }),
      this.prisma.teamDocument.count({ where }),
    ]);

    // 모든 태그 목록 조회 (팀 필터 적용)
    const allTagsResult = await this.prisma.teamDocument.findMany({
      where: teamFilter ? { teamId: teamFilter } : (canAccessAllTeams(user.role) ? {} : { teamId: user.teamId || '' }),
      select: { tags: true },
    });

    const allTags = [...new Set(allTagsResult.flatMap((doc) => doc.tags))].sort();

    // 즐겨찾기 여부 추가
    const dataWithFavorite = data.map((doc) => ({
      ...doc,
      isFavorite: doc.favorites.length > 0,
      favorites: undefined,
    }));

    return {
      data: dataWithFavorite,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
      allTags,
    };
  }

  async findOne(id: string, user: RequestUser) {
    const document = await this.prisma.teamDocument.findUnique({
      where: { id },
      include: {
        creator: {
          select: { id: true, name: true, email: true, profileImageUrl: true },
        },
        team: {
          select: { id: true, name: true },
        },
        favorites: {
          where: { userId: user.id },
          select: { id: true },
        },
      },
    });

    if (!document) {
      throw new NotFoundException('문서를 찾을 수 없습니다.');
    }

    // 접근 권한 확인
    if (!canAccessAllTeams(user.role) && document.teamId !== user.teamId) {
      throw new ForbiddenException('이 문서에 접근할 권한이 없습니다.');
    }

    return {
      ...document,
      isFavorite: document.favorites.length > 0,
      favorites: undefined,
    };
  }

  async update(id: string, dto: UpdateDocumentDto, user: RequestUser) {
    const document = await this.findOne(id, user);

    // 작성자 또는 OWNER/TEAM_LEAD만 수정 가능
    if (!canAccessAllTeams(user.role) && document.creatorId !== user.id) {
      throw new ForbiddenException('문서를 수정할 권한이 없습니다.');
    }

    const updated = await this.prisma.teamDocument.update({
      where: { id },
      data: {
        title: dto.title,
        content: dto.content,
        tags: dto.tags,
      },
      include: {
        creator: {
          select: { id: true, name: true, email: true, profileImageUrl: true },
        },
        team: {
          select: { id: true, name: true },
        },
        favorites: {
          where: { userId: user.id },
          select: { id: true },
        },
      },
    });

    return {
      ...updated,
      isFavorite: updated.favorites.length > 0,
      favorites: undefined,
    };
  }

  async remove(id: string, user: RequestUser) {
    const document = await this.findOne(id, user);

    // 작성자 또는 OWNER/TEAM_LEAD만 삭제 가능
    if (!canAccessAllTeams(user.role) && document.creatorId !== user.id) {
      throw new ForbiddenException('문서를 삭제할 권한이 없습니다.');
    }

    await this.prisma.teamDocument.delete({ where: { id } });
    return { message: '문서가 삭제되었습니다.' };
  }

  // 즐겨찾기 토글
  async toggleFavorite(id: string, user: RequestUser) {
    const document = await this.findOne(id, user);

    const existingFavorite = await this.prisma.documentFavorite.findUnique({
      where: {
        documentId_userId: {
          documentId: id,
          userId: user.id,
        },
      },
    });

    if (existingFavorite) {
      await this.prisma.documentFavorite.delete({
        where: { id: existingFavorite.id },
      });
      return { isFavorite: false, message: '즐겨찾기가 해제되었습니다.' };
    } else {
      await this.prisma.documentFavorite.create({
        data: {
          documentId: id,
          userId: user.id,
        },
      });
      return { isFavorite: true, message: '즐겨찾기에 추가되었습니다.' };
    }
  }

  // 인기 태그 조회
  async getPopularTags(user: RequestUser, limit = 10) {
    const whereTeam = canAccessAllTeams(user.role)
      ? {}
      : { teamId: user.teamId || '' };

    const documents = await this.prisma.teamDocument.findMany({
      where: whereTeam,
      select: { tags: true },
    });

    // 태그별 카운트 계산
    const tagCounts: Record<string, number> = {};
    documents.forEach((doc) => {
      doc.tags.forEach((tag) => {
        tagCounts[tag] = (tagCounts[tag] || 0) + 1;
      });
    });

    // 정렬 후 상위 N개 반환
    return Object.entries(tagCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([tag, count]) => ({ tag, count }));
  }
}

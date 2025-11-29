import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../database/prisma.service';
import { UpdateUserDto, ChangePasswordDto } from './dto';
import { ErrorCodes } from '../../common/constants';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async findById(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        status: true,
        teamId: true,
        profileImageUrl: true,
        createdAt: true,
        updatedAt: true,
        team: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundException(ErrorCodes.USER_NOT_FOUND);
    }

    return user;
  }

  async findByEmail(email: string) {
    return this.prisma.user.findUnique({
      where: { email },
    });
  }

  async update(id: string, dto: UpdateUserDto) {
    const user = await this.prisma.user.findUnique({
      where: { id },
    });

    if (!user) {
      throw new NotFoundException(ErrorCodes.USER_NOT_FOUND);
    }

    return this.prisma.user.update({
      where: { id },
      data: dto,
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        status: true,
        teamId: true,
        profileImageUrl: true,
        updatedAt: true,
      },
    });
  }

  async changePassword(id: string, dto: ChangePasswordDto) {
    const user = await this.prisma.user.findUnique({
      where: { id },
    });

    if (!user) {
      throw new NotFoundException(ErrorCodes.USER_NOT_FOUND);
    }

    const isCurrentPasswordValid = await bcrypt.compare(
      dto.currentPassword,
      user.passwordHash,
    );

    if (!isCurrentPasswordValid) {
      throw new BadRequestException({
        code: 'INVALID_CURRENT_PASSWORD',
        message: '현재 비밀번호가 올바르지 않습니다.',
      });
    }

    const newPasswordHash = await bcrypt.hash(dto.newPassword, 10);

    await this.prisma.user.update({
      where: { id },
      data: { passwordHash: newPasswordHash },
    });

    // Revoke all refresh tokens to force re-login
    await this.prisma.refreshToken.updateMany({
      where: { userId: id },
      data: { isRevoked: true },
    });

    return { message: '비밀번호가 변경되었습니다. 다시 로그인해주세요.' };
  }

  async getTeamMembers(teamId: string) {
    return this.prisma.user.findMany({
      where: { teamId },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        status: true,
        profileImageUrl: true,
      },
      orderBy: { name: 'asc' },
    });
  }

  async getSlackReportTemplate(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { slackReportTemplate: true },
    });

    if (!user) {
      throw new NotFoundException(ErrorCodes.USER_NOT_FOUND);
    }

    return { template: user.slackReportTemplate };
  }

  async updateSlackReportTemplate(userId: string, template: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException(ErrorCodes.USER_NOT_FOUND);
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: { slackReportTemplate: template },
    });

    return { message: '슬랙 보고서 템플릿이 저장되었습니다.' };
  }
}

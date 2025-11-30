import {
  Injectable,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { CreateWhitelistDto, UpdateWhitelistDto } from './dto';
import { ErrorCodes } from '../../common/constants';
import { RequestUser } from '../../common/interfaces';

@Injectable()
export class NetworkWhitelistService {
  private readonly logger = new Logger(NetworkWhitelistService.name);

  constructor(private prisma: PrismaService) {}

  async create(dto: CreateWhitelistDto, user: RequestUser) {
    const entry = await this.prisma.networkWhitelist.create({
      data: {
        cidr: dto.cidr,
        description: dto.description,
        isEnabled: dto.isEnabled ?? true,
        createdBy: user.id,
      },
      include: {
        creator: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    this.logger.log(`Network whitelist created: ${dto.cidr} by ${user.email}`);

    return entry;
  }

  async findAll() {
    const entries = await this.prisma.networkWhitelist.findMany({
      include: {
        creator: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return entries;
  }

  async findEnabled() {
    return this.prisma.networkWhitelist.findMany({
      where: { isEnabled: true },
      select: {
        cidr: true,
      },
    });
  }

  async findOne(id: string) {
    const entry = await this.prisma.networkWhitelist.findUnique({
      where: { id },
      include: {
        creator: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    if (!entry) {
      throw new NotFoundException(ErrorCodes.NOT_FOUND);
    }

    return entry;
  }

  async update(id: string, dto: UpdateWhitelistDto, user: RequestUser) {
    const entry = await this.prisma.networkWhitelist.findUnique({
      where: { id },
    });

    if (!entry) {
      throw new NotFoundException(ErrorCodes.NOT_FOUND);
    }

    const updatedEntry = await this.prisma.networkWhitelist.update({
      where: { id },
      data: {
        cidr: dto.cidr,
        description: dto.description,
        isEnabled: dto.isEnabled,
      },
      include: {
        creator: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    this.logger.log(`Network whitelist updated: ${updatedEntry.cidr} by ${user.email}`);

    return updatedEntry;
  }

  async remove(id: string, user: RequestUser) {
    const entry = await this.prisma.networkWhitelist.findUnique({
      where: { id },
    });

    if (!entry) {
      throw new NotFoundException(ErrorCodes.NOT_FOUND);
    }

    await this.prisma.networkWhitelist.delete({
      where: { id },
    });

    this.logger.log(`Network whitelist removed: ${entry.cidr} by ${user.email}`);

    return { message: '화이트리스트 항목이 삭제되었습니다.' };
  }

  async toggleEnabled(id: string, user: RequestUser) {
    const entry = await this.prisma.networkWhitelist.findUnique({
      where: { id },
    });

    if (!entry) {
      throw new NotFoundException(ErrorCodes.NOT_FOUND);
    }

    const updatedEntry = await this.prisma.networkWhitelist.update({
      where: { id },
      data: {
        isEnabled: !entry.isEnabled,
      },
      include: {
        creator: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    this.logger.log(
      `Network whitelist ${updatedEntry.isEnabled ? 'enabled' : 'disabled'}: ${updatedEntry.cidr} by ${user.email}`,
    );

    return updatedEntry;
  }

  /**
   * IP 검증 API용 메서드
   * 클라이언트 IP를 반환하고 화이트리스트 등록 여부를 확인합니다.
   */
  async verifyIp(ip: string) {
    // IPv6 loopback을 IPv4로 변환
    const normalizedIp = ip === '::1' || ip === '::ffff:127.0.0.1' ? '127.0.0.1' : ip.replace('::ffff:', '');

    const whitelistEntries = await this.findEnabled();
    const isAllowed = this.isIpAllowed(normalizedIp, whitelistEntries);

    this.logger.log(`IP verification: ${normalizedIp} - ${isAllowed ? 'allowed' : 'denied'}`);

    return {
      ip: normalizedIp,
      isAllowed,
    };
  }

  // Check if an IP is in the whitelist
  isIpAllowed(ip: string, whitelistEntries: { cidr: string }[]): boolean {
    if (whitelistEntries.length === 0) {
      // If whitelist is empty, allow all
      return true;
    }

    for (const entry of whitelistEntries) {
      if (this.isIpInCidr(ip, entry.cidr)) {
        return true;
      }
    }

    return false;
  }

  private isIpInCidr(ip: string, cidr: string): boolean {
    const [range, bits] = cidr.split('/');
    const mask = bits ? parseInt(bits, 10) : 32;

    const ipLong = this.ipToLong(ip);
    const rangeLong = this.ipToLong(range);

    const maskLong = mask === 0 ? 0 : ~(2 ** (32 - mask) - 1);

    return (ipLong & maskLong) === (rangeLong & maskLong);
  }

  private ipToLong(ip: string): number {
    const parts = ip.split('.');
    return (
      (parseInt(parts[0], 10) << 24) +
      (parseInt(parts[1], 10) << 16) +
      (parseInt(parts[2], 10) << 8) +
      parseInt(parts[3], 10)
    ) >>> 0;
  }
}

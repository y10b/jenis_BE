import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  ParseUUIDPipe,
  Ip,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import { NetworkWhitelistService } from './network-whitelist.service';
import { CreateWhitelistDto, UpdateWhitelistDto } from './dto';
import { CurrentUser, Roles, Public } from '../../common/decorators';
import type { RequestUser } from '../../common/interfaces';
import { UserRole } from '@prisma/client';

/**
 * IP 검증 컨트롤러 (공개 API)
 */
@ApiTags('IP Verification')
@Controller('ip')
export class IpVerificationController {
  constructor(private readonly networkWhitelistService: NetworkWhitelistService) {}

  /**
   * 현재 IP 조회 및 화이트리스트 검증 API
   */
  @ApiOperation({
    summary: '현재 IP 확인 및 화이트리스트 검증',
    description: '클라이언트의 현재 IP 주소를 반환하고 화이트리스트 등록 여부를 확인합니다.',
  })
  @ApiResponse({
    status: 200,
    description: 'IP 정보 및 화이트리스트 검증 결과',
    schema: {
      type: 'object',
      properties: {
        ip: { type: 'string', example: '192.168.1.100' },
        isAllowed: { type: 'boolean', example: true },
      },
    },
  })
  @Public()
  @Get('verify')
  async verifyIp(@Ip() ip: string) {
    return this.networkWhitelistService.verifyIp(ip);
  }
}

/**
 * 네트워크 화이트리스트 관리 컨트롤러
 *
 * 허용된 IP 주소/대역을 관리합니다. OWNER, HEAD 역할이 접근 가능합니다.
 * CIDR 표기법을 사용하여 IP 범위를 지정할 수 있습니다.
 */
@ApiTags('Network Whitelist')
@ApiBearerAuth('accessToken')
@Controller('admin/network-whitelist')
@Roles(UserRole.OWNER, UserRole.HEAD)
export class NetworkWhitelistController {
  constructor(private readonly networkWhitelistService: NetworkWhitelistService) {}

  /**
   * 화이트리스트 항목 생성 API
   */
  @ApiOperation({
    summary: '화이트리스트 추가',
    description: `
새로운 IP 주소 또는 IP 대역을 화이트리스트에 추가합니다.

### CIDR 표기법
- 단일 IP: 192.168.1.1
- IP 대역: 192.168.1.0/24 (192.168.1.0 ~ 192.168.1.255)
    `,
  })
  @ApiResponse({ status: 201, description: '화이트리스트 추가 성공' })
  @Post()
  create(@Body() dto: CreateWhitelistDto, @CurrentUser() user: RequestUser) {
    return this.networkWhitelistService.create(dto, user);
  }

  /**
   * 화이트리스트 전체 조회 API
   */
  @ApiOperation({
    summary: '화이트리스트 전체 조회',
    description: '등록된 모든 화이트리스트 항목을 조회합니다.',
  })
  @ApiResponse({ status: 200, description: '화이트리스트 목록 반환' })
  @Get()
  findAll() {
    return this.networkWhitelistService.findAll();
  }

  /**
   * 화이트리스트 상세 조회 API
   */
  @ApiOperation({
    summary: '화이트리스트 상세 조회',
    description: '특정 화이트리스트 항목의 상세 정보를 조회합니다.',
  })
  @ApiParam({ name: 'id', description: '화이트리스트 UUID' })
  @ApiResponse({ status: 200, description: '화이트리스트 상세 정보 반환' })
  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.networkWhitelistService.findOne(id);
  }

  /**
   * 화이트리스트 수정 API
   */
  @ApiOperation({
    summary: '화이트리스트 수정',
    description: '화이트리스트 항목의 정보를 수정합니다.',
  })
  @ApiParam({ name: 'id', description: '화이트리스트 UUID' })
  @ApiResponse({ status: 200, description: '수정 성공' })
  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateWhitelistDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.networkWhitelistService.update(id, dto, user);
  }

  /**
   * 화이트리스트 활성화 토글 API
   */
  @ApiOperation({
    summary: '화이트리스트 활성화 토글',
    description: '화이트리스트 항목의 활성화 상태를 반전시킵니다.',
  })
  @ApiParam({ name: 'id', description: '화이트리스트 UUID' })
  @ApiResponse({ status: 200, description: '토글 성공' })
  @Patch(':id/toggle')
  toggleEnabled(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.networkWhitelistService.toggleEnabled(id, user);
  }

  /**
   * 화이트리스트 삭제 API
   */
  @ApiOperation({
    summary: '화이트리스트 삭제',
    description: '화이트리스트 항목을 삭제합니다.',
  })
  @ApiParam({ name: 'id', description: '화이트리스트 UUID' })
  @ApiResponse({ status: 200, description: '삭제 성공' })
  @Delete(':id')
  remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.networkWhitelistService.remove(id, user);
  }
}

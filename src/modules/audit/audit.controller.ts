import {
  Controller,
  Get,
  Query,
  Param,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import { AuditService } from './audit.service';
import { AuditQueryDto } from './dto';
import { CurrentUser, Roles } from '../../common/decorators';
import type { RequestUser } from '../../common/interfaces';
import { UserRole } from '@prisma/client';

/**
 * 감사 로그 컨트롤러
 *
 * 시스템의 모든 중요 활동을 기록하고 조회하는 감사(Audit) 기능을 제공합니다.
 * OWNER와 HEAD 역할만 접근 가능합니다.
 */
@ApiTags('Audit')
@ApiBearerAuth('accessToken')
@Controller('audit')
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  /**
   * 감사 로그 목록 조회 API
   */
  @ApiOperation({
    summary: '감사 로그 조회',
    description: `
시스템의 감사 로그를 조회합니다.

### 권한
- OWNER, HEAD만 접근 가능

### 필터링
- 사용자, 액션, 엔티티 유형, 기간 등으로 필터링 가능
    `,
  })
  @ApiResponse({ status: 200, description: '감사 로그 목록 반환' })
  @Get()
  @Roles(UserRole.OWNER, UserRole.HEAD)
  findAll(@Query() query: AuditQueryDto, @CurrentUser() user: RequestUser) {
    return this.auditService.findAll(query, user);
  }

  /**
   * 감사 통계 조회 API
   */
  @ApiOperation({
    summary: '감사 통계 조회',
    description: '감사 로그의 통계 정보를 조회합니다. OWNER만 접근 가능합니다.',
  })
  @ApiResponse({ status: 200, description: '감사 통계 반환' })
  @Get('stats')
  @Roles(UserRole.OWNER)
  getStats(@CurrentUser() user: RequestUser) {
    return this.auditService.getStats(user);
  }

  /**
   * 엔티티별 감사 로그 조회 API
   */
  @ApiOperation({
    summary: '엔티티별 감사 로그 조회',
    description: '특정 엔티티(업무, 팀 등)의 변경 이력을 조회합니다.',
  })
  @ApiParam({ name: 'entityType', description: '엔티티 유형 (예: TASK, USER, TEAM)' })
  @ApiParam({ name: 'entityId', description: '엔티티 UUID' })
  @ApiResponse({ status: 200, description: '해당 엔티티의 감사 로그 반환' })
  @Get('entity/:entityType/:entityId')
  @Roles(UserRole.OWNER, UserRole.HEAD)
  findByEntity(
    @Param('entityType') entityType: string,
    @Param('entityId') entityId: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.auditService.findByEntity(entityType, entityId, user);
  }
}

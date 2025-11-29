import {
  Controller,
  Get,
  Post,
  Body,
  Query,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { AttendanceService } from './attendance.service';
import { CreateAttendanceDto } from './dto';
import { CurrentUser, Roles } from '../../common/decorators';
import type { RequestUser } from '../../common/interfaces';
import { UserRole } from '@prisma/client';

@ApiTags('Attendance')
@ApiBearerAuth('accessToken')
@Controller('attendance')
export class AttendanceController {
  constructor(private readonly attendanceService: AttendanceService) {}

  @ApiOperation({
    summary: '출퇴근 기록',
    description: '출근 또는 퇴근을 기록합니다. 팀 리드와 대표에게 알림이 전송됩니다.',
  })
  @Post()
  async create(
    @Body() dto: CreateAttendanceDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.attendanceService.create(dto, user);
  }

  @ApiOperation({
    summary: '오늘의 출퇴근 상태 조회',
    description: '현재 사용자의 오늘 출퇴근 상태를 조회합니다.',
  })
  @Get('today')
  async getTodayStatus(@CurrentUser() user: RequestUser) {
    return this.attendanceService.getTodayStatus(user);
  }

  @ApiOperation({
    summary: '출퇴근 기록 목록 조회',
    description: '날짜별 출퇴근 기록을 조회합니다. (관리자 전용)',
  })
  @ApiQuery({ name: 'date', required: false, description: '조회 날짜 (YYYY-MM-DD)' })
  @ApiQuery({ name: 'teamId', required: false, description: '팀 ID' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @Roles(UserRole.OWNER, UserRole.HEAD, UserRole.LEAD)
  @Get()
  async findAll(
    @Query('date') date?: string,
    @Query('teamId') teamId?: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.attendanceService.findAll({ date, teamId, page, limit });
  }
}

import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AttendanceType } from '@prisma/client';

export class CreateAttendanceDto {
  @ApiProperty({
    description: '출퇴근 타입',
    enum: AttendanceType,
    example: 'CHECK_IN',
  })
  @IsEnum(AttendanceType)
  type: AttendanceType;

  @ApiPropertyOptional({
    description: '메모',
    example: '재택근무',
    maxLength: 200,
  })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  note?: string;
}

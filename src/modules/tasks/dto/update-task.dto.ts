import {
  IsString,
  IsOptional,
  IsEnum,
  IsUUID,
  IsDateString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { TaskStatus, TaskPriority } from '@prisma/client';

/**
 * 업무(Task) 수정 DTO
 *
 * 기존 업무를 수정할 때 사용하는 데이터 전송 객체입니다.
 * 모든 필드는 선택적이며, 제공된 필드만 업데이트됩니다.
 *
 * @example
 * ```json
 * {
 *   "status": "IN_PROGRESS",
 *   "priority": "URGENT"
 * }
 * ```
 */
export class UpdateTaskDto {
  /**
   * 변경할 제목
   */
  @ApiPropertyOptional({
    description: '변경할 업무 제목',
    example: 'API 개발 (수정됨)',
    minLength: 1,
    maxLength: 200,
  })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  title?: string;

  /**
   * 변경할 설명
   */
  @ApiPropertyOptional({
    description: '변경할 업무 설명',
    example: '수정된 상세 설명입니다.',
    maxLength: 5000,
  })
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  description?: string;

  /**
   * 변경할 상태
   */
  @ApiPropertyOptional({
    description: '변경할 업무 상태',
    enum: TaskStatus,
    example: 'IN_PROGRESS',
  })
  @IsOptional()
  @IsEnum(TaskStatus)
  status?: TaskStatus;

  /**
   * 변경할 우선순위
   */
  @ApiPropertyOptional({
    description: '변경할 업무 우선순위',
    enum: TaskPriority,
    example: 'URGENT',
  })
  @IsOptional()
  @IsEnum(TaskPriority)
  priority?: TaskPriority;

  /**
   * 변경할 마감일
   */
  @ApiPropertyOptional({
    description: '변경할 마감일',
    example: '2024-12-31T23:59:59Z',
    format: 'date-time',
  })
  @IsOptional()
  @IsDateString()
  dueDate?: string;

  /**
   * 변경할 담당자
   */
  @ApiPropertyOptional({
    description: '변경할 담당자 UUID',
    example: '550e8400-e29b-41d4-a716-446655440000',
    format: 'uuid',
  })
  @IsOptional()
  @IsUUID()
  assigneeId?: string;
}

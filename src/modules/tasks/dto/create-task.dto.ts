import {
  IsString,
  IsOptional,
  IsEnum,
  IsUUID,
  IsDateString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TaskStatus, TaskPriority } from '@prisma/client';

/**
 * 업무(Task) 생성 DTO
 *
 * 새로운 업무를 생성할 때 사용하는 데이터 전송 객체입니다.
 * 제목만 필수이며, 나머지 항목은 선택적으로 설정할 수 있습니다.
 *
 * @example
 * ```json
 * {
 *   "title": "API 개발",
 *   "description": "사용자 인증 API 개발",
 *   "status": "TODO",
 *   "priority": "HIGH",
 *   "dueDate": "2024-12-31T23:59:59Z",
 *   "assigneeId": "uuid",
 *   "teamId": "team-uuid"
 * }
 * ```
 */
export class CreateTaskDto {
  /**
   * 업무 제목 (1-200자)
   */
  @ApiProperty({
    description: '업무 제목. 간결하고 명확하게 작성',
    example: 'API 개발',
    minLength: 1,
    maxLength: 200,
  })
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  title: string;

  /**
   * 업무 상세 설명
   */
  @ApiPropertyOptional({
    description: '업무에 대한 상세 설명. 마크다운 지원',
    example: '사용자 인증 API를 개발합니다.\n- 로그인\n- 회원가입\n- 토큰 갱신',
    maxLength: 5000,
  })
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  description?: string;

  /**
   * 업무 상태
   * - TODO: 할 일
   * - IN_PROGRESS: 진행 중
   * - REVIEW: 검토 중
   * - DONE: 완료
   */
  @ApiPropertyOptional({
    description: '업무 상태. 기본값: TODO',
    enum: TaskStatus,
    example: 'TODO',
  })
  @IsOptional()
  @IsEnum(TaskStatus)
  status?: TaskStatus;

  /**
   * 업무 우선순위
   * - URGENT: 긴급
   * - HIGH: 높음
   * - MEDIUM: 보통
   * - LOW: 낮음
   */
  @ApiPropertyOptional({
    description: '업무 우선순위. 기본값: MEDIUM',
    enum: TaskPriority,
    example: 'HIGH',
  })
  @IsOptional()
  @IsEnum(TaskPriority)
  priority?: TaskPriority;

  /**
   * 마감일 (ISO 8601 형식)
   */
  @ApiPropertyOptional({
    description: '마감일. ISO 8601 형식',
    example: '2024-12-31T23:59:59Z',
    format: 'date-time',
  })
  @IsOptional()
  @IsDateString()
  dueDate?: string;

  /**
   * 담당자 ID
   */
  @ApiPropertyOptional({
    description: '업무 담당자 UUID',
    example: '550e8400-e29b-41d4-a716-446655440000',
    format: 'uuid',
  })
  @IsOptional()
  @IsUUID()
  assigneeId?: string;

  /**
   * 소속 팀 ID
   */
  @ApiPropertyOptional({
    description: '업무가 속한 팀 UUID. 미지정 시 생성자의 팀으로 설정',
    example: '550e8400-e29b-41d4-a716-446655440000',
    format: 'uuid',
  })
  @IsOptional()
  @IsUUID()
  teamId?: string;
}

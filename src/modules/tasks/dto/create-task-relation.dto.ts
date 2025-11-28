import { IsUUID, IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { TaskRelationType } from '@prisma/client';

/**
 * 업무 관계 생성 DTO
 *
 * 두 업무 간의 관계를 설정할 때 사용하는 데이터 전송 객체입니다.
 *
 * @example
 * ```json
 * {
 *   "targetTaskId": "550e8400-e29b-41d4-a716-446655440000",
 *   "type": "BLOCKS"
 * }
 * ```
 */
export class CreateTaskRelationDto {
  /**
   * 관계 대상 업무 ID
   */
  @ApiProperty({
    description: '관계를 맺을 대상 업무 UUID',
    example: '550e8400-e29b-41d4-a716-446655440000',
    format: 'uuid',
  })
  @IsUUID()
  targetTaskId: string;

  /**
   * 관계 유형
   * - BLOCKS: 현재 업무가 대상 업무를 차단 (선행 작업)
   * - BLOCKED_BY: 현재 업무가 대상 업무에 의해 차단됨
   * - RELATES_TO: 관련 업무
   * - DUPLICATES: 중복 업무
   */
  @ApiProperty({
    description: '업무 간 관계 유형',
    enum: TaskRelationType,
    example: 'BLOCKS',
  })
  @IsEnum(TaskRelationType)
  type: TaskRelationType;
}

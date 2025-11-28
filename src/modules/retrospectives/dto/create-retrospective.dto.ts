import {
  IsString,
  IsOptional,
  IsEnum,
  IsBoolean,
  IsDateString,
  MaxLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { RetroType, Visibility } from '@prisma/client';

/**
 * 회고 생성 DTO
 *
 * 새로운 회고를 작성할 때 사용합니다.
 * 회고 유형, 기간, 내용 등을 입력합니다.
 *
 * @example
 * ```json
 * {
 *   "type": "WEEKLY",
 *   "title": "2024년 1주차 회고",
 *   "content": "이번 주 배운 점과 개선할 점...",
 *   "periodStart": "2024-01-01",
 *   "periodEnd": "2024-01-07",
 *   "isDraft": false,
 *   "visibility": "TEAM"
 * }
 * ```
 */
export class CreateRetrospectiveDto {
  /**
   * 회고 유형
   * DAILY(일간), WEEKLY(주간), MONTHLY(월간), PROJECT(프로젝트)
   */
  @ApiProperty({
    description: '회고 유형',
    enum: RetroType,
    example: 'WEEKLY',
    enumName: 'RetroType',
  })
  @IsEnum(RetroType)
  type: RetroType;

  /**
   * 회고 제목 (선택)
   */
  @ApiPropertyOptional({
    description: '회고 제목. 미입력 시 기간 기반 자동 생성',
    example: '2024년 1월 1주차 회고',
    maxLength: 200,
  })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  title?: string;

  /**
   * 회고 내용
   */
  @ApiProperty({
    description: '회고 본문 내용. 마크다운 형식 지원',
    example: '## 이번 주 배운 점\n- TypeScript 제네릭 활용법\n\n## 개선할 점\n- 코드 리뷰 시간 확보',
    maxLength: 10000,
  })
  @IsString()
  @MaxLength(10000)
  content: string;

  /**
   * 회고 기간 시작일
   */
  @ApiProperty({
    description: '회고 기간 시작 날짜 (ISO 8601 형식)',
    example: '2024-01-01',
    format: 'date',
  })
  @IsDateString()
  periodStart: string;

  /**
   * 회고 기간 종료일
   */
  @ApiProperty({
    description: '회고 기간 종료 날짜 (ISO 8601 형식)',
    example: '2024-01-07',
    format: 'date',
  })
  @IsDateString()
  periodEnd: string;

  /**
   * 임시저장 여부
   */
  @ApiPropertyOptional({
    description: '임시저장 여부. true일 경우 발행되지 않음',
    example: false,
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  isDraft?: boolean;

  /**
   * 공개 범위
   * PRIVATE(본인만), TEAM(팀원), PUBLIC(전체)
   */
  @ApiPropertyOptional({
    description: '회고 공개 범위',
    enum: Visibility,
    example: 'TEAM',
    enumName: 'Visibility',
    default: 'PRIVATE',
  })
  @IsOptional()
  @IsEnum(Visibility)
  visibility?: Visibility;
}

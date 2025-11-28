import { IsString, MaxLength, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

/**
 * 업무 댓글 생성 DTO
 *
 * 업무에 댓글을 추가할 때 사용하는 데이터 전송 객체입니다.
 *
 * @example
 * ```json
 * {
 *   "content": "이 부분 검토 부탁드립니다."
 * }
 * ```
 */
export class CreateCommentDto {
  /**
   * 댓글 내용
   */
  @ApiProperty({
    description: '댓글 내용. 업무에 대한 의견이나 질문 작성',
    example: '이 부분 검토 부탁드립니다.',
    minLength: 1,
    maxLength: 2000,
  })
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  content: string;
}

import { IsString, IsOptional, IsBoolean, Matches } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

/**
 * 네트워크 화이트리스트 수정 DTO
 *
 * 기존 화이트리스트 항목을 수정할 때 사용합니다.
 */
export class UpdateWhitelistDto {
  /**
   * 변경할 IP 주소 또는 CIDR
   */
  @ApiPropertyOptional({
    description: '변경할 IP 주소 또는 CIDR',
    example: '10.0.0.0/8',
    pattern: '^(\\d{1,3}\\.){3}\\d{1,3}(\\/\\d{1,2})?$',
  })
  @IsOptional()
  @IsString()
  @Matches(/^(\d{1,3}\.){3}\d{1,3}(\/\d{1,2})?$/, {
    message: 'CIDR 형식이 올바르지 않습니다. (예: 192.168.1.0/24 또는 192.168.1.1)',
  })
  cidr?: string;

  /**
   * 변경할 설명
   */
  @ApiPropertyOptional({
    description: '변경할 설명',
  })
  @IsOptional()
  @IsString()
  description?: string;

  /**
   * 변경할 활성화 상태
   */
  @ApiPropertyOptional({
    description: '변경할 활성화 상태',
  })
  @IsOptional()
  @IsBoolean()
  isEnabled?: boolean;
}

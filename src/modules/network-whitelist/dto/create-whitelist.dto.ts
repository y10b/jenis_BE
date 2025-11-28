import { IsString, IsOptional, IsBoolean, Matches } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * 네트워크 화이트리스트 생성 DTO
 *
 * 허용할 IP 주소 또는 IP 대역(CIDR)을 등록할 때 사용합니다.
 *
 * @example
 * ```json
 * {
 *   "cidr": "192.168.1.0/24",
 *   "description": "사내 네트워크",
 *   "isEnabled": true
 * }
 * ```
 */
export class CreateWhitelistDto {
  /**
   * IP 주소 또는 CIDR 표기법
   * 예: "192.168.1.1" 또는 "192.168.1.0/24"
   */
  @ApiProperty({
    description: 'IP 주소 또는 CIDR 표기법. 예: "192.168.1.0/24"',
    example: '192.168.1.0/24',
    pattern: '^(\\d{1,3}\\.){3}\\d{1,3}(\\/\\d{1,2})?$',
  })
  @IsString()
  @Matches(/^(\d{1,3}\.){3}\d{1,3}(\/\d{1,2})?$/, {
    message: 'CIDR 형식이 올바르지 않습니다. (예: 192.168.1.0/24 또는 192.168.1.1)',
  })
  cidr: string;

  /**
   * 화이트리스트 설명
   */
  @ApiPropertyOptional({
    description: 'IP 대역에 대한 설명 (예: 사내 네트워크, VPN 등)',
    example: '사내 네트워크',
  })
  @IsOptional()
  @IsString()
  description?: string;

  /**
   * 활성화 여부
   */
  @ApiPropertyOptional({
    description: '화이트리스트 활성화 여부. 비활성화 시 해당 IP 허용 안 됨',
    example: true,
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  isEnabled?: boolean = true;
}

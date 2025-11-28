import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { Public } from '../common/decorators';

/**
 * 헬스체크 컨트롤러
 *
 * 서버 상태 확인을 위한 API입니다.
 * 인증 없이 접근 가능하며, 로드밸런서 헬스체크에 사용됩니다.
 */
@ApiTags('Health')
@Controller('health')
export class HealthController {
  /**
   * 헬스체크 API
   */
  @ApiOperation({
    summary: '서버 상태 확인',
    description: `
서버의 동작 상태를 확인합니다.

### 사용 시나리오
- 로드밸런서 헬스체크
- 모니터링 시스템 연동
- 서비스 가용성 확인

### 인증
- 인증 불필요 (Public)
    `,
  })
  @ApiResponse({
    status: 200,
    description: '서버 정상 동작',
    schema: {
      example: {
        status: 'ok',
        timestamp: '2024-01-01T00:00:00.000Z',
      },
    },
  })
  @Public()
  @Get()
  check() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
    };
  }
}

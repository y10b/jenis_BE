import {
  Controller,
  Post,
  Get,
  Body,
  Res,
  Req,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import type { Response, Request } from 'express';
import { AuthGuard } from '@nestjs/passport';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiBody,
  ApiCookieAuth,
} from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { SignupDto, LoginDto } from './dto';
import { Public, CurrentUser } from '../../common/decorators';
import { RequestUser } from '../../common/interfaces';

/**
 * 인증 컨트롤러
 *
 * 사용자 인증과 관련된 모든 API를 처리합니다.
 * - 회원가입: 새로운 사용자 등록 (관리자 승인 필요)
 * - 로그인: JWT 토큰 발급 및 쿠키 설정
 * - 토큰 갱신: 리프레시 토큰으로 새 액세스 토큰 발급
 * - 로그아웃: 토큰 폐기 및 쿠키 삭제
 * - 내 정보 조회: 현재 로그인한 사용자 정보 반환
 */
@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  /**
   * 회원가입 API
   *
   * 새로운 사용자 계정을 생성합니다.
   * 계정 생성 후 PENDING 상태로 설정되며, 관리자 승인 후 로그인이 가능합니다.
   */
  @ApiOperation({
    summary: '회원가입',
    description: `
새로운 사용자 계정을 생성합니다.

### 사용 시나리오
- 신규 사용자가 서비스에 가입할 때 사용
- 회원가입 후 관리자 승인이 필요함

### 주의사항
- 이메일은 중복 불가
- 비밀번호는 영문, 숫자, 특수문자 조합 필수
- 가입 후 상태가 PENDING이므로 즉시 로그인 불가

### 후속 작업
1. 관리자가 \`POST /api/v1/admin/users/:id/approve\` 호출하여 승인
2. 승인 후 로그인 가능
    `,
  })
  @ApiBody({ type: SignupDto })
  @ApiResponse({
    status: 201,
    description: '회원가입 성공. 관리자 승인 대기 상태',
    schema: {
      example: {
        success: true,
        data: {
          id: 'uuid',
          email: 'user@example.com',
          name: '홍길동',
          status: 'PENDING',
          message: '가입 신청이 완료되었습니다. 관리자 승인 후 이용 가능합니다.',
        },
      },
    },
  })
  @ApiResponse({
    status: 409,
    description: '이미 존재하는 이메일',
    schema: {
      example: {
        success: false,
        error: {
          code: 'EMAIL_ALREADY_EXISTS',
          message: '이미 등록된 이메일입니다.',
        },
      },
    },
  })
  @Public()
  @Post('signup')
  async signup(@Body() dto: SignupDto) {
    return this.authService.signup(dto);
  }

  /**
   * 로그인 API
   *
   * 이메일과 비밀번호로 인증 후 JWT 토큰을 발급합니다.
   * 액세스 토큰(15분)과 리프레시 토큰(7일)이 쿠키로 설정됩니다.
   */
  @ApiOperation({
    summary: '로그인',
    description: `
이메일과 비밀번호로 로그인하여 JWT 토큰을 발급받습니다.

### 토큰 발급 방식
- **액세스 토큰**: 15분 유효, 모든 API 호출 시 사용
- **리프레시 토큰**: 7일 유효, 토큰 갱신 시 사용
- 두 토큰 모두 HttpOnly 쿠키로 자동 설정됨

### 사용 시나리오
1. 사용자가 이메일/비밀번호 입력
2. 로그인 성공 시 쿠키에 토큰 저장
3. 이후 API 호출 시 자동으로 쿠키의 토큰 사용

### 에러 케이스
- 잘못된 이메일 또는 비밀번호
- 승인 대기 중인 계정 (PENDING)
- 비활성화된 계정 (INACTIVE)
    `,
  })
  @ApiBody({ type: LoginDto })
  @ApiResponse({
    status: 200,
    description: '로그인 성공. 쿠키에 토큰 설정됨',
    schema: {
      example: {
        success: true,
        data: {
          user: {
            id: 'uuid',
            email: 'user@example.com',
            name: '홍길동',
            role: 'ACTOR',
            teamId: 'team-uuid',
            profileImageUrl: null,
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 401,
    description: '인증 실패',
    schema: {
      example: {
        success: false,
        error: {
          code: 'INVALID_CREDENTIALS',
          message: '이메일 또는 비밀번호가 올바르지 않습니다.',
        },
      },
    },
  })
  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() dto: LoginDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.authService.login(dto);
    const origin = request.headers.origin;

    // 쿠키에 토큰 저장
    response.cookie(
      'accessToken',
      result.accessToken,
      this.authService.getCookieOptions('access', origin),
    );
    response.cookie(
      'refreshToken',
      result.refreshToken,
      this.authService.getCookieOptions('refresh', origin),
    );

    return { user: result.user };
  }

  /**
   * 토큰 갱신 API
   *
   * 리프레시 토큰을 사용하여 새로운 액세스 토큰을 발급합니다.
   * 기존 리프레시 토큰은 폐기되고 새 리프레시 토큰도 함께 발급됩니다.
   */
  @ApiOperation({
    summary: '토큰 갱신',
    description: `
리프레시 토큰으로 새로운 액세스 토큰을 발급받습니다.

### 동작 방식
1. 쿠키의 리프레시 토큰 검증
2. 기존 리프레시 토큰 폐기 (Rotation)
3. 새 액세스 토큰 + 리프레시 토큰 발급
4. 쿠키에 새 토큰 저장

### 사용 시나리오
- 액세스 토큰 만료 시 (15분 후)
- 프론트엔드에서 401 응답 수신 시 자동 호출

### 보안 특징
- 리프레시 토큰 Rotation으로 탈취 시 피해 최소화
- 사용된 토큰은 재사용 불가
    `,
  })
  @ApiCookieAuth('refreshToken')
  @ApiResponse({
    status: 200,
    description: '토큰 갱신 성공',
    schema: {
      example: {
        success: true,
        data: {
          message: '토큰이 갱신되었습니다.',
        },
      },
    },
  })
  @ApiResponse({
    status: 401,
    description: '유효하지 않거나 만료된 리프레시 토큰',
  })
  @Public()
  @UseGuards(AuthGuard('jwt-refresh'))
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(
    @CurrentUser() user: RequestUser & { tokenId: string },
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const tokens = await this.authService.refresh(user);
    const origin = request.headers.origin;

    response.cookie(
      'accessToken',
      tokens.accessToken,
      this.authService.getCookieOptions('access', origin),
    );
    response.cookie(
      'refreshToken',
      tokens.refreshToken,
      this.authService.getCookieOptions('refresh', origin),
    );

    return { message: '토큰이 갱신되었습니다.' };
  }

  /**
   * 로그아웃 API
   *
   * 현재 세션을 종료하고 모든 토큰을 폐기합니다.
   */
  @ApiOperation({
    summary: '로그아웃',
    description: `
현재 로그인 세션을 종료합니다.

### 동작 방식
1. 서버에서 리프레시 토큰 폐기
2. 클라이언트의 쿠키 삭제
3. 이후 해당 토큰으로 API 호출 불가

### 사용 시나리오
- 사용자가 명시적으로 로그아웃 버튼 클릭
- 보안상 세션 종료 필요 시
    `,
  })
  @ApiBearerAuth('accessToken')
  @ApiResponse({
    status: 200,
    description: '로그아웃 성공',
    schema: {
      example: {
        success: true,
        data: {
          message: '로그아웃되었습니다.',
        },
      },
    },
  })
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(
    @CurrentUser('id') userId: string,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const refreshToken = request.cookies?.refreshToken;
    await this.authService.logout(userId, refreshToken);

    const origin = request.headers.origin;

    // 쿠키 삭제 (설정할 때와 동일한 옵션 사용)
    const accessClearOptions = this.authService.getCookieOptions('access', origin);
    const refreshClearOptions = this.authService.getCookieOptions('refresh', origin);

    response.clearCookie('accessToken', accessClearOptions);
    response.clearCookie('refreshToken', refreshClearOptions);

    return { message: '로그아웃되었습니다.' };
  }

  /**
   * 내 정보 조회 API
   *
   * 현재 로그인한 사용자의 상세 정보를 반환합니다.
   */
  @ApiOperation({
    summary: '내 정보 조회',
    description: `
현재 로그인한 사용자의 정보를 조회합니다.

### 반환 정보
- 기본 정보: ID, 이메일, 이름, 역할, 상태
- 팀 정보: 소속 팀 ID 및 이름
- 연동 상태: GitHub, Slack 연동 여부

### 사용 시나리오
- 로그인 후 사용자 정보 표시
- 프로필 페이지 렌더링
- 권한 확인 (역할 기반 UI 분기)
    `,
  })
  @ApiBearerAuth('accessToken')
  @ApiResponse({
    status: 200,
    description: '사용자 정보 반환',
    schema: {
      example: {
        success: true,
        data: {
          id: 'uuid',
          email: 'user@example.com',
          name: '홍길동',
          role: 'ACTOR',
          status: 'ACTIVE',
          teamId: 'team-uuid',
          profileImageUrl: 'https://...',
          createdAt: '2024-01-01T00:00:00.000Z',
          team: {
            id: 'team-uuid',
            name: '개발팀',
          },
          integrations: {
            github: true,
            slack: false,
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 401,
    description: '인증되지 않은 요청',
  })
  @Get('me')
  async getMe(@CurrentUser('id') userId: string) {
    return this.authService.getMe(userId);
  }
}

import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';

/**
 * 애플리케이션 부트스트랩 함수
 * NestJS 애플리케이션을 초기화하고 설정을 적용합니다.
 */
async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule, {
    // GitHub Webhook의 raw body 접근을 위해 rawBody 옵션 활성화
    rawBody: true,
  });

  const configService = app.get(ConfigService);
  const port = configService.get<number>('app.port');
  const frontendUrl = configService.get<string>('app.frontendUrl');

  // API 전역 접두사 설정 (/api/v1)
  app.setGlobalPrefix('api/v1');

  // CORS 설정 - 프론트엔드 도메인에서의 요청 허용
  const allowedOrigins = [
    frontendUrl,
    'http://localhost:3000',
    'http://localhost:8080',
  ].filter(Boolean);

  app.enableCors({
    origin: (origin, callback) => {
      // 개발 환경에서 origin이 없는 경우 (Postman, curl 등) 허용
      if (!origin) return callback(null, true);

      if (allowedOrigins.some(allowed => allowed && origin.startsWith(allowed.replace(/\/$/, '')))) {
        return callback(null, true);
      }
      callback(new Error('Not allowed by CORS'));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  });

  // 쿠키 파서 미들웨어 적용
  app.use(cookieParser());

  // 전역 유효성 검사 파이프 설정
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,              // DTO에 정의되지 않은 속성 제거
      forbidNonWhitelisted: true,   // 정의되지 않은 속성이 있으면 에러
      transform: true,              // 요청 데이터를 DTO 타입으로 자동 변환
      transformOptions: {
        enableImplicitConversion: true,  // 암시적 타입 변환 활성화
      },
    }),
  );

  // Swagger API 문서 설정
  const swaggerConfig = new DocumentBuilder()
    .setTitle('InTalk Backoffice API')
    .setDescription(`
## 📋 InTalk 백오피스 API 문서

InTalk 백오피스는 팀 협업 및 업무 관리를 위한 종합 솔루션입니다.

### 🔐 인증 방식
- **JWT Bearer Token**: 대부분의 API는 JWT 토큰 인증이 필요합니다.
- 로그인 후 발급받은 \`accessToken\`을 Authorization 헤더에 포함해주세요.
- 토큰 만료 시 \`refreshToken\`을 사용하여 새 토큰을 발급받을 수 있습니다.

### 👥 사용자 역할 (Role)
| 역할 | 설명 | 권한 |
|------|------|------|
| **OWNER** | 최고 관리자 | 모든 기능 접근 가능 |
| **HEAD** | 부서장 | 팀 관리, 사용자 관리 |
| **LEAD** | 팀 리더 | 팀 내 업무 관리 |
| **ACTOR** | 일반 사용자 | 기본 기능 사용 |

### 📡 실시간 알림
- WebSocket 연결: \`/notifications\` 네임스페이스
- JWT 토큰을 query parameter(\`token\`) 또는 Authorization 헤더로 전달

### 🔗 외부 연동
- **GitHub**: OAuth 연동으로 이슈/PR 관리
- **Slack**: 팀 채널로 알림 전송

### 📝 공통 응답 형식
\`\`\`json
{
  "success": true,
  "data": { ... },
  "meta": {
    "total": 100,
    "page": 1,
    "limit": 20,
    "totalPages": 5
  }
}
\`\`\`

### ❌ 에러 응답 형식
\`\`\`json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "에러 메시지"
  }
}
\`\`\`
    `)
    .setVersion('1.0.0')
    .setContact('InTalk Team', 'https://intalk.io', 'support@intalk.io')
    .setLicense('Private', '')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        name: 'Authorization',
        description: '로그인 후 발급받은 JWT 액세스 토큰을 입력하세요',
        in: 'header',
      },
      'accessToken',
    )
    .addTag('Auth', '인증 관련 API - 로그인, 회원가입, 토큰 갱신')
    .addTag('Users', '사용자 관리 API - 프로필 조회/수정, 비밀번호 변경')
    .addTag('Admin', '관리자 전용 API - 사용자 승인, 역할 관리')
    .addTag('Teams', '팀 관리 API - 팀 생성, 멤버 관리, 팀 간 공유')
    .addTag('Tasks', '업무(Task) 관리 API - CRUD, 댓글, 관계 설정')
    .addTag('Schedules', '스케줄 관리 API - 회의, 리마인더, 리포트')
    .addTag('Notifications', '알림 API - 조회, 읽음 처리')
    .addTag('Retrospectives', '회고 관리 API - 주간/월간 회고 작성')
    .addTag('Dashboard', '대시보드 API - 통계, 현황 조회')
    .addTag('Integrations', '외부 서비스 연동 API - GitHub, Slack')
    .addTag('Audit', '감사 로그 API - 시스템 활동 기록 조회')
    .addTag('Network Whitelist', 'IP 화이트리스트 관리 API')
    .addTag('Health', '서버 상태 확인 API')
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, document, {
    swaggerOptions: {
      persistAuthorization: true,  // 페이지 새로고침 시 인증 정보 유지
      tagsSorter: 'alpha',         // 태그 알파벳 순 정렬
      operationsSorter: 'alpha',   // 엔드포인트 알파벳 순 정렬
    },
    customSiteTitle: 'InTalk Backoffice API Docs',
    customCss: '.swagger-ui .topbar { display: none }',  // 상단바 숨김
  });

  const listenPort = port || 3000;
  await app.listen(listenPort);

  logger.log(`🚀 Application is running on: http://localhost:${listenPort}/api/v1`);
  logger.log(`📚 Swagger API Docs: http://localhost:${listenPort}/api/docs`);
  logger.log(`❤️ Health check: http://localhost:${listenPort}/api/v1/health`);
}
bootstrap();

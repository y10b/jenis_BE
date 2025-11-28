# Jenis Backoffice - Backend API

InTalk 백오피스 백엔드 API 서버입니다.

## 기술 스택

- **Framework**: NestJS
- **Language**: TypeScript
- **Database**: PostgreSQL (Prisma ORM)
- **Cache**: Redis (BullMQ)
- **Authentication**: JWT (Access + Refresh Token)
- **Real-time**: Socket.io (WebSocket)
- **Documentation**: Swagger/OpenAPI

## 주요 기능

### 인증 및 사용자 관리
- 회원가입 (관리자 승인 필요)
- JWT 기반 인증 (Access Token + Refresh Token)
- 역할 기반 접근 제어 (OWNER, HEAD, LEAD, ACTOR)
- 사용자 승인/거절/비활성화

### 업무 관리
- 업무 CRUD (생성, 조회, 수정, 삭제)
- 상태 관리 (TODO, IN_PROGRESS, REVIEW, DONE, CANCELLED)
- 우선순위 (P0-P3)
- 댓글 및 히스토리 추적
- 업무 간 관계 설정 (DEPENDS_ON, BLOCKS, RELATED)

### 팀 관리
- 팀 CRUD
- 멤버 관리 (추가/제거)
- 팀 간 공유 설정

### 회고록
- 주간/중간/월간 회고 작성
- 공개 범위 설정 (PRIVATE, TEAM, ALL)
- 발행/임시저장
- 사용자/팀 공유

### 일정 관리
- 회의/리마인더/리포트 일정
- CRON 기반 반복 일정
- 팀별 일정 배정

### 알림
- 실시간 알림 (WebSocket)
- 읽음/안읽음 상태 관리

### 외부 연동
- GitHub OAuth 연동
- Slack OAuth 연동
- GitHub Issue/PR 연결

## 시작하기

### 환경 변수 설정

`.env` 파일을 생성하고 다음 환경 변수를 설정하세요:

```env
# App
NODE_ENV=development
PORT=3000
APP_URL=http://localhost:3000
FRONTEND_URL=http://localhost:8080

# Database
DATABASE_URL="postgresql://user:password@host:5432/database"

# Redis (선택)
REDIS_URL=redis://localhost:6379

# JWT (운영 시 반드시 변경!)
JWT_SECRET=your-jwt-secret-key-32-characters
JWT_REFRESH_SECRET=your-jwt-refresh-key-32-characters
JWT_ACCESS_EXPIRATION=15m
JWT_REFRESH_EXPIRATION=7d

# Encryption (32자)
ENCRYPTION_KEY=your-encryption-key-32-characters

# GitHub OAuth (선택)
GITHUB_CLIENT_ID=your-github-client-id
GITHUB_CLIENT_SECRET=your-github-client-secret
GITHUB_CALLBACK_URL=http://localhost:3000/api/v1/integrations/github/callback

# Slack OAuth (선택)
SLACK_CLIENT_ID=your-slack-client-id
SLACK_CLIENT_SECRET=your-slack-client-secret
SLACK_CALLBACK_URL=http://localhost:3000/api/v1/integrations/slack/callback
```

### 설치 및 실행

```bash
# 의존성 설치
npm install

# 데이터베이스 마이그레이션
npx prisma db push

# 개발 서버 실행
npm run start:dev

# 빌드
npm run build

# 프로덕션 실행
npm run start:prod
```

API 서버는 [http://localhost:3000/api/v1](http://localhost:3000/api/v1)에서 실행됩니다.

## API 문서

Swagger API 문서: [http://localhost:3000/api/docs](http://localhost:3000/api/docs)

## 프로젝트 구조

```
src/
├── common/                 # 공통 모듈
│   ├── constants/         # 상수 정의
│   ├── decorators/        # 커스텀 데코레이터
│   ├── filters/           # 예외 필터
│   ├── guards/            # 인증/인가 가드
│   └── interceptors/      # 인터셉터
├── config/                # 설정 모듈
├── database/              # 데이터베이스 (Prisma)
├── modules/               # 기능 모듈
│   ├── admin/            # 관리자 기능
│   ├── audit/            # 감사 로그
│   ├── auth/             # 인증
│   ├── dashboard/        # 대시보드
│   ├── integrations/     # 외부 연동 (GitHub, Slack)
│   ├── network-whitelist/# 네트워크 화이트리스트
│   ├── notifications/    # 알림
│   ├── retrospectives/   # 회고록
│   ├── schedules/        # 일정
│   ├── tasks/            # 업무
│   ├── teams/            # 팀
│   └── users/            # 사용자
└── prisma/               # Prisma 스키마
```

## 배포

### Render

1. New Web Service 생성
2. GitHub 저장소 연결
3. 환경 변수 설정
4. Build Command: `npm install && npx prisma generate && npm run build`
5. Start Command: `npm run start:prod`

### 환경 변수 (Render)

- `DATABASE_URL`: PostgreSQL 연결 문자열
- `JWT_SECRET`, `JWT_REFRESH_SECRET`: JWT 시크릿 키
- `ENCRYPTION_KEY`: 암호화 키
- GitHub/Slack OAuth 설정 (선택)

## 라이선스

MIT

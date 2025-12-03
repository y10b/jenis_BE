import { PrismaClient, UserRole, UserStatus, TaskStatus, TaskPriority, RetroType, Visibility, ScheduleType, AttendanceType } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('🗑️  Deleting all existing data...');

  // 순서대로 삭제 (외래키 의존성 고려)
  await prisma.documentFavorite.deleteMany();
  await prisma.teamDocument.deleteMany();
  await prisma.attendance.deleteMany();
  await prisma.refreshToken.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.networkWhitelist.deleteMany();
  await prisma.teamShare.deleteMany();
  await prisma.teamSchedule.deleteMany();
  await prisma.schedule.deleteMany();
  await prisma.userIntegration.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.retrospectiveShare.deleteMany();
  await prisma.retrospective.deleteMany();
  await prisma.taskHistory.deleteMany();
  await prisma.taskComment.deleteMany();
  await prisma.taskRelation.deleteMany();
  await prisma.task.deleteMany();
  await prisma.user.updateMany({ data: { teamId: null } });
  await prisma.team.deleteMany();
  await prisma.user.deleteMany();

  console.log('✅ All data deleted');

  // 비밀번호 해싱
  const passwordHash = await bcrypt.hash('owner1234!', 10);
  const memberPasswordHash = await bcrypt.hash('member1234!', 10);

  console.log('👤 Creating Owner account...');

  // 1. OWNER 계정 생성
  const owner = await prisma.user.create({
    data: {
      email: 'owner@intalk.com',
      passwordHash,
      name: '대표',
      role: UserRole.OWNER,
      status: UserStatus.ACTIVE,
    },
  });

  console.log('✅ Owner created:', owner.email);

  // 2. 팀 생성
  console.log('🏢 Creating teams...');

  const frontendTeam = await prisma.team.create({
    data: {
      name: 'Frontend',
      description: '프론트엔드 개발팀',
      ownerId: owner.id,
    },
  });

  const backendTeam = await prisma.team.create({
    data: {
      name: 'Backend',
      description: '백엔드 개발팀',
      ownerId: owner.id,
    },
  });

  const designTeam = await prisma.team.create({
    data: {
      name: 'Design',
      description: '디자인팀',
      ownerId: owner.id,
    },
  });

  console.log('✅ Teams created');

  // 3. 팀 리드 및 멤버 생성
  console.log('👥 Creating team members...');

  const teamLead = await prisma.user.create({
    data: {
      email: 'teamlead@intalk.com',
      passwordHash: memberPasswordHash,
      name: '팀리드',
      role: UserRole.TEAM_LEAD,
      status: UserStatus.ACTIVE,
    },
  });

  // Frontend Team Members
  const frontendHead = await prisma.user.create({
    data: {
      email: 'frontend.head@intalk.com',
      passwordHash: memberPasswordHash,
      name: '프론트엔드 헤드',
      role: UserRole.HEAD,
      status: UserStatus.ACTIVE,
      teamId: frontendTeam.id,
    },
  });

  const frontendLead = await prisma.user.create({
    data: {
      email: 'frontend.lead@intalk.com',
      passwordHash: memberPasswordHash,
      name: '프론트엔드 리드',
      role: UserRole.LEAD,
      status: UserStatus.ACTIVE,
      teamId: frontendTeam.id,
    },
  });

  const frontendDev1 = await prisma.user.create({
    data: {
      email: 'frontend.dev1@intalk.com',
      passwordHash: memberPasswordHash,
      name: '프론트엔드 개발자1',
      role: UserRole.ACTOR,
      status: UserStatus.ACTIVE,
      teamId: frontendTeam.id,
    },
  });

  const frontendDev2 = await prisma.user.create({
    data: {
      email: 'frontend.dev2@intalk.com',
      passwordHash: memberPasswordHash,
      name: '프론트엔드 개발자2',
      role: UserRole.ACTOR,
      status: UserStatus.ACTIVE,
      teamId: frontendTeam.id,
    },
  });

  // Backend Team Members
  const backendHead = await prisma.user.create({
    data: {
      email: 'backend.head@intalk.com',
      passwordHash: memberPasswordHash,
      name: '백엔드 헤드',
      role: UserRole.HEAD,
      status: UserStatus.ACTIVE,
      teamId: backendTeam.id,
    },
  });

  const backendLead = await prisma.user.create({
    data: {
      email: 'backend.lead@intalk.com',
      passwordHash: memberPasswordHash,
      name: '백엔드 리드',
      role: UserRole.LEAD,
      status: UserStatus.ACTIVE,
      teamId: backendTeam.id,
    },
  });

  const backendDev1 = await prisma.user.create({
    data: {
      email: 'backend.dev1@intalk.com',
      passwordHash: memberPasswordHash,
      name: '백엔드 개발자1',
      role: UserRole.ACTOR,
      status: UserStatus.ACTIVE,
      teamId: backendTeam.id,
    },
  });

  // Design Team Members
  const designHead = await prisma.user.create({
    data: {
      email: 'design.head@intalk.com',
      passwordHash: memberPasswordHash,
      name: '디자인 헤드',
      role: UserRole.HEAD,
      status: UserStatus.ACTIVE,
      teamId: designTeam.id,
    },
  });

  const designer1 = await prisma.user.create({
    data: {
      email: 'designer1@intalk.com',
      passwordHash: memberPasswordHash,
      name: '디자이너1',
      role: UserRole.ACTOR,
      status: UserStatus.ACTIVE,
      teamId: designTeam.id,
    },
  });

  console.log('✅ Team members created');

  // 4. 업무(Task) 생성
  console.log('📋 Creating tasks...');

  // Frontend Tasks
  const task1 = await prisma.task.create({
    data: {
      title: '로그인 페이지 UI 개선',
      description: '로그인 페이지의 UI/UX를 개선합니다. 반응형 디자인 적용 및 애니메이션 추가',
      status: TaskStatus.IN_PROGRESS,
      priority: TaskPriority.P1,
      assigneeId: frontendDev1.id,
      creatorId: frontendHead.id,
      teamId: frontendTeam.id,
      dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    },
  });

  const task2 = await prisma.task.create({
    data: {
      title: '대시보드 차트 컴포넌트 개발',
      description: '대시보드에 표시할 차트 컴포넌트를 개발합니다. (Chart.js 활용)',
      status: TaskStatus.TODO,
      priority: TaskPriority.P2,
      assigneeId: frontendDev2.id,
      creatorId: frontendLead.id,
      teamId: frontendTeam.id,
      dueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
    },
  });

  const task3 = await prisma.task.create({
    data: {
      title: 'API 연동 리팩토링',
      description: 'React Query를 활용한 API 연동 코드 리팩토링',
      status: TaskStatus.DONE,
      priority: TaskPriority.P1,
      assigneeId: frontendLead.id,
      creatorId: frontendHead.id,
      teamId: frontendTeam.id,
      completedAt: new Date(),
    },
  });

  // Backend Tasks
  const task4 = await prisma.task.create({
    data: {
      title: '사용자 인증 API 보안 강화',
      description: 'JWT 토큰 관리 및 리프레시 토큰 로직 개선',
      status: TaskStatus.IN_PROGRESS,
      priority: TaskPriority.P0,
      assigneeId: backendLead.id,
      creatorId: backendHead.id,
      teamId: backendTeam.id,
      dueDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
    },
  });

  const task5 = await prisma.task.create({
    data: {
      title: '데이터베이스 쿼리 최적화',
      description: 'N+1 문제 해결 및 인덱스 최적화',
      status: TaskStatus.REVIEW,
      priority: TaskPriority.P1,
      assigneeId: backendDev1.id,
      creatorId: backendLead.id,
      teamId: backendTeam.id,
    },
  });

  const task6 = await prisma.task.create({
    data: {
      title: 'Redis 캐싱 구현',
      description: '자주 조회되는 데이터에 대한 Redis 캐싱 적용',
      status: TaskStatus.TODO,
      priority: TaskPriority.P2,
      assigneeId: backendDev1.id,
      creatorId: backendHead.id,
      teamId: backendTeam.id,
      dueDate: new Date(Date.now() + 21 * 24 * 60 * 60 * 1000),
    },
  });

  // Design Tasks
  const task7 = await prisma.task.create({
    data: {
      title: '새 랜딩 페이지 디자인',
      description: '회사 소개 랜딩 페이지 시안 작업',
      status: TaskStatus.IN_PROGRESS,
      priority: TaskPriority.P1,
      assigneeId: designer1.id,
      creatorId: designHead.id,
      teamId: designTeam.id,
      dueDate: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000),
    },
  });

  console.log('✅ Tasks created');

  // 5. 태스크 댓글 생성
  console.log('💬 Creating task comments...');

  await prisma.taskComment.createMany({
    data: [
      {
        taskId: task1.id,
        userId: frontendHead.id,
        content: '진행 상황 공유 부탁드립니다.',
      },
      {
        taskId: task1.id,
        userId: frontendDev1.id,
        content: '현재 70% 완료되었습니다. 내일까지 완료 예정입니다.',
      },
      {
        taskId: task4.id,
        userId: backendHead.id,
        content: '보안 검토 완료 후 배포 진행해주세요.',
      },
    ],
  });

  console.log('✅ Task comments created');

  // 6. 회고록 생성
  console.log('📝 Creating retrospectives...');

  await prisma.retrospective.createMany({
    data: [
      {
        userId: frontendDev1.id,
        type: RetroType.WEEKLY,
        title: '이번 주 회고',
        content: '## 잘한 점\n- 로그인 페이지 UI 개선 진행\n- 코드 리뷰 적극 참여\n\n## 개선할 점\n- 테스트 코드 작성 미흡\n\n## 다음 주 계획\n- 로그인 페이지 완료\n- 유닛 테스트 작성',
        periodStart: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
        periodEnd: new Date(),
        isDraft: false,
        visibility: Visibility.TEAM,
      },
      {
        userId: backendLead.id,
        type: RetroType.WEEKLY,
        title: '백엔드 팀 주간 회고',
        content: '## 이번 주 성과\n- 인증 API 보안 강화 작업 시작\n- DB 쿼리 최적화 PR 리뷰 중\n\n## 이슈\n- Redis 서버 설정 이슈 발생\n\n## 액션 아이템\n- Redis 클러스터 구성 검토',
        periodStart: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
        periodEnd: new Date(),
        isDraft: false,
        visibility: Visibility.TEAM,
      },
    ],
  });

  console.log('✅ Retrospectives created');

  // 7. 알림 생성
  console.log('🔔 Creating notifications...');

  await prisma.notification.createMany({
    data: [
      {
        userId: frontendDev1.id,
        type: 'TASK_ASSIGNED',
        title: '새 업무가 할당되었습니다',
        content: '"로그인 페이지 UI 개선" 업무가 할당되었습니다.',
        payload: { taskId: task1.id },
      },
      {
        userId: backendDev1.id,
        type: 'TASK_COMMENT',
        title: '새 댓글이 등록되었습니다',
        content: '업무에 새 댓글이 등록되었습니다.',
        payload: { taskId: task5.id },
      },
      {
        userId: owner.id,
        type: 'SYSTEM',
        title: '시스템 공지',
        content: '새로운 기능이 추가되었습니다.',
      },
    ],
  });

  console.log('✅ Notifications created');

  // 8. 스케줄 생성
  console.log('📅 Creating schedules...');

  const schedule1 = await prisma.schedule.create({
    data: {
      creatorId: owner.id,
      type: ScheduleType.MEETING,
      title: '전체 회의',
      description: '매주 월요일 전체 회의',
      cronExpression: '0 10 * * 1',
      isActive: true,
    },
  });

  await prisma.teamSchedule.createMany({
    data: [
      { scheduleId: schedule1.id, teamId: frontendTeam.id },
      { scheduleId: schedule1.id, teamId: backendTeam.id },
      { scheduleId: schedule1.id, teamId: designTeam.id },
    ],
  });

  const schedule2 = await prisma.schedule.create({
    data: {
      creatorId: frontendHead.id,
      type: ScheduleType.MEETING,
      title: '프론트엔드 스탠드업',
      description: '매일 오전 스탠드업 미팅',
      cronExpression: '0 9 * * 1-5',
      isActive: true,
    },
  });

  await prisma.teamSchedule.create({
    data: { scheduleId: schedule2.id, teamId: frontendTeam.id },
  });

  console.log('✅ Schedules created');

  // 9. 네트워크 화이트리스트 생성
  console.log('🌐 Creating network whitelist...');

  await prisma.networkWhitelist.createMany({
    data: [
      {
        cidr: '0.0.0.0/0',
        description: '모든 IP 허용 (개발용)',
        isEnabled: true,
        createdBy: owner.id,
      },
    ],
  });

  console.log('✅ Network whitelist created');

  // 10. 출퇴근 기록 생성
  console.log('⏰ Creating attendance records...');

  const today = new Date();
  today.setHours(9, 0, 0, 0);

  await prisma.attendance.createMany({
    data: [
      {
        userId: frontendDev1.id,
        type: AttendanceType.CHECK_IN,
        createdAt: today,
      },
      {
        userId: frontendDev2.id,
        type: AttendanceType.CHECK_IN,
        createdAt: today,
      },
      {
        userId: backendDev1.id,
        type: AttendanceType.CHECK_IN,
        createdAt: today,
      },
    ],
  });

  console.log('✅ Attendance records created');

  // 11. 팀 문서 생성
  console.log('📄 Creating team documents...');

  const doc1 = await prisma.teamDocument.create({
    data: {
      teamId: frontendTeam.id,
      creatorId: frontendHead.id,
      title: 'Frontend 환경변수',
      content: '# Frontend 환경변수\n\n## Development\nNEXT_PUBLIC_API_URL=http://localhost:4000\nNEXT_PUBLIC_WS_URL=ws://localhost:4000\n\n## Production\nNEXT_PUBLIC_API_URL=https://api.intalk.com\nNEXT_PUBLIC_WS_URL=wss://api.intalk.com\n\n## Vercel\nVERCEL_TOKEN=xxx\nPROJECT_ID=prj_xxx',
      tags: ['ENV', '설정'],
    },
  });

  const doc2 = await prisma.teamDocument.create({
    data: {
      teamId: backendTeam.id,
      creatorId: backendHead.id,
      title: 'Backend 환경변수',
      content: '# Backend 환경변수\n\n## Database\nDATABASE_URL=postgresql://user:pass@localhost:5432/db\n\n## JWT\nJWT_SECRET=your-secret-key\nJWT_EXPIRES_IN=15m\nJWT_REFRESH_EXPIRES_IN=7d\n\n## Redis\nREDIS_URL=redis://localhost:6379\n\n## External APIs\nGITHUB_CLIENT_ID=xxx\nGITHUB_CLIENT_SECRET=xxx',
      tags: ['ENV', '설정', 'API'],
    },
  });

  const doc3 = await prisma.teamDocument.create({
    data: {
      teamId: backendTeam.id,
      creatorId: backendLead.id,
      title: 'DB 접속 정보',
      content: '# Database 접속 정보\n\n## Development DB\nHost: localhost\nPort: 5432\nDatabase: backoffice_dev\nUser: dev_user\nPassword: dev_pass_123\n\n## Production DB (READ-ONLY)\nHost: db.intalk.com\nPort: 5432\nDatabase: backoffice_prod\nUser: readonly_user\nPassword: readonly_pass_456\n\n⚠️ 프로덕션 DB는 읽기 전용 계정만 사용하세요!',
      tags: ['DB', '계정정보', '비밀번호'],
    },
  });

  const doc4 = await prisma.teamDocument.create({
    data: {
      teamId: frontendTeam.id,
      creatorId: frontendLead.id,
      title: '프론트엔드 개발 가이드',
      content: '# Frontend 개발 가이드\n\n## 기술 스택\n- Next.js 14 (App Router)\n- TypeScript\n- Tailwind CSS\n- shadcn/ui\n- React Query\n\n## 폴더 구조\nsrc/\n├── app/          # 페이지 라우팅\n├── components/   # 컴포넌트\n├── hooks/        # 커스텀 훅\n├── services/     # API 서비스\n├── stores/       # 상태 관리\n├── types/        # 타입 정의\n└── lib/          # 유틸리티\n\n## 컨벤션\n- 컴포넌트: PascalCase\n- 함수/변수: camelCase\n- 상수: UPPER_SNAKE_CASE',
      tags: ['가이드', '설정'],
    },
  });

  const doc5 = await prisma.teamDocument.create({
    data: {
      teamId: designTeam.id,
      creatorId: designHead.id,
      title: 'Figma 접속 정보',
      content: '# Figma 접속 정보\n\n## Team Workspace\nURL: https://figma.com/team/intalk\nTeam: InTalk Design\n\n## 프로젝트별 링크\n- Backoffice: https://figma.com/file/xxx\n- Landing Page: https://figma.com/file/yyy\n- Mobile App: https://figma.com/file/zzz\n\n## 계정\nEmail: design@intalk.com\nPassword: figma_design_2024!',
      tags: ['계정정보', '비밀번호'],
    },
  });

  // 즐겨찾기 추가
  await prisma.documentFavorite.createMany({
    data: [
      { documentId: doc1.id, userId: frontendDev1.id },
      { documentId: doc1.id, userId: frontendDev2.id },
      { documentId: doc2.id, userId: backendDev1.id },
      { documentId: doc3.id, userId: backendLead.id },
    ],
  });

  console.log('✅ Team documents created');

  // 12. 팀 공유 설정
  console.log('🔗 Creating team shares...');

  await prisma.teamShare.create({
    data: {
      fromTeamId: frontendTeam.id,
      toTeamId: backendTeam.id,
      shareTasks: true,
      shareSchedules: true,
    },
  });

  console.log('✅ Team shares created');

  console.log('\n🎉 Seed completed successfully!\n');
  console.log('==================================================');
  console.log('📧 Owner Account:');
  console.log('   Email: owner@intalk.com');
  console.log('   Password: owner1234!');
  console.log('');
  console.log('📧 Team Lead Account:');
  console.log('   Email: teamlead@intalk.com');
  console.log('   Password: member1234!');
  console.log('');
  console.log('📧 Other accounts password: member1234!');
  console.log('==================================================');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

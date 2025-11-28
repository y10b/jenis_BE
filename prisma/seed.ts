import { PrismaClient, UserRole, UserStatus } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // Create default team
  const defaultTeam = await prisma.team.upsert({
    where: { id: 'default-team-id' },
    update: {},
    create: {
      id: 'default-team-id',
      name: 'Core Team',
      description: '핵심 팀',
      ownerId: 'owner-user-id',
    },
  });

  console.log('Created default team:', defaultTeam.name);

  // Create owner user
  const ownerPassword = await bcrypt.hash('Owner123!', 10);
  const owner = await prisma.user.upsert({
    where: { email: 'owner@company.com' },
    update: {},
    create: {
      id: 'owner-user-id',
      email: 'owner@company.com',
      passwordHash: ownerPassword,
      name: '대표',
      role: UserRole.OWNER,
      status: UserStatus.ACTIVE,
      teamId: defaultTeam.id,
    },
  });

  console.log('Created owner user:', owner.email);

  // Update team owner
  await prisma.team.update({
    where: { id: defaultTeam.id },
    data: { ownerId: owner.id },
  });

  // Create sample users
  const sampleUsers = [
    {
      email: 'head@company.com',
      name: '헤드',
      role: UserRole.HEAD,
      status: UserStatus.ACTIVE,
    },
    {
      email: 'lead@company.com',
      name: '리드',
      role: UserRole.LEAD,
      status: UserStatus.ACTIVE,
    },
    {
      email: 'actor@company.com',
      name: '구성원',
      role: UserRole.ACTOR,
      status: UserStatus.ACTIVE,
    },
    {
      email: 'pending@company.com',
      name: '대기자',
      role: UserRole.ACTOR,
      status: UserStatus.PENDING,
    },
  ];

  for (const userData of sampleUsers) {
    const password = await bcrypt.hash('Test123!', 10);
    const user = await prisma.user.upsert({
      where: { email: userData.email },
      update: {},
      create: {
        email: userData.email,
        passwordHash: password,
        name: userData.name,
        role: userData.role,
        status: userData.status,
        teamId: userData.status === UserStatus.ACTIVE ? defaultTeam.id : null,
      },
    });
    console.log('Created user:', user.email);
  }

  console.log('Seeding completed!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

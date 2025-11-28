import { UserRole, UserStatus } from '@prisma/client';

export interface RequestUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  status: UserStatus;
  teamId: string | null;
}

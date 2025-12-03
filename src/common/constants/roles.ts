import { UserRole } from '@prisma/client';

export const ROLES_KEY = 'roles';

export const RoleHierarchy: Record<UserRole, number> = {
  [UserRole.OWNER]: 5,
  [UserRole.TEAM_LEAD]: 4,
  [UserRole.HEAD]: 3,
  [UserRole.LEAD]: 2,
  [UserRole.ACTOR]: 1,
};

export const hasHigherOrEqualRole = (
  userRole: UserRole,
  requiredRole: UserRole,
): boolean => {
  return RoleHierarchy[userRole] >= RoleHierarchy[requiredRole];
};

// TEAM_LEAD와 OWNER는 모든 팀의 문서를 볼 수 있음
export const canAccessAllTeams = (role: UserRole): boolean => {
  return role === UserRole.OWNER || role === UserRole.TEAM_LEAD;
};

import { UserRole } from '@prisma/client';

export const ROLES_KEY = 'roles';

export const RoleHierarchy: Record<UserRole, number> = {
  [UserRole.OWNER]: 4,
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

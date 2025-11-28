import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from '@prisma/client';
import { ROLES_KEY, hasHigherOrEqualRole } from '../constants/roles';
import { ErrorCodes } from '../constants/error-codes';
import { RequestUser } from '../interfaces/request-user.interface';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user as RequestUser;

    if (!user) {
      throw new ForbiddenException(ErrorCodes.FORBIDDEN);
    }

    // Check if user has any of the required roles or higher
    const hasRequiredRole = requiredRoles.some((role) =>
      hasHigherOrEqualRole(user.role, role),
    );

    if (!hasRequiredRole) {
      throw new ForbiddenException(ErrorCodes.FORBIDDEN);
    }

    return true;
  }
}

import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { Role } from '../constants/roles.constant';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) { }

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<(Role | string)[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const { user } = context.switchToHttp().getRequest();
    if (!user || !user.role) {
      throw new ForbiddenException(
        "Access Restricted: You don't have permission to perform this action.",
      );
    }

    const isSuperAdmin =
      user.role === 'super_admin' ||
      user.role?.toLowerCase() === 'super_admin' ||
      user.role === (Role as any).SUPER_ADMIN;

    const hasRole =
      isSuperAdmin ||
      requiredRoles.includes(user.role) ||
      requiredRoles.includes(user.role.toLowerCase());

    if (!hasRole) {
      throw new ForbiddenException(
        "Access Restricted: You don't have permission to perform this action.",
      );
    }

    return true;
  }
}

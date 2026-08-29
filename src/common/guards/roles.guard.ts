import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { Role } from '../constants/roles.constant';

@Injectable()
export class RolesGuard implements CanActivate {
  private readonly logger = new Logger(RolesGuard.name);

  constructor(private reflector: Reflector) { }

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<(Role | string)[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user || !user.role) {
      this.logger.warn(
        `Access Denied on ${request.url}: Request user payload or user role is missing.`,
      );
      throw new ForbiddenException(
        "Access Restricted: You don't have permission to perform this action.",
      );
    }

    const userRoleStr = String(user.role).toLowerCase().trim();

    // 1. Super Admin and Admin have universal master permissions across all endpoints
    if (
      userRoleStr === (Role as any).SUPER_ADMIN ||
      userRoleStr === (Role as any).ADMIN
    ) {
      return true;
    }

    // 2. Case-insensitive check against required roles
    const normalizedRequiredRoles = requiredRoles.map((r) =>
      String(r).toLowerCase().trim(),
    );

    const hasRole = normalizedRequiredRoles.includes(userRoleStr);

    if (!hasRole) {
      this.logger.warn(
        `Access Denied on ${request.url} for user ID ${user.id} (${user.email}) with role '${user.role}'. Required roles: [${normalizedRequiredRoles.join(', ')}]`,
      );
      throw new ForbiddenException(
        "Access Restricted: You don't have permission to perform this action.",
      );
    }

    return true;
  }
}

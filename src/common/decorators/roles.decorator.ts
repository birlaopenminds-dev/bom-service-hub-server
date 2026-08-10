import { SetMetadata } from '@nestjs/common';
import { Role } from '../constants/roles.constant';

export const ROLES_KEY = 'roles';
export const Roles = (...roles: (Role | string)[]) => SetMetadata(ROLES_KEY, roles);

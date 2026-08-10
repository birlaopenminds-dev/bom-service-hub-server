import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../providers/database/prisma.service';
import { MailService } from '../mail/mail.service';
import { AuditService } from '../audit/audit.service';
import { EncryptionUtil } from '../../common/utils/encryption.util';
import { ValidatorsUtil } from '../../common/utils/validators.util';
import { PaginationUtil } from '../../common/utils/pagination.util';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { ListUsersDto } from './dto/list-users.dto';
import { ResetUserPasswordDto, AdminResetUserPasswordDto } from './dto/reset-password.dto';
import { Prisma, Role } from '@prisma/client';
import { IUserPayload } from '../../common/interfaces/request.interface';

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    private prisma: PrismaService,
    private mailService: MailService,
    private auditService: AuditService,
  ) { }


  //  Check if a role string or enum is Admin or Super Admin
  private isAdminOrSuperAdmin(role: string): boolean {
    if (!role) return false;
    const normalized = role.toLowerCase();
    return (
      normalized === 'admin' ||
      normalized === 'super_admin' ||
      normalized === Role.admin ||
      normalized === (Role as any).super_admin
    );
  }

  // Helper to verify target user existence and enforce role/manager/HOD hierarchy access controls.
  private async getTargetUserAndCheckAccess(
    targetUserId: number,
    currentUser: IUserPayload,
    action: 'view' | 'update' | 'reset-password' | 'deactivate',
  ) {
    const targetUser = await this.prisma.user.findUnique({
      where: { id: targetUserId },
      select: {
        ...this.getUserSelectFields(),
        reporting_manager: { select: { id: true, name: true, email: true } },
        hod: { select: { id: true, name: true, email: true } },
      },
    });

    if (!targetUser) {
      throw new NotFoundException(`User with ID ${targetUserId} not found.`);
    }

    // 1. Super Admin and Admin have universal access
    if (this.isAdminOrSuperAdmin(currentUser.role)) {
      return targetUser;
    }

    const currentUserId = currentUser.id;

    // 2. Self-access checks
    if (currentUserId === targetUserId) {
      if (action === 'view' || action === 'update') {
        return targetUser;
      }
      throw new ForbiddenException(
        "Access Restricted: You don't have permission to perform this action.",
      );
    }

    // 3. Check if requester is reporting manager or HOD of target user
    const isManagerOrHod =
      targetUser.reporting_manager_id === currentUserId ||
      targetUser.hod_id === currentUserId;

    if (!isManagerOrHod) {
      throw new ForbiddenException(
        "Access Restricted: You don't have permission to perform this action.",
      );
    }

    return targetUser;
  }

  // Create new user account (Super Admin, Admin & Manager)
  async create(createUserDto: CreateUserDto, currentUser?: IUserPayload | number) {
    const currentUserId = typeof currentUser === 'number' ? currentUser : currentUser?.id;

    const existing = await this.prisma.user.findUnique({
      where: { email: createUserDto.email },
    });

    if (existing) {
      throw new ConflictException('A user with this email address already exists.');
    }

    if (!ValidatorsUtil.isStrongPassword(createUserDto.password)) {
      throw new BadRequestException(
        'Password must be at least 8 characters long and include uppercase, lowercase, number, and special character.',
      );
    }

    const password_hash = await EncryptionUtil.hashPassword(createUserDto.password);

    const user = await this.prisma.user.create({
      data: {
        name: createUserDto.name,
        email: createUserDto.email,
        mobile: createUserDto.mobile,
        password_hash,
        password_changed: false,
        role: createUserDto.role,
        department_id: createUserDto.department_id || null,
        reporting_manager_id: createUserDto.reporting_manager_id || null,
        hod_id: createUserDto.hod_id || null,
        is_active: true,
      },
      select: this.getUserSelectFields(),
    });

    // Audit log
    if (currentUserId) {
      await this.auditService.log({
        userId: currentUserId,
        action: 'CREATE_USER',
        resource: 'users',
        resourceId: user.id,
        newValues: { email: user.email, role: user.role },
      });
    }

    // Send Welcome Email asynchronously in background (non-blocking for fast HTTP response)
    this.mailService
      .sendMail({
        to: user.email,
        subject: 'Welcome to BOM ServiceHub',
        template: 'user-creation',
        context: {
          name: user.name,
          email: user.email,
          role: user.role,
        },
      })
      .catch((err) =>
        this.logger.error(`Failed to send welcome email: ${err.message}`),
      );

    return user;
  }

  // Get all users (Super Admin/Admin: All users, Manager/HOD: Subordinates only)
  async findAll(query: ListUsersDto, currentUser?: IUserPayload) {
    let page = Math.max(1, query.page || 1);
    const limit = Math.min(100, query.limit || 10);

    const filters: Prisma.UserWhereInput[] = [];

    // Filter by hierarchy: If not Super Admin or Admin, restrict to users working under currentUser (as Manager or HOD)
    if (currentUser && !this.isAdminOrSuperAdmin(currentUser.role)) {
      filters.push({
        OR: [
          { reporting_manager_id: currentUser.id },
          { hod_id: currentUser.id },
        ],
      });
    }

    const searchTerm = query.search?.trim();
    if (searchTerm) {
      filters.push({
        OR: [
          { name: { contains: searchTerm, mode: 'insensitive' } },
          { email: { contains: searchTerm, mode: 'insensitive' } },
          { mobile: { contains: searchTerm, mode: 'insensitive' } },
        ],
      });
    }

    if (query.role) {
      filters.push({ role: query.role });
    }

    if (query.department_id) {
      filters.push({ department_id: query.department_id });
    }

    if (query.is_active !== undefined) {
      filters.push({ is_active: query.is_active });
    }

    const where: Prisma.UserWhereInput = filters.length > 0 ? { AND: filters } : {};

    // Get total count of matching records for this filter set
    const total = await this.prisma.user.count({ where });

    // Calculate max pages for this filtered result
    const maxPages = Math.ceil(total / limit) || 1;

    // Graceful fallback: If current page > maxPages (e.g. user was on Page 10 when searching), reset to Page 1
    if (page > maxPages) {
      page = 1;
    }

    const skip = (page - 1) * limit;

    const users = await this.prisma.user.findMany({
      where,
      skip,
      take: limit,
      orderBy: { created_at: 'desc' },
      select: this.getUserSelectFields(),
    });

    return PaginationUtil.buildPaginatedResult(users, total, page, limit);
  }

  async getDropdown(departmentId?: number, role?: Role, isActive = true) {
    const where: Prisma.UserWhereInput = {};
    if (departmentId) {
      where.department_id = departmentId;
    }
    if (role) {
      where.role = role;
    }
    if (isActive !== undefined) {
      where.is_active = isActive;
    }

    const users = await this.prisma.user.findMany({
      where,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        department_id: true,
        is_active: true,
        department: { select: { id: true, name: true } },
      },
      orderBy: { name: 'asc' },
    });

    return { data: users };
  }


  // Get user by ID (Super Admin/Admin, Manager/HOD, or Self)
  async findOne(id: number, currentUser?: IUserPayload) {

    if (currentUser) {
      return this.getTargetUserAndCheckAccess(id, currentUser, 'view');
    }

    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        ...this.getUserSelectFields(),
        reporting_manager: { select: { id: true, name: true, email: true } },
        hod: { select: { id: true, name: true, email: true } },
      },
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found.`);
    }

    return user;
  }

  // Update user details (Super Admin/Admin, Manager/HOD of target user, or Self)
  async update(id: number, updateUserDto: UpdateUserDto, currentUser?: IUserPayload) {
    let existing;
    if (currentUser) {
      existing = await this.getTargetUserAndCheckAccess(id, currentUser, 'update');
    } else {
      existing = await this.findOne(id);
    }

    if (updateUserDto.email && updateUserDto.email !== existing.email) {
      const emailTaken = await this.prisma.user.findUnique({
        where: { email: updateUserDto.email },
      });

      if (emailTaken) throw new ConflictException('Email address is already in use.');
    }

    const updated = await this.prisma.user.update({
      where: { id },
      data: {
        ...(updateUserDto.name && { name: updateUserDto.name }),
        ...(updateUserDto.email && { email: updateUserDto.email }),
        ...(updateUserDto.mobile !== undefined && { mobile: updateUserDto.mobile }),
        ...(updateUserDto.role && { role: updateUserDto.role }),
        ...(updateUserDto.department_id !== undefined && {
          department_id: updateUserDto.department_id,
        }),
        ...(updateUserDto.reporting_manager_id !== undefined && {
          reporting_manager_id: updateUserDto.reporting_manager_id,
        }),
        ...(updateUserDto.hod_id !== undefined && {
          hod_id: updateUserDto.hod_id,
        }),
        ...(updateUserDto.is_active !== undefined && {
          is_active: updateUserDto.is_active,
        }),
      },
      select: this.getUserSelectFields(),
    });

    const currentUserId = currentUser?.id;
    if (currentUserId) {
      await this.auditService.log({
        userId: currentUserId,
        action: 'UPDATE_USER',
        resource: 'users',
        resourceId: id,
        oldValues: existing,
        newValues: updated,
      });
    }

    return updated;
  }

  // Reset user password (Super Admin, Admin, and Manager/HOD of target user)
  async resetPassword(
    userId: number,
    dto: ResetUserPasswordDto | AdminResetUserPasswordDto,
    currentUser: IUserPayload,
  ) {
    const targetUser = await this.getTargetUserAndCheckAccess(userId, currentUser, 'reset-password');

    if (!ValidatorsUtil.isStrongPassword(dto.newPassword)) {
      throw new BadRequestException(
        'Password must be at least 8 characters long and include uppercase, lowercase, number, and special character.',
      );
    }

    const password_hash = await EncryptionUtil.hashPassword(dto.newPassword);

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        password_hash,
        password_changed: false,
      },
    });

    await this.auditService.log({
      userId: currentUser.id,
      action: 'RESET_USER_PASSWORD',
      resource: 'users',
      resourceId: userId,
    });

    return { message: `Password reset successfully for user ${targetUser.email}` };
  }

  // Alias for backward compatibility with existing callers
  async adminResetPassword(
    userId: number,
    dto: ResetUserPasswordDto,
    currentUser: IUserPayload | number,
  ) {
    const userPayload: IUserPayload =
      typeof currentUser === 'number'
        ? { id: currentUser, email: '', role: Role.admin }
        : currentUser;

    return this.resetPassword(userId, dto, userPayload);
  }

  // Deactivate user account (Super Admin, Admin, and Manager/HOD of target user)
  async remove(id: number, currentUser: IUserPayload | number) {
    let currentUserId: number;
    if (typeof currentUser === 'number') {
      currentUserId = currentUser;
      await this.findOne(id);
    } else {
      currentUserId = currentUser.id;
      await this.getTargetUserAndCheckAccess(id, currentUser, 'deactivate');
    }

    if (currentUserId === id) {
      throw new BadRequestException('You cannot deactivate your own user account.');
    }

    // Soft delete by deactivating user
    const updated = await this.prisma.user.update({
      where: { id },
      data: { is_active: false },
      select: this.getUserSelectFields(),
    });

    await this.auditService.log({
      userId: currentUserId,
      action: 'DEACTIVATE_USER',
      resource: 'users',
      resourceId: id,
    });

    return { message: 'User deactivated successfully.', user: updated };
  }

  // Toggle user active status (true <-> false)
  async toggleStatus(id: number, currentUser: IUserPayload | number) {
    let currentUserId: number;
    let targetUser;

    if (typeof currentUser === 'number') {
      currentUserId = currentUser;
      targetUser = await this.findOne(id);
    } else {
      currentUserId = currentUser.id;
      targetUser = await this.getTargetUserAndCheckAccess(id, currentUser, 'deactivate');
    }

    if (currentUserId === id) {
      throw new BadRequestException('You cannot change your own active status.');
    }

    const newActiveState = !targetUser.is_active;

    const updated = await this.prisma.user.update({
      where: { id },
      data: { is_active: newActiveState },
      select: this.getUserSelectFields(),
    });

    await this.auditService.log({
      userId: currentUserId,
      action: newActiveState ? 'ACTIVATE_USER' : 'DEACTIVATE_USER',
      resource: 'users',
      resourceId: id,
      newValues: { is_active: newActiveState },
    });

    const statusLabel = newActiveState ? 'activated' : 'deactivated';
    return {
      message: `User account has been ${statusLabel} successfully.`,
      is_active: newActiveState,
      user: updated,
    };
  }

  private getUserSelectFields() {
    return {
      id: true,
      name: true,
      email: true,
      mobile: true,
      role: true,
      department_id: true,
      reporting_manager_id: true,
      hod_id: true,
      is_active: true,
      password_changed: true,
      created_at: true,
      department: { select: { id: true, name: true } },
    };
  }
}

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
import * as ExcelJS from 'exceljs';
import { Prisma, Role } from '@prisma/client';
import { IUserPayload } from '../../common/interfaces/request.interface';
import { Response } from 'express';
import { UsersExporter } from './export/users.exporter';

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
    const normalized = String(role).toLowerCase().trim();
    return (
      normalized === 'admin' ||
      normalized === 'super_admin' ||
      normalized === 'superadmin' ||
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

    // Send Welcome Email asynchronously in background with default password
    // this.mailService
    //   .sendMail({
    //     to: user.email,
    //     subject: 'Welcome to BOM ServiceHub',
    //     template: 'user-creation',
    //     context: {
    //       name: user.name,
    //       email: user.email,
    //       role: user.role,
    //       password: createUserDto.password,
    //     },
    //   })
    //   .catch((err) =>
    //     this.logger.error(`Failed to send welcome email: ${err.message}`),
    //   );

    return user;
  }

  // Get all users (Supports search, role, department_id, and active status filters)
  async findAll(query: ListUsersDto, currentUser?: IUserPayload) {
    let page = Math.max(1, query.page || 1);
    const limit = Math.min(100, query.limit || 10);

    const filters: Prisma.UserWhereInput[] = [];

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

    if (query.role && (query.role as string) !== 'ALL' && (query.role as string) !== 'all') {
      filters.push({ role: query.role });
    }

    if (query.department_id && !isNaN(Number(query.department_id))) {
      filters.push({ department_id: Number(query.department_id) });
    }

    if (query.is_active !== undefined && (query.is_active as any) !== 'ALL' && (query.is_active as any) !== 'all') {
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

    console.log("users =====>>",users)

    return PaginationUtil.buildPaginatedResult(users, total, page, limit);
  }

  async getDropdown(
    currentUser?: IUserPayload,
    departmentId?: number,
    role?: Role,
    isActive?: boolean,
  ) {
    const filters: Prisma.UserWhereInput[] = [];

    // Default to active users if isActive is not explicitly provided
    const activeFilter = isActive !== undefined ? isActive : true;
    filters.push({ is_active: activeFilter });

    if (role && (role as string) !== 'ALL') {
      const normalizedRole = (role as string).toLowerCase().trim() as Role;
      filters.push({ role: normalizedRole });
    } else {
      filters.push({
        role: {
          notIn: [Role.admin, Role.super_admin],
        },
      });
    }

    if (departmentId && !isNaN(departmentId)) {
      filters.push({ department_id: departmentId });
    } else if (currentUser && !this.isAdminOrSuperAdmin(currentUser.role)) {
      const roleStr = String(currentUser.role).toLowerCase().trim();

      if (roleStr === 'hod') {
        const hodConditions: Prisma.UserWhereInput[] = [
          { id: currentUser.id },
          { hod_id: currentUser.id },
          { reporting_manager_id: currentUser.id },
        ];
        if (currentUser.department_id) {
          hodConditions.push({ department_id: currentUser.department_id });
        }
        filters.push({ OR: hodConditions });
      } else if (roleStr === 'manager') {
        // RM (Reporting Manager)
        const rmConditions: Prisma.UserWhereInput[] = [
          { id: currentUser.id },
          { reporting_manager_id: currentUser.id },
          { hod_id: currentUser.id },
        ];
        if (currentUser.department_id) {
          rmConditions.push({ department_id: currentUser.department_id });
        }
        filters.push({ OR: rmConditions });
      } else {
        const userConditions: Prisma.UserWhereInput[] = [
          { id: currentUser.id },
        ];
        if (currentUser.department_id) {
          userConditions.push({ department_id: currentUser.department_id });
        }
        filters.push({ OR: userConditions });
      }
    }

    const where: Prisma.UserWhereInput =
      filters.length > 0 ? { AND: filters } : {};

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

  // Toggle user active status (true <-> false) or set explicit status
  async toggleStatus(
    id: number,
    currentUser: IUserPayload | number,
    explicitIsActive?: boolean,
  ) {
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

    const newActiveState =
      explicitIsActive !== undefined ? Boolean(explicitIsActive) : !targetUser.is_active;

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

  // Bulk import users from uploaded Excel file (.xlsx or .xls)
  async importUsersFromExcel(
    file: Express.Multer.File,
    currentUser?: IUserPayload,
  ) {
    if (!file || !file.buffer) {
      throw new BadRequestException('Please upload a valid Excel file (.xlsx or .xls).');
    }

    const workbook = new ExcelJS.Workbook();
    try {
      await workbook.xlsx.load(file.buffer as any);
    } catch (err: any) {
      throw new BadRequestException(`Failed to parse Excel file: ${err.message}`);
    }

    const worksheet = workbook.worksheets[0];
    if (!worksheet) {
      throw new BadRequestException('Uploaded Excel file contains no worksheets.');
    }

    const createdUsers: any[] = [];
    const errors: { row: number; email?: string; name?: string; reason: string }[] = [];
    let totalRows = 0;
    let successCount = 0;
    let failureCount = 0;

    const getCellValue = (row: ExcelJS.Row, colIndex: number): string => {
      const cell = row.getCell(colIndex);
      if (!cell || cell.value === null || cell.value === undefined) return '';
      if (typeof cell.value === 'object') {
        if ('text' in cell.value && cell.value.text) return String(cell.value.text).trim();
        if ('result' in cell.value && cell.value.result) return String(cell.value.result).trim();
        if ('richText' in cell.value && Array.isArray((cell.value as any).richText)) {
          return (cell.value as any).richText.map((rt: any) => rt.text).join('').trim();
        }
      }
      return String(cell.value).trim();
    };

    const rowCount = worksheet.rowCount;

    for (let rowNum = 2; rowNum <= rowCount; rowNum++) {
      const row = worksheet.getRow(rowNum);

      const name = getCellValue(row, 1);
      const email = getCellValue(row, 2).toLowerCase();
      const password = getCellValue(row, 3);
      const mobile = getCellValue(row, 4);
      const roleStr = getCellValue(row, 5).toLowerCase();
      const departmentName = getCellValue(row, 6);
      const reportingManagerEmail = getCellValue(row, 7).toLowerCase();
      const hodEmail = getCellValue(row, 8).toLowerCase();

      // Skip empty row
      if (!name && !email) {
        continue;
      }

      totalRows++;

      // Row Validation
      if (!name) {
        failureCount++;
        errors.push({ row: rowNum, email, name, reason: 'Full Name is required.' });
        continue;
      }

      if (!email || !ValidatorsUtil.isValidEmail(email)) {
        failureCount++;
        errors.push({ row: rowNum, email, name, reason: 'Valid Email Address is required.' });
        continue;
      }

      // Check duplicate email in DB
      const existingUser = await this.prisma.user.findUnique({
        where: { email },
      });

      if (existingUser) {
        failureCount++;
        errors.push({
          row: rowNum,
          email,
          name,
          reason: `User with email "${email}" already exists in the system.`,
        });
        continue;
      }

      // Role Mapping
      let mappedRole: Role = Role.user;
      if (roleStr === 'admin') mappedRole = Role.admin;
      else if (roleStr === 'manager') mappedRole = Role.manager;
      else if (roleStr === 'hod') mappedRole = Role.hod;
      else if (roleStr === 'super_admin' || roleStr === 'super admin') {
        mappedRole = (Role as any).super_admin || Role.admin;
      } else {
        mappedRole = Role.user;
      }

      // Password Hashing
      const rawPassword = password || 'Welcome@123';
      const password_hash = await EncryptionUtil.hashPassword(rawPassword);

      // Lookup Department
      let department_id: number | null = null;
      if (departmentName) {
        let dept = await this.prisma.department.findFirst({
          where: { name: { equals: departmentName, mode: 'insensitive' } },
        });

        if (!dept) {
          dept = await this.prisma.department.create({
            data: { name: departmentName },
          });
        }
        department_id = dept.id;
      }

      // Lookup Reporting Manager
      let reporting_manager_id: number | null = null;
      if (reportingManagerEmail) {
        const mgr = await this.prisma.user.findUnique({
          where: { email: reportingManagerEmail },
        });
        if (mgr) {
          reporting_manager_id = mgr.id;
        }
      }

      // Lookup HOD
      let hod_id: number | null = null;
      if (hodEmail) {
        const hodUser = await this.prisma.user.findUnique({
          where: { email: hodEmail },
        });
        if (hodUser) {
          hod_id = hodUser.id;
        }
      }

      try {
        const createdUser = await this.prisma.user.create({
          data: {
            name,
            email,
            mobile: mobile || null,
            password_hash,
            role: mappedRole,
            department_id,
            reporting_manager_id,
            hod_id,
            is_active: true,
          },
          select: this.getUserSelectFields(),
        });

        successCount++;
        createdUsers.push(createdUser);
      } catch (err: any) {
        failureCount++;
        errors.push({
          row: rowNum,
          email,
          name,
          reason: `Database error creating user: ${err.message}`,
        });
      }
    }

    return {
      statusCode: 200,
      message: `User import processed: ${successCount} created, ${failureCount} failed out of ${totalRows} total rows.`,
      summary: {
        totalRows,
        successCount,
        failureCount,
        createdUsers,
        errors,
      },
    };
  }

  // Export users list to Excel spreadsheet stream download
  async exportUsersToExcel(
    query: ListUsersDto,
    currentUser: IUserPayload,
    res: Response,
  ) {
    const where: Prisma.UserWhereInput = {};

    if (query?.search) {
      const search = query.search.trim();
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { mobile: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (query?.role) {
      where.role = query.role;
    }

    if (query?.department_id) {
      where.department_id = Number(query.department_id);
    }

    if (query?.is_active !== undefined && (query.is_active as any) !== 'ALL' && query.is_active !== null) {
      where.is_active =
        typeof query.is_active === 'boolean'
          ? query.is_active
          : String(query.is_active).toLowerCase() === 'true';
    }

    const users = await this.prisma.user.findMany({
      where,
      orderBy: { created_at: 'desc' },
      select: {
        id: true,
        name: true,
        email: true,
        mobile: true,
        role: true,
        is_active: true,
        created_at: true,
        department: { select: { id: true, name: true } },
        reporting_manager: { select: { id: true, name: true, email: true } },
        hod: { select: { id: true, name: true, email: true } },
      },
    });

    return UsersExporter.exportToExcel(users, res);
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
      assigned_subcategories: {
        select: {
          id: true,
          name: true,
          tat_hours: true,
          is_active: true,
          category: { select: { id: true, name: true } },
        },
      },
    };
  }
}

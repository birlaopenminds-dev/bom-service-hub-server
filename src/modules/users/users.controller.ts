import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  UseGuards,
  HttpStatus,
  HttpCode,
  ParseIntPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiResponse,
  ApiParam,
} from '@nestjs/swagger';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { ListUsersDto } from './dto/list-users.dto';
import { ResetUserPasswordDto } from './dto/reset-password.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { GetUser } from '../../common/decorators/get-user.decorator';
import { IUserPayload } from '../../common/interfaces/request.interface';
import { Role } from '@prisma/client';

@ApiTags('Users')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller({ path: 'users', version: '1' })
export class UsersController {
  constructor(private readonly usersService: UsersService) { }

  // Create User Account (Super Admin, Admin & Manager)
  @Post()
  @Roles(Role.admin, Role.manager, Role.hod, (Role as any).super_admin || 'super_admin')
  @ApiOperation({
    summary: 'Create new user account (Super Admin, Admin & Manager)',
    description:
      'Creates a new user profile. Accessible by Super Admin, Admin, and Manager accounts. Allows assigning reporting manager and HOD.',
  })
  @ApiResponse({ status: 201, description: 'User account created successfully' })
  @ApiResponse({ status: 400, description: 'Validation failed or weak password' })
  @ApiResponse({ status: 401, description: 'Unauthorized token or session revoked' })
  @ApiResponse({ status: 403, description: 'Forbidden: Insufficient permissions' })
  @ApiResponse({ status: 409, description: 'Email address already in use' })
  async create(
    @Body() createUserDto: CreateUserDto,
    @GetUser() currentUser: IUserPayload,
  ) {
    return this.usersService.create(createUserDto, currentUser);
  }


  // Get Users (Super Admin/Admin: All users; Manager/HOD: Subordinates only)
  @Get()
  @Roles(
    Role.admin,
    Role.manager,
    Role.hod,
    Role.user,
    (Role as any).super_admin || 'super_admin',
  )
  @ApiOperation({
    summary: 'Get paginated list of users (Super Admin/Admin: All, Manager/HOD: Subordinates)',
    description:
      'Super Admin and Admin accounts receive all users in the system. Manager and HOD users receive only employees working under them (where reporting_manager_id or hod_id equals the current user ID). Supports search filters and pagination.',
  })
  @ApiResponse({ status: 200, description: 'Users list retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized token or session revoked' })
  async findAll(
    @Query() query: ListUsersDto,
    @GetUser() currentUser: IUserPayload,
  ) {
    return this.usersService.findAll(query, currentUser);
  }

  // Get Users dropdown list
  @Get('dropdown')
  @Roles(
    Role.admin,
    Role.manager,
    Role.hod,
    Role.user,
    (Role as any).super_admin || 'super_admin',
  )
  @ApiOperation({ summary: 'Get lightweight active users list for dropdown options' })
  @ApiResponse({ status: 200, description: 'Dropdown users list retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized token or session revoked' })
  async getDropdown(
    @GetUser() currentUser: IUserPayload,
    @Query('department_id') department_id?: string,
    @Query('role') role?: Role,
    @Query('is_active') is_active?: string,
  ) {
    const deptId = department_id ? Number(department_id) : undefined;
    const active = is_active !== undefined ? String(is_active).toLowerCase() === 'true' : true;
    return this.usersService.getDropdown(currentUser, deptId, role, active);
  }

  // Get User by ID (Admin, Manager/HOD of user, or Self)
  @Get(':id')
  @Roles(
    Role.admin,
    Role.manager,
    Role.hod,
    Role.user,
    (Role as any).super_admin || 'super_admin',
  )
  @ApiOperation({
    summary: 'Get user details by ID (Admin, Manager/HOD, or Self)',
    description:
      'Fetches details of a specific user. Access is granted if requester is Super Admin/Admin, the user themselves, or the assigned Manager or HOD of the employee.',
  })
  @ApiParam({ name: 'id', type: Number, description: 'Target User ID' })
  @ApiResponse({ status: 200, description: 'User details retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized token or session revoked' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden: Access denied to user profile outside hierarchy/self',
  })
  @ApiResponse({ status: 404, description: 'User not found' })
  async findOne(
    @Param('id', ParseIntPipe) id: number,
    @GetUser() currentUser: IUserPayload,
  ) {
    return this.usersService.findOne(id, currentUser);
  }

  // Update User details (Admin, Manager/HOD of user, or Self)
  @Patch(':id')
  @Roles(
    Role.admin,
    Role.manager,
    Role.hod,
    Role.user,
    (Role as any).super_admin || 'super_admin',
  )
  @ApiOperation({
    summary: 'Update user profile (Admin, Manager/HOD, or Self)',
    description:
      'Updates user information. Super Admin, Admin, and assigned Manager/HOD of the employee can update user profiles. Users can also update their own profiles.',
  })
  @ApiParam({ name: 'id', type: Number, description: 'Target User ID' })
  @ApiResponse({ status: 200, description: 'User updated successfully' })
  @ApiResponse({ status: 400, description: 'Validation failed' })
  @ApiResponse({ status: 401, description: 'Unauthorized token or session revoked' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden: Access denied to update user outside hierarchy/self',
  })
  @ApiResponse({ status: 404, description: 'User not found' })
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateUserDto: UpdateUserDto,
    @GetUser() currentUser: IUserPayload,
  ) {
    return this.usersService.update(id, updateUserDto, currentUser);
  }

  // TODO: Testing need to be done
  //  Reset User Password (Admin and Manager/HOD of user)
  @Post(':id/reset-password')
  @HttpCode(HttpStatus.OK)
  @Roles(
    Role.admin,
    Role.manager,
    Role.hod,
    Role.user,
    (Role as any).super_admin || 'super_admin',
  )
  @ApiOperation({
    summary: 'Reset user password (Admin & Manager/HOD of employee)',
    description:
      'Triggers a password reset for a target user. Allowed ONLY for Super Admin, Admin, and the assigned Manager or HOD of the employee.',
  })
  @ApiParam({ name: 'id', type: Number, description: 'Target User ID' })
  @ApiResponse({ status: 200, description: 'Password reset successfully' })
  @ApiResponse({ status: 400, description: 'Validation failed or weak password' })
  @ApiResponse({ status: 401, description: 'Unauthorized token or session revoked' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden: Only Admin or assigned Manager/HOD can reset user password',
  })
  @ApiResponse({ status: 404, description: 'User not found' })
  async resetPassword(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ResetUserPasswordDto,
    @GetUser() currentUser: IUserPayload,
  ) {
    return this.usersService.resetPassword(id, dto, currentUser);
  }

  //  Deactivate User account (Admin and Manager/HOD of employee)
  @Delete(':id')
  @Roles(
    Role.admin,
    Role.manager,
    Role.hod,
    Role.user,
    (Role as any).super_admin || 'super_admin',
  )
  @ApiOperation({
    summary: 'Deactivate user account (Admin & Manager/HOD of employee)',
    description:
      'Deactivates (soft deletes) a user account. Allowed ONLY for Super Admin, Admin, and the assigned Manager or HOD of the employee.',
  })
  @ApiParam({ name: 'id', type: Number, description: 'Target User ID' })
  @ApiResponse({ status: 200, description: 'User deactivated successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized token or session revoked' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden: Only Admin or assigned Manager/HOD can deactivate user',
  })
  @ApiResponse({ status: 404, description: 'User not found' })
  async remove(
    @Param('id', ParseIntPipe) id: number,
    @GetUser() currentUser: IUserPayload,
  ) {
    return this.usersService.remove(id, currentUser);
  }

  // Toggle user active status (Admin & Manager/HOD of employee)
  @Patch(':id/toggle-status')
  @Roles(
    Role.admin,
    Role.manager,
    Role.hod,
    Role.user,
    (Role as any).super_admin || 'super_admin',
  )
  @ApiOperation({
    summary: 'Toggle user active status (Admin & Manager/HOD of employee)',
    description:
      'Toggles a user account between active (true) and inactive (false). Allowed ONLY for Super Admin, Admin, and assigned Manager/HOD of the employee.',
  })
  @ApiParam({ name: 'id', type: Number, description: 'Target User ID' })
  @ApiResponse({ status: 200, description: 'User active status toggled successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized token or session revoked' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden: Only Admin or assigned Manager/HOD can toggle user status',
  })
  @ApiResponse({ status: 404, description: 'User not found' })
  async toggleStatus(
    @Param('id', ParseIntPipe) id: number,
    @GetUser() currentUser: IUserPayload,
  ) {
    return this.usersService.toggleStatus(id, currentUser);
  }
}

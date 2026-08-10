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
  ParseIntPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse, ApiParam } from '@nestjs/swagger';
import { DepartmentsService } from './departments.service';
import { CreateDepartmentDto } from './dto/create-department.dto';
import { UpdateDepartmentDto } from './dto/update-department.dto';
import { ListDepartmentsDto } from './dto/list-departments.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '@prisma/client';

@ApiTags('Departments')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller({ path: 'departments', version: '1' })
export class DepartmentsController {
  constructor(private readonly departmentsService: DepartmentsService) { }

  @Post()
  @Roles(Role.admin)
  @ApiOperation({ summary: 'Create new department (Admin only)' })
  @ApiResponse({ status: 201, description: 'Department created successfully' })
  @ApiResponse({ status: 400, description: 'Validation failed or invalid body' })
  @ApiResponse({ status: 401, description: 'Unauthorized token or session revoked' })
  @ApiResponse({ status: 403, description: 'Forbidden: Admin role required' })
  @ApiResponse({ status: 409, description: 'Department name already exists' })
  async create(@Body() dto: CreateDepartmentDto) {
    return this.departmentsService.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'Get list of departments with optional filtering and pagination' })
  @ApiResponse({ status: 200, description: 'Departments list retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized token or session revoked' })
  async findAll(@Query() query: ListDepartmentsDto) {
    return this.departmentsService.findAll(query);
  }

  @Get('dropdown')
  @ApiOperation({ summary: 'Get lightweight department list for dropdown options' })
  @ApiResponse({ status: 200, description: 'Dropdown departments list retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized token or session revoked' })
  async getDropdown(@Query('is_active') isActive?: string) {
    const active = isActive !== undefined ? String(isActive).toLowerCase() === 'true' : true;
    return this.departmentsService.getDropdown(active);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get department by ID' })
  @ApiParam({ name: 'id', type: Number, description: 'Department ID' })
  @ApiResponse({ status: 200, description: 'Department details retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized token or session revoked' })
  @ApiResponse({ status: 404, description: 'Department not found' })
  async findOne(@Param('id', ParseIntPipe) id: number) {
    return this.departmentsService.findOne(id);
  }

  @Patch(':id')
  @Roles(Role.admin)
  @ApiOperation({ summary: 'Update department details (Admin only)' })
  @ApiParam({ name: 'id', type: Number, description: 'Department ID' })
  @ApiResponse({ status: 200, description: 'Department updated successfully' })
  @ApiResponse({ status: 400, description: 'Validation failed' })
  @ApiResponse({ status: 401, description: 'Unauthorized token or session revoked' })
  @ApiResponse({ status: 403, description: 'Forbidden: Admin role required' })
  @ApiResponse({ status: 404, description: 'Department not found' })
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateDepartmentDto,
  ) {
    return this.departmentsService.update(id, dto);
  }

  @Patch(':id/toggle-status')
  @Roles(Role.admin, (Role as any).super_admin || 'super_admin')
  @ApiOperation({ summary: 'Toggle department status (Admin and Super Admin only)' })
  @ApiParam({ name: 'id', type: Number, description: 'Department ID' })
  @ApiResponse({ status: 200, description: 'Department status toggled successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized token or session revoked' })
  @ApiResponse({ status: 403, description: 'Forbidden: Admin role required' })
  @ApiResponse({ status: 404, description: 'Department not found' })
  async toggleStatus(@Param('id', ParseIntPipe) id: number) {
    return this.departmentsService.toggleStatus(id);
  }

  @Delete(':id')
  @Roles(Role.admin)
  @ApiOperation({ summary: 'Deactivate department (Admin only)' })
  @ApiParam({ name: 'id', type: Number, description: 'Department ID' })
  @ApiResponse({ status: 200, description: 'Department deactivated successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized token or session revoked' })
  @ApiResponse({ status: 403, description: 'Forbidden: Admin role required' })
  @ApiResponse({ status: 404, description: 'Department not found' })
  async remove(@Param('id', ParseIntPipe) id: number) {
    return this.departmentsService.remove(id);
  }
}

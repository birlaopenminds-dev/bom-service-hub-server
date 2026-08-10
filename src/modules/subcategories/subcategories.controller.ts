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
import { SubcategoriesService } from './subcategories.service';
import { CreateSubcategoryDto } from './dto/create-subcategory.dto';
import { UpdateSubcategoryDto } from './dto/update-subcategory.dto';
import { ListSubcategoriesDto } from './dto/list-subcategories.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '@prisma/client';

@ApiTags('Subcategories')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller({ path: 'subcategories', version: '1' })
export class SubcategoriesController {
  constructor(private readonly subcategoriesService: SubcategoriesService) { }

  @Post()
  @Roles(Role.admin, Role.manager, Role.hod)
  @ApiOperation({ summary: 'Create new subcategory with default assignee & TAT hours' })
  @ApiResponse({ status: 201, description: 'Subcategory created successfully' })
  @ApiResponse({ status: 400, description: 'Validation failed or category_id invalid' })
  @ApiResponse({ status: 401, description: 'Unauthorized token or session revoked' })
  @ApiResponse({ status: 403, description: 'Forbidden: Admin or Manager role required' })
  @ApiResponse({ status: 409, description: 'Subcategory name already exists in this category' })
  async create(@Body() dto: CreateSubcategoryDto) {
    return this.subcategoriesService.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'Get list of subcategories with optional filtering and pagination' })
  @ApiResponse({ status: 200, description: 'Subcategories list retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized token or session revoked' })
  async findAll(@Query() query: ListSubcategoriesDto) {
    return this.subcategoriesService.findAll(query);
  }

  @Get('dropdown')
  @ApiOperation({ summary: 'Get lightweight subcategory list for dropdown options' })
  @ApiResponse({ status: 200, description: 'Dropdown subcategories list retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized token or session revoked' })
  async getDropdown(
    @Query('category_id') category_id?: number,
    @Query('is_active') is_active: string = 'true',
    @Query('default_assignee_id') default_assignee_id?: number,
  ) {
    const isActiveBool = is_active.toLowerCase() === 'true';
    return this.subcategoriesService.getDropdown(category_id, isActiveBool, default_assignee_id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get subcategory by ID' })
  @ApiParam({ name: 'id', type: Number, description: 'Subcategory ID' })
  @ApiResponse({ status: 200, description: 'Subcategory details retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized token or session revoked' })
  @ApiResponse({ status: 404, description: 'Subcategory not found' })
  async findOne(@Param('id', ParseIntPipe) id: number) {
    return this.subcategoriesService.findOne(id);
  }

  @Patch(':id')
  @Roles(Role.admin, Role.manager, Role.hod)
  @ApiOperation({ summary: 'Update subcategory details' })
  @ApiParam({ name: 'id', type: Number, description: 'Subcategory ID' })
  @ApiResponse({ status: 200, description: 'Subcategory updated successfully' })
  @ApiResponse({ status: 400, description: 'Validation failed' })
  @ApiResponse({ status: 401, description: 'Unauthorized token or session revoked' })
  @ApiResponse({ status: 403, description: 'Forbidden: Admin or Manager role required' })
  @ApiResponse({ status: 404, description: 'Subcategory not found' })
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateSubcategoryDto,
  ) {
    return this.subcategoriesService.update(id, dto);
  }

  @Patch(':id/toggle-status')
  @Roles(Role.admin, Role.manager, Role.hod)
  @ApiOperation({ summary: 'Toggle subcategory status' })
  @ApiParam({ name: 'id', type: Number, description: 'Subcategory ID' })
  @ApiResponse({ status: 200, description: 'Subcategory status toggled successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized token or session revoked' })
  @ApiResponse({ status: 403, description: 'Forbidden: Admin or Manager role required' })
  @ApiResponse({ status: 404, description: 'Subcategory not found' })
  async toggleStatus(@Param('id', ParseIntPipe) id: number) {
    return this.subcategoriesService.toggleStatus(id);
  }

  @Delete(':id')
  @Roles(Role.admin)
  @ApiOperation({ summary: 'Deactivate subcategory (Admin only)' })
  @ApiParam({ name: 'id', type: Number, description: 'Subcategory ID' })
  @ApiResponse({ status: 200, description: 'Subcategory deactivated successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized token or session revoked' })
  @ApiResponse({ status: 403, description: 'Forbidden: Admin role required' })
  @ApiResponse({ status: 404, description: 'Subcategory not found' })
  async remove(@Param('id', ParseIntPipe) id: number) {
    return this.subcategoriesService.remove(id);
  }
}

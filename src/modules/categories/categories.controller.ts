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
import { CategoriesService } from './categories.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { ListCategoriesDto } from './dto/list-categories.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '@prisma/client';

@ApiTags('Categories')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller({ path: 'categories', version: '1' })
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) { }

  // create category
  @Post()
  @Roles(Role.admin, Role.manager, Role.hod)
  @ApiOperation({ summary: 'Create new category under department' })
  @ApiResponse({ status: 201, description: 'Category created successfully' })
  @ApiResponse({ status: 400, description: 'Validation failed or department_id invalid' })
  @ApiResponse({ status: 401, description: 'Unauthorized token or session revoked' })
  @ApiResponse({ status: 403, description: 'Forbidden: Admin or Manager role required' })
  @ApiResponse({ status: 409, description: 'Category name already exists in this department' })
  async create(@Body() dto: CreateCategoryDto) {
    return this.categoriesService.create(dto);
  }

  // get all categories with optional filtering and pagination
  @Get()
  @ApiOperation({ summary: 'Get list of categories with optional filtering and pagination' })
  @ApiResponse({ status: 200, description: 'Categories list retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized token or session revoked' })
  async findAll(@Query() query: ListCategoriesDto) {
    return this.categoriesService.findAll(query);
  }

  // get category dropdown list
  @Get('dropdown')
  @ApiOperation({ summary: 'Get lightweight category list for dropdown options' })
  @ApiResponse({ status: 200, description: 'Dropdown categories list retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized token or session revoked' })
  async getDropdown(
    @Query('department_id') department_id?: string,
    @Query('is_active') is_active?: string,
  ) {
    const deptId = department_id ? Number(department_id) : undefined;
    const active = is_active !== undefined ? String(is_active).toLowerCase() === 'true' : true;
    return this.categoriesService.getDropdown(deptId, active);
  }

  // get category details by ID
  @Get(':id')
  @ApiOperation({ summary: 'Get category details by ID' })
  @ApiParam({ name: 'id', type: Number, description: 'Category ID' })
  @ApiResponse({ status: 200, description: 'Category details retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized token or session revoked' })
  @ApiResponse({ status: 404, description: 'Category not found' })
  async findOne(@Param('id', ParseIntPipe) id: number) {
    return this.categoriesService.findOne(id);
  }

  // update category details
  @Patch(':id')
  @Roles(Role.admin, Role.manager, Role.hod)
  @ApiOperation({ summary: 'Update category details' })
  @ApiParam({ name: 'id', type: Number, description: 'Category ID' })
  @ApiResponse({ status: 200, description: 'Category updated successfully' })
  @ApiResponse({ status: 400, description: 'Validation failed' })
  @ApiResponse({ status: 401, description: 'Unauthorized token or session revoked' })
  @ApiResponse({ status: 403, description: 'Forbidden: Admin or Manager role required' })
  @ApiResponse({ status: 404, description: 'Category not found' })
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateCategoryDto,
  ) {
    return this.categoriesService.update(id, dto);
  }

  // toggle category status
  @Patch(':id/toggle-status')
  @Roles(Role.admin)
  @ApiOperation({ summary: 'Toggle category status' })
  @ApiParam({ name: 'id', type: Number, description: 'Category ID' })
  @ApiResponse({ status: 200, description: 'Category status toggled successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized token or session revoked' })
  @ApiResponse({ status: 403, description: 'Forbidden: Admin role required' })
  @ApiResponse({ status: 404, description: 'Category not found' })
  async toggle(@Param('id', ParseIntPipe) id: number) {
    return this.categoriesService.toggle(id);
  }

  // remove category (soft delete)
  @Delete(':id')
  @Roles(Role.admin)
  @ApiOperation({ summary: 'Remove category (Admin only)' })
  @ApiParam({ name: 'id', type: Number, description: 'Category ID' })
  @ApiResponse({ status: 200, description: 'Category removed successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized token or session revoked' })
  @ApiResponse({ status: 403, description: 'Forbidden: Admin role required' })
  @ApiResponse({ status: 404, description: 'Category not found' })
  async remove(@Param('id', ParseIntPipe) id: number) {
    return this.categoriesService.remove(id);
  }
}

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
  UseInterceptors,
  UploadedFile,
  Res,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiResponse,
  ApiParam,
  ApiProduces,
  ApiConsumes,
  ApiBody,
} from '@nestjs/swagger';
import { SubcategoriesService } from './subcategories.service';
import { CreateSubcategoryDto } from './dto/create-subcategory.dto';
import { UpdateSubcategoryDto } from './dto/update-subcategory.dto';
import { ListSubcategoriesDto } from './dto/list-subcategories.dto';
import { SubcategoriesTemplateExporter } from './export/subcategories-template.exporter';
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

  // Download sample Excel template for bulk subcategory import
  @Get('template/download')
  @Roles(Role.admin, (Role as any).super_admin || 'super_admin')
  @ApiProduces('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
  @ApiOperation({
    summary: 'Download sample Excel template for bulk subcategory import (Super Admin & Admin)',
    description:
      'Generates and downloads a pre-formatted Excel template (.xlsx) with sample data for bulk subcategory import.',
  })
  @ApiResponse({ status: 200, description: 'Template Excel file download stream' })
  async downloadTemplate(@Res() res: Response) {
    return SubcategoriesTemplateExporter.generateTemplate(res);
  }

  // Bulk import subcategories from uploaded Excel file (.xlsx or .xls)
  @Post('import-excel')
  @UseInterceptors(FileInterceptor('file'))
  @Roles(Role.admin, (Role as any).super_admin || 'super_admin')
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary: 'Bulk import subcategories from uploaded Excel file (Super Admin & Admin)',
    description:
      'Parses an uploaded Excel file (.xlsx or .xls) and bulk creates subcategories in the database.',
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description: 'Excel file (.xlsx or .xls)',
        },
      },
    },
  })
  @ApiResponse({ status: 200, description: 'Subcategories imported successfully with summary report' })
  @ApiResponse({ status: 400, description: 'Invalid Excel file or format error' })
  async importExcel(@UploadedFile() file: Express.Multer.File) {
    return this.subcategoriesService.importSubcategoriesFromExcel(file);
  }

  @Post()
  @Roles(Role.admin, Role.manager, Role.hod, (Role as any).super_admin || 'super_admin')
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

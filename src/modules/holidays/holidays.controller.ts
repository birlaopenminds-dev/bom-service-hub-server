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
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiResponse,
  ApiParam,
} from '@nestjs/swagger';
import { HolidaysService } from './holidays.service';
import { CreateHolidayDto } from './dto/create-holiday.dto';
import { UpdateHolidayDto } from './dto/update-holiday.dto';
import { ListHolidaysDto } from './dto/list-holidays.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '@prisma/client';

@ApiTags('Holidays')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.admin, (Role as any).super_admin || 'super_admin')
@Controller({ path: 'holidays', version: '1' })
export class HolidaysController {
  constructor(private readonly holidaysService: HolidaysService) {}

  @Post()
  @ApiOperation({ summary: 'Add a new organization holiday (Admin & Super Admin)' })
  @ApiResponse({ status: 201, description: 'Holiday created successfully' })
  @ApiResponse({ status: 409, description: 'Holiday for this date already exists' })
  async create(@Body() dto: CreateHolidayDto) {
    return this.holidaysService.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'List all organization holidays (Admin & Super Admin)' })
  @ApiResponse({ status: 200, description: 'List of holidays retrieved successfully' })
  async findAll(@Query() query: ListHolidaysDto) {
    return this.holidaysService.findAll(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get holiday details by ID (Admin & Super Admin)' })
  @ApiParam({ name: 'id', description: 'Holiday ID', type: Number })
  @ApiResponse({ status: 200, description: 'Holiday details' })
  @ApiResponse({ status: 404, description: 'Holiday not found' })
  async findOne(@Param('id', ParseIntPipe) id: number) {
    return this.holidaysService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update holiday details (Admin & Super Admin)' })
  @ApiParam({ name: 'id', description: 'Holiday ID', type: Number })
  @ApiResponse({ status: 200, description: 'Holiday updated successfully' })
  @ApiResponse({ status: 404, description: 'Holiday not found' })
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateHolidayDto,
  ) {
    return this.holidaysService.update(id, dto);
  }

  @Patch(':id/toggle-status')
  @ApiOperation({ summary: 'Toggle holiday active status (Admin & Super Admin)' })
  @ApiParam({ name: 'id', description: 'Holiday ID', type: Number })
  @ApiResponse({ status: 200, description: 'Holiday status toggled successfully' })
  @ApiResponse({ status: 404, description: 'Holiday not found' })
  async toggleStatus(@Param('id', ParseIntPipe) id: number) {
    return this.holidaysService.toggleStatus(id);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete holiday (Admin & Super Admin)' })
  @ApiParam({ name: 'id', description: 'Holiday ID', type: Number })
  @ApiResponse({ status: 200, description: 'Holiday removed successfully' })
  @ApiResponse({ status: 404, description: 'Holiday not found' })
  async remove(@Param('id', ParseIntPipe) id: number) {
    return this.holidaysService.remove(id);
  }
}

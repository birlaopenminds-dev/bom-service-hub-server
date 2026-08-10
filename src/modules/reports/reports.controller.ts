import { Controller, Get, Query, Res, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse, ApiProduces } from '@nestjs/swagger';
import { ReportsService } from './reports.service';
import { ReportFiltersDto } from './dto/report-filters.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { GetUser } from '../../common/decorators/get-user.decorator';
import { Response } from 'express';
import { Role } from '@prisma/client';

@ApiTags('Reports')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller({ path: 'reports', version: '1' })
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) { }

  @Get('summary')
  @Roles(Role.admin, Role.manager, Role.hod, Role.user, Role.super_admin)
  @ApiOperation({ summary: 'Get summary metrics report based on user role and filters' })
  @ApiResponse({ status: 200, description: 'Summary metrics report data retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized token or session revoked' })
  async getSummaryMetrics(
    @GetUser() user: any,
    @Query() filters: ReportFiltersDto,
  ) {
    return this.reportsService.getSummaryMetrics(user, filters);
  }

  @Get('export/excel')
  @Roles(Role.admin, Role.manager, Role.hod, Role.user, Role.super_admin)
  @ApiProduces('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
  @ApiOperation({ summary: 'Export ticket report as Excel (.xlsx) file' })
  @ApiResponse({
    status: 200,
    description: 'Excel file (.xlsx) stream download',
    schema: {
      type: 'string',
      format: 'binary',
    },
  })
  @ApiResponse({ status: 401, description: 'Unauthorized token or session revoked' })
  async exportExcel(
    @GetUser() user: any,
    @Query() filters: ReportFiltersDto,
    @Res() res: Response,
  ) {
    return this.reportsService.exportExcel(user, filters, res);
  }

  @Get('export/csv')
  @Roles(Role.admin, Role.manager, Role.hod, Role.user, Role.super_admin)
  @ApiProduces('text/csv')
  @ApiOperation({ summary: 'Export ticket report as CSV file' })
  @ApiResponse({
    status: 200,
    description: 'CSV file (.csv) stream download',
    schema: {
      type: 'string',
      format: 'binary',
    },
  })
  @ApiResponse({ status: 401, description: 'Unauthorized token or session revoked' })
  async exportCsv(
    @GetUser() user: any,
    @Query() filters: ReportFiltersDto,
    @Res() res: Response,
  ) {
    return this.reportsService.exportCsv(user, filters, res);
  }
}

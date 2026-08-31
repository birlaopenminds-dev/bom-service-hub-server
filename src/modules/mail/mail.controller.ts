import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import { MailService } from './mail.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '@prisma/client';

@ApiTags('Mail Logs')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller({ path: 'mail-logs', version: '1' })
export class MailController {
  constructor(private readonly mailService: MailService) {}

  @Get()
  @Roles(Role.admin, (Role as any).super_admin || 'super_admin')
  @ApiOperation({
    summary: 'Get email delivery logs (Admin & Super Admin ONLY)',
    description:
      'Retrieves a paginated list of email logs including sent and failed logs with error reasons.',
  })
  @ApiResponse({ status: 200, description: 'Email logs retrieved successfully' })
  @ApiResponse({ status: 403, description: 'Forbidden access - Admin / Super Admin only' })
  async getEmailLogs(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('search') search?: string,
    @Query('status') status?: string,
  ) {
    return this.mailService.getEmailLogs({ page, limit, search, status });
  }
}

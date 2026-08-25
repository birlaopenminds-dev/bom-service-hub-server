import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Query,
  UseGuards,
  UseInterceptors,
  UploadedFiles,
  HttpCode,
  HttpStatus,
  ParseIntPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiConsumes, ApiBody, ApiResponse, ApiParam } from '@nestjs/swagger';
import { TicketsService } from './tickets.service';
import { CreateTicketDto } from './dto/create-ticket.dto';
import { UpdateTicketDto } from './dto/update-ticket.dto';
import { UpdateTicketStatusDto } from './dto/update-status.dto';
import { UpdateDueDateDto } from './dto/update-due-date.dto';
import { ReassignTicketDto } from './dto/reassign-ticket.dto';
import { EscalateTicketDto } from './dto/escalate-ticket.dto';
import { AddCommentDto } from './dto/add-comment.dto';
import { ListTicketsDto } from './dto/list-tickets.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { GetUser } from '../../common/decorators/get-user.decorator';
import { Role } from '@prisma/client';

import { CustomFilesUploadInterceptor } from '../uploads/interceptors/file-upload.interceptor';

@ApiTags('Tickets')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller({ path: 'tickets', version: '1' })
export class TicketsController {
  constructor(private readonly ticketsService: TicketsService) { }

  @Post()
  @UseInterceptors(CustomFilesUploadInterceptor('attachments', 5))
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['department_id', 'category_id', 'subcategory_id', 'priority', 'subject', 'description'],
      properties: {
        department_id: { type: 'integer', example: 1, description: 'Department ID' },
        category_id: { type: 'integer', example: 2, description: 'Category ID' },
        subcategory_id: { type: 'integer', example: 3, description: 'Subcategory ID' },
        priority: { type: 'string', enum: ['low', 'medium', 'high', 'critical'], example: 'medium' },
        subject: { type: 'string', example: "Laptop won't turn on" },
        description: { type: 'string', example: 'Power light blinks red and laptop shuts down after 5 seconds.' },
        assigned_to: { type: 'integer', example: 4, description: 'Optional assigned engineer ID' },
        attachments: {
          type: 'array',
          items: {
            type: 'string',
            format: 'binary',
          },
          description: 'Upload up to 5 attachment files (images, documents, PDFs)',
        },
      },
    },
  })
  @ApiOperation({ summary: 'Raise a new support ticket with optional attachments' })
  @ApiResponse({ status: 201, description: 'Support ticket raised successfully' })
  @ApiResponse({ status: 400, description: 'Validation failed or invalid category/department hierarchy' })
  @ApiResponse({ status: 401, description: 'Unauthorized token or session revoked' })
  async create(
    @GetUser('id') userId: number,
    @Body() createTicketDto: CreateTicketDto,
    @UploadedFiles() files?: Express.Multer.File[],
  ) {
    return this.ticketsService.create(userId, createTicketDto, files);
  }

  @Get()
  @ApiOperation({ summary: 'Get paginated list of tickets based on user role and filters' })
  @ApiResponse({ status: 200, description: 'Paginated ticket list retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized token or session revoked' })
  async findAll(@GetUser() user: any, @Query() query: ListTicketsDto) {
    return this.ticketsService.findAll(user, query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get detailed ticket view by ID (with logs & attachments)' })
  @ApiParam({ name: 'id', type: Number, description: 'Ticket ID' })
  @ApiResponse({ status: 200, description: 'Ticket details retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized token or session revoked' })
  @ApiResponse({ status: 403, description: 'Forbidden: Cannot view ticket outside hierarchy/assigned domain' })
  @ApiResponse({ status: 404, description: 'Ticket not found' })
  async findOne(
    @Param('id', ParseIntPipe) id: number,
    @GetUser() user: any,
  ) {
    return this.ticketsService.findOne(id, user);
  }

  @Patch(':id/status')
  @HttpCode(HttpStatus.OK)
  @Roles(Role.admin, Role.manager, Role.hod, Role.user, (Role as any).super_admin || 'super_admin')
  @ApiOperation({ summary: 'Update ticket status (open -> wip -> resolved -> closed)' })
  @ApiParam({ name: 'id', type: Number, description: 'Ticket ID' })
  @ApiResponse({ status: 200, description: 'Ticket status updated successfully' })
  @ApiResponse({ status: 400, description: 'Invalid status transition or missing comment' })
  @ApiResponse({ status: 401, description: 'Unauthorized token or session revoked' })
  @ApiResponse({ status: 403, description: 'Forbidden: Admin or Manager role required' })
  @ApiResponse({ status: 404, description: 'Ticket not found' })
  async updateStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateTicketStatusDto,
    @GetUser('id') userId: number,
  ) {
    return this.ticketsService.updateStatus(id, dto, userId);
  }

  @Patch(':id/reassign')
  @HttpCode(HttpStatus.OK)
  @Roles(Role.admin, Role.manager, Role.hod)
  @ApiOperation({ summary: 'Reassign ticket to another technician or manager' })
  @ApiParam({ name: 'id', type: Number, description: 'Ticket ID' })
  @ApiResponse({ status: 200, description: 'Ticket reassigned successfully' })
  @ApiResponse({ status: 400, description: 'Target user is not an active engineer or manager' })
  @ApiResponse({ status: 401, description: 'Unauthorized token or session revoked' })
  @ApiResponse({ status: 403, description: 'Forbidden: Admin or Manager role required' })
  @ApiResponse({ status: 404, description: 'Ticket not found' })
  async reassign(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ReassignTicketDto,
    @GetUser('id') userId: number,
  ) {
    return this.ticketsService.reassignTicket(id, dto, userId);
  }

  @Patch(':id/due-date')
  @HttpCode(HttpStatus.OK)
  @Roles(Role.admin, Role.manager, Role.hod, Role.user, (Role as any).super_admin || 'super_admin')
  @ApiOperation({ summary: 'Update SLA due date of a ticket' })
  @ApiParam({ name: 'id', type: Number, description: 'Ticket ID' })
  @ApiResponse({ status: 200, description: 'SLA due date updated successfully' })
  @ApiResponse({ status: 400, description: 'Invalid date format or past date' })
  @ApiResponse({ status: 401, description: 'Unauthorized token or session revoked' })
  @ApiResponse({ status: 403, description: 'Forbidden: Admin or Manager role required' })
  @ApiResponse({ status: 404, description: 'Ticket not found' })
  async updateDueDate(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateDueDateDto,
    @GetUser('id') userId: number,
  ) {
    return this.ticketsService.updateDueDate(id, dto, userId);
  }

  @Post(':id/escalate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Escalate ticket to management attention' })
  @ApiParam({ name: 'id', type: Number, description: 'Ticket ID' })
  @ApiResponse({ status: 200, description: 'Ticket escalated successfully' })
  @ApiResponse({ status: 400, description: 'Missing escalation reason' })
  @ApiResponse({ status: 401, description: 'Unauthorized token or session revoked' })
  @ApiResponse({ status: 404, description: 'Ticket not found' })
  async escalate(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: EscalateTicketDto,
    @GetUser('id') userId: number,
  ) {
    return this.ticketsService.escalateTicket(id, dto, userId);
  }

  @Post(':id/comments')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Add comment/work note to ticket' })
  @ApiParam({ name: 'id', type: Number, description: 'Ticket ID' })
  @ApiResponse({ status: 200, description: 'Comment added to ticket log' })
  @ApiResponse({ status: 400, description: 'Empty comment text' })
  @ApiResponse({ status: 401, description: 'Unauthorized token or session revoked' })
  @ApiResponse({ status: 404, description: 'Ticket not found' })
  async addComment(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: AddCommentDto,
    @GetUser() user: any,
  ) {
    return this.ticketsService.addComment(id, dto, user);
  }

  @Patch(':id')
  @UseInterceptors(CustomFilesUploadInterceptor('attachments', 5))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Update ticket subject/description/priority and attachments' })
  @ApiParam({ name: 'id', type: Number, description: 'Ticket ID' })
  @ApiResponse({ status: 200, description: 'Ticket details updated successfully' })
  @ApiResponse({ status: 400, description: 'Validation failed' })
  @ApiResponse({ status: 401, description: 'Unauthorized token or session revoked' })
  @ApiResponse({ status: 403, description: 'Forbidden: Insufficient permissions to edit ticket' })
  @ApiResponse({ status: 404, description: 'Ticket not found' })
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateTicketDto,
    @GetUser('id') userId: number,
    @UploadedFiles() files?: Express.Multer.File[],
  ) {
    return this.ticketsService.update(id, dto, userId, files);
  }
}

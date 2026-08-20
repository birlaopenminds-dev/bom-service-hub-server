import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../providers/database/prisma.service';
import { TicketLogsService } from '../ticket-logs/ticket-logs.service';
import { TicketAttachmentsService } from '../ticket-attachments/ticket-attachments.service';
import { MailService } from '../mail/mail.service';
import { AuditService } from '../audit/audit.service';
import { HelpersUtil } from '../../common/utils/helpers.util';
import { SanitizeUtil } from '../../common/utils/sanitize.util';
import { PaginationUtil } from '../../common/utils/pagination.util';
import { CreateTicketDto } from './dto/create-ticket.dto';
import { UpdateTicketDto } from './dto/update-ticket.dto';
import { UpdateTicketStatusDto } from './dto/update-status.dto';
import { UpdateDueDateDto } from './dto/update-due-date.dto';
import { ReassignTicketDto } from './dto/reassign-ticket.dto';
import { filterTicketsByPerformance } from '../reports/reports.service';
import { EscalateTicketDto } from './dto/escalate-ticket.dto';
import { AddCommentDto } from './dto/add-comment.dto';
import { ListTicketsDto } from './dto/list-tickets.dto';
import { Prisma, Role, TicketStatus } from '@prisma/client';

@Injectable()
export class TicketsService {
  private readonly logger = new Logger(TicketsService.name);

  constructor(
    private prisma: PrismaService,
    private ticketLogsService: TicketLogsService,
    private ticketAttachmentsService: TicketAttachmentsService,
    private mailService: MailService,
    private auditService: AuditService,
  ) { }

  private getTicketIncludeRelations() {
    return {
      user: { select: { id: true, name: true, email: true, role: true } },
      department: { select: { id: true, name: true } },
      category: { select: { id: true, name: true } },
      subcategory: { select: { id: true, name: true, tat_hours: true } },
      assignee: { select: { id: true, name: true, email: true, role: true } },
    };
  }

  private async getManagedUserIds(user: any): Promise<number[]> {
    if (!user || !user.id) return [];
    const roleStr = String(user.role).toLowerCase().trim();

    if (roleStr === 'user') return [user.id];


    if (roleStr === 'manager') {
      const directReports = await this.prisma.user.findMany({
        where: {
          OR: [
            { id: user.id },
            { reporting_manager_id: user.id },
          ],
        },
        select: { id: true },
      });

      const userIds = directReports.map((u) => u.id);

      if (userIds.length <= 1 && user.department_id) {
        const deptUsers = await this.prisma.user.findMany({
          where: {
            department_id: user.department_id,
            role: Role.user,
          },
          select: { id: true },
        });
        deptUsers.forEach((u) => {
          if (!userIds.includes(u.id)) userIds.push(u.id);
        });
      }

      return userIds;
    }

    if (roleStr === 'hod') {
      const whereCond: Prisma.UserWhereInput = {
        OR: [
          { id: user.id },
          { hod_id: user.id },
          { reporting_manager_id: user.id },
        ],
      };

      if (user.department_id) {
        (whereCond.OR as any[]).push({ department_id: user.department_id });
      }

      const hodUsers = await this.prisma.user.findMany({
        where: whereCond,
        select: { id: true },
      });

      return hodUsers.map((u) => u.id);
    }

    return [user.id];
  }

  async create(
    userId: number,
    createDto: CreateTicketDto,
    files?: Express.Multer.File[],
  ) {
    const subcategory = await this.prisma.subcategory.findUnique({
      where: { id: createDto.subcategory_id },
      include: { category: true, default_assignee: true },
    });

    if (!subcategory || !subcategory.is_active) throw new NotFoundException('Subcategory not found or inactive.');

    const assignedTo = createDto.assigned_to || subcategory.default_assignee_id || null;

    const dueAt = HelpersUtil.calculateDueDate(subcategory.tat_hours);

    // Generate sequential ticket_no: TKT-0000001, TKT-0000002...
    const lastTicket = await this.prisma.ticket.findFirst({
      orderBy: { id: 'desc' },
      select: { id: true },
    });

    const nextId = Number(lastTicket?.id || 0) + 1;
    const ticketNo = HelpersUtil.generateTicketNumber(nextId);

    const sanitizedSubject = SanitizeUtil.sanitizeString(createDto.subject);
    const sanitizedDescription = SanitizeUtil.sanitizeRichText(createDto.description);

    const ticket = await this.prisma.ticket.create({
      data: {
        ticket_no: ticketNo,
        user_id: userId,
        department_id: createDto.department_id,
        category_id: createDto.category_id,
        subcategory_id: createDto.subcategory_id,
        priority: createDto.priority,
        subject: sanitizedSubject,
        description: sanitizedDescription,
        assigned_to: assignedTo,
        status: TicketStatus.open,
        due_at: dueAt,
      },
      include: this.getTicketIncludeRelations(),
    });

    // Save File Attachments if provided
    if (files && files.length > 0) {
      for (const file of files) {
        await this.ticketAttachmentsService.createAttachment(ticket.id, file);
      }
    }

    // Log Creation
    await this.ticketLogsService.createLog({
      ticket_id: ticket.id,
      user_id: userId,
      action: 'TICKET_CREATED',
      details: {
        ticket_no: ticket.ticket_no,
        priority: ticket.priority,
        assigned_to: assignedTo,
        due_at: dueAt,
      },
    });

    // Audit Log
    await this.auditService.log({
      userId,
      action: 'CREATE_TICKET',
      resource: 'tickets',
      resourceId: ticket.id,
      newValues: { ticket_no: ticket.ticket_no, priority: ticket.priority },
    });

    // Send Mail Notifications in background (non-blocking for instant HTTP response)
    this.mailService
      .sendMail({
        to: ticket.user.email,
        subject: `Ticket Created: ${ticket.ticket_no}`,
        template: 'ticket-created',
        context: {
          name: ticket.user.name,
          ticketNo: ticket.ticket_no,
          subject: ticket.subject,
          description: ticket.description,
          creatorName: ticket.user.name,
          creatorEmail: ticket.user.email,
          assigneeName: ticket.assignee?.name || null,
          assigneeEmail: ticket.assignee?.email || null,
          priority: ticket.priority,
          status: ticket.status,
          dueAt: ticket.due_at,
        },
      })
      .catch((err) =>
        this.logger.error(`Failed to send creation email: ${err.message}`),
      );

    if (ticket.assignee) {
      this.mailService
        .sendMail({
          to: ticket.assignee.email,
          subject: `Ticket Assigned: ${ticket.ticket_no}`,
          template: 'ticket-assigned',
          context: {
            assigneeName: ticket.assignee.name,
            assigneeEmail: ticket.assignee.email,
            ticketNo: ticket.ticket_no,
            subject: ticket.subject,
            description: ticket.description,
            creatorName: ticket.user.name,
            creatorEmail: ticket.user.email,
            priority: ticket.priority,
            dueAt: ticket.due_at,
          },
        })
        .catch((err) =>
          this.logger.error(`Failed to send assignment email: ${err.message}`),
        );
    }

    return this.findOne(ticket.id);
  }

  async findAll(user: any, query: ListTicketsDto) {
    let page = Math.max(1, query.page || 1);
    const limit = Math.min(100, query.limit || 10);

    const filters: Prisma.TicketWhereInput[] = [];

    // Role-based visibility scoping matching hierarchy logic
    const isSuperAdmin =
      String(user.role).toLowerCase() === 'super_admin' ||
      user.role === Role.super_admin;

    if (!isSuperAdmin) {
      const managedUserIds = await this.getManagedUserIds(user);
      filters.push({
        OR: [
          { user_id: { in: managedUserIds } },
          { assigned_to: { in: managedUserIds } },
          ...(user.role === Role.hod && user.department_id
            ? [{ department_id: user.department_id }]
            : []),
        ],
      });
    }

    const searchTerm = query.search?.trim();
    if (searchTerm) {
      filters.push({
        OR: [
          { ticket_no: { contains: searchTerm, mode: 'insensitive' } },
          { subject: { contains: searchTerm, mode: 'insensitive' } },
          { description: { contains: searchTerm, mode: 'insensitive' } },
          { user: { name: { contains: searchTerm, mode: 'insensitive' } } },
          { user: { email: { contains: searchTerm, mode: 'insensitive' } } },
        ],
      });
    }

    if (query.status) filters.push({ status: query.status });
    if (query.priority) filters.push({ priority: query.priority });
    if (query.department_id) filters.push({ department_id: query.department_id });
    if (query.category_id) filters.push({ category_id: query.category_id });
    if (query.subcategory_id) filters.push({ subcategory_id: query.subcategory_id });
    if (query.assigned_to) filters.push({ assigned_to: query.assigned_to });

    if (query.startDate || query.endDate) {
      filters.push({
        created_at: {
          ...(query.startDate && { gte: new Date(query.startDate) }),
          ...(query.endDate && { lte: new Date(query.endDate) }),
        },
      });
    }

    if (query.slaBreached === 'true') {
      filters.push({
        due_at: { lt: new Date() },
        NOT: { status: { in: [TicketStatus.resolved, TicketStatus.closed] } },
      });
    }

    const where: Prisma.TicketWhereInput = filters.length > 0 ? { AND: filters } : {};

    if (query.performanceStatus && query.performanceStatus.toUpperCase() !== 'ALL') {
      const allMatching = await this.prisma.ticket.findMany({
        where,
        orderBy: { created_at: 'desc' },
        include: this.getTicketIncludeRelations(),
      });

      const filtered = filterTicketsByPerformance(allMatching, query.performanceStatus);
      const totalCount = filtered.length;
      const maxPages = Math.ceil(totalCount / limit) || 1;

      if (searchTerm || page > maxPages) {
        page = 1;
      }

      const skip = (page - 1) * limit;
      const paginatedTickets = filtered.slice(skip, skip + limit);
      return PaginationUtil.buildPaginatedResult(paginatedTickets, totalCount, page, limit);
    }

    // Standard paginated query
    const totalCount = await this.prisma.ticket.count({ where });
    const maxPages = Math.ceil(totalCount / limit) || 1;

    if (searchTerm || page > maxPages) {
      page = 1;
    }

    const skip = (page - 1) * limit;

    const tickets = await this.prisma.ticket.findMany({
      where,
      skip,
      take: limit,
      orderBy: { created_at: 'desc' },
      include: this.getTicketIncludeRelations(),
    });

    return PaginationUtil.buildPaginatedResult(tickets, totalCount, page, limit);
  }

  async findOne(id: number, currentUser?: any) {
    const ticket = await this.prisma.ticket.findUnique({
      where: { id },
      include: {
        ...this.getTicketIncludeRelations(),
        attachments: true,
        logs: {
          orderBy: { created_at: 'asc' },
          include: { user: { select: { id: true, name: true, email: true, role: true } } },
        },
      },
    });

    if (!ticket) {
      throw new NotFoundException(`Ticket with ID "${id}" not found.`);
    }

    if (currentUser) {
      const isSuperAdmin =
        String(currentUser.role).toLowerCase() === 'super_admin' ||
        currentUser.role === Role.super_admin;
      if (!isSuperAdmin) {
        const managedUserIds = await this.getManagedUserIds(currentUser);
        const hasAccess =
          managedUserIds.includes(ticket.user_id) ||
          (ticket.assigned_to && managedUserIds.includes(ticket.assigned_to)) ||
          (currentUser.role === Role.hod && ticket.department_id === currentUser.department_id);
        if (!hasAccess) {
          throw new ForbiddenException("Access Restricted: You don't have permission to perform this action.");
        }
      }
    }

    const formattedAttachments = ticket.attachments.map((att) => ({
      ...att,
      file_url: `/uploads/${att.stored_name}`,
    }));

    return {
      ...ticket,
      attachments: formattedAttachments,
    };
  }

  async updateStatus(
    id: number,
    dto: UpdateTicketStatusDto,
    userId: number,
  ) {
    const ticket = await this.findOne(id);

    const isResolvedOrClosed =
      dto.status === TicketStatus.resolved || dto.status === TicketStatus.closed;

    const updated = await this.prisma.ticket.update({
      where: { id },
      data: {
        status: dto.status,
        ...(isResolvedOrClosed && !ticket.resolved_at && { resolved_at: new Date() }),
      },
      include: this.getTicketIncludeRelations(),
    });

    await this.ticketLogsService.createLog({
      ticket_id: id,
      user_id: userId,
      action: 'STATUS_CHANGED',
      details: {
        old_status: ticket.status,
        new_status: dto.status,
        comment: dto.comment || null,
      },
    });

    // this.mailService
    //   .sendMail({
    //     to: ticket.user.email,
    //     subject: `Ticket Status Updated: ${ticket.ticket_no}`,
    //     template: 'ticket-status',
    //     context: {
    //       name: ticket.user.name,
    //       ticketNo: ticket.ticket_no,
    //       subject: ticket.subject,
    //       description: ticket.description,
    //       creatorName: ticket.user.name,
    //       creatorEmail: ticket.user.email,
    //       assigneeName: ticket.assignee?.name || null,
    //       assigneeEmail: ticket.assignee?.email || null,
    //       status: dto.status,
    //     },
    //   })
    //   .catch((err) =>
    //     this.logger.error(`Failed to send status update email: ${err.message}`),
    //   );

    return updated;
  }

  async reassignTicket(
    id: number,
    dto: ReassignTicketDto,
    currentUserId: number,
  ) {
    const ticket = await this.findOne(id);

    const newAssignee = await this.prisma.user.findUnique({
      where: { id: dto.assigned_to },
    });

    if (!newAssignee) throw new NotFoundException(`Assignee user "${dto.assigned_to}" not found.`);

    const updated = await this.prisma.ticket.update({
      where: { id },
      data: { assigned_to: dto.assigned_to },
      include: this.getTicketIncludeRelations(),
    });

    await this.ticketLogsService.createLog({
      ticket_id: id,
      user_id: currentUserId,
      action: 'TICKET_REASSIGNED',
      details: {
        old_assignee: ticket.assigned_to,
        new_assignee: dto.assigned_to,
        reason: dto.reason || null,
      },
    });

    this.mailService
      .sendMail({
        to: newAssignee.email,
        subject: `Ticket Reassigned: ${ticket.ticket_no}`,
        template: 'ticket-reassigned',
        context: {
          assigneeName: newAssignee.name,
          assigneeEmail: newAssignee.email,
          ticketNo: ticket.ticket_no,
          subject: ticket.subject,
          description: ticket.description,
          creatorName: ticket.user?.name || null,
          creatorEmail: ticket.user?.email || null,
          dueAt: ticket.due_at,
        },
      })
      .catch((err) =>
        this.logger.error(`Failed to send reassignment email: ${err.message}`),
      );

    return updated;
  }

  async updateDueDate(id: number, dto: UpdateDueDateDto, userId: number) {
    const ticket = await this.findOne(id);
    const newDueDate = new Date(dto.due_at);

    if (isNaN(newDueDate.getTime())) {
      throw new BadRequestException('Invalid due date string format.');
    }

    const updated = await this.prisma.ticket.update({
      where: { id },
      data: { due_at: newDueDate },
      include: this.getTicketIncludeRelations(),
    });

    await this.ticketLogsService.createLog({
      ticket_id: id,
      user_id: userId,
      action: 'DUE_DATE_UPDATED',
      details: {
        old_due_at: ticket.due_at,
        new_due_at: newDueDate,
        reason: dto.reason,
      },
    });

    // this.mailService
    //   .sendMail({
    //     to: ticket.user.email,
    //     subject: `Ticket Due Date Updated: ${ticket.ticket_no}`,
    //     template: 'ticket-due-date',
    //     context: {
    //       name: ticket.user.name,
    //       ticketNo: ticket.ticket_no,
    //       subject: ticket.subject,
    //       description: ticket.description,
    //       creatorName: ticket.user.name,
    //       creatorEmail: ticket.user.email,
    //       assigneeName: ticket.assignee?.name || null,
    //       assigneeEmail: ticket.assignee?.email || null,
    //       dueAt: newDueDate,
    //     },
    //   })
    //   .catch((err) =>
    //     this.logger.error(`Failed to send due date update email: ${err.message}`),
    //   );

    return updated;
  }

  async escalateTicket(id: number, dto: EscalateTicketDto, userId: number) {
    const ticket = await this.findOne(id);

    const updated = await this.prisma.ticket.update({
      where: { id },
      data: { escalated_at: new Date() },
      include: this.getTicketIncludeRelations(),
    });

    await this.ticketLogsService.createLog({
      ticket_id: id,
      user_id: userId,
      action: 'TICKET_ESCALATED',
      details: { reason: dto.reason },
    });

    await this.mailService.sendMail({
      to: ticket.user.email,
      subject: `Ticket Escalated: ${ticket.ticket_no}`,
      template: 'ticket-escalated',
      context: {
        name: ticket.user.name,
        ticketNo: ticket.ticket_no,
        subject: ticket.subject,
        description: ticket.description,
        creatorName: ticket.user.name,
        creatorEmail: ticket.user.email,
        assigneeName: ticket.assignee?.name || null,
        assigneeEmail: ticket.assignee?.email || null,
        reason: dto.reason,
      },
    });

    return updated;
  }

  async addComment(id: number, dto: AddCommentDto, user: any) {
    const ticket = await this.findOne(id, user);

    const sanitizedComment = SanitizeUtil.sanitizeString(dto.comment);

    const log = await this.ticketLogsService.createLog({
      ticket_id: id,
      user_id: user.id,
      action: 'COMMENT_ADDED',
      details: { comment: sanitizedComment },
    });

    // Notify ticket creator or assignee
    const notifyRecipient =
      user.id === ticket.user_id ? ticket.assignee?.email : ticket.user.email;

    if (notifyRecipient) {
      const recipientName =
        user.id === ticket.user_id ? ticket.assignee?.name || 'Assignee' : ticket.user.name;

      await this.mailService.sendMail({
        to: notifyRecipient,
        subject: `New Comment on Ticket: ${ticket.ticket_no}`,
        template: 'ticket-comment',
        context: {
          name: recipientName,
          ticketNo: ticket.ticket_no,
          author: user.name,
          comment: sanitizedComment,
          subject: ticket.subject,
          description: ticket.description,
          creatorName: ticket.user.name,
          creatorEmail: ticket.user.email,
          assigneeName: ticket.assignee?.name || null,
          assigneeEmail: ticket.assignee?.email || null,
        },
      });
    }

    return log;
  }

  async update(
    id: number,
    dto: UpdateTicketDto,
    userId: number,
    files?: Express.Multer.File[],
  ) {
    const ticket = await this.findOne(id);

    const updated = await this.prisma.ticket.update({
      where: { id },
      data: {
        ...(dto.priority && { priority: dto.priority }),
        ...(dto.subject && { subject: SanitizeUtil.sanitizeString(dto.subject) }),
        ...(dto.description && { description: SanitizeUtil.sanitizeRichText(dto.description) }),
        ...(dto.status && { status: dto.status }),
        ...(dto.assigned_to !== undefined && { assigned_to: dto.assigned_to }),
        ...(dto.due_date && { due_at: new Date(dto.due_date) }),
      },
      include: this.getTicketIncludeRelations(),
    });

    if (files && files.length > 0) {
      for (const file of files) {
        await this.ticketAttachmentsService.createAttachment(ticket.id, file);
      }
    }

    await this.ticketLogsService.createLog({
      ticket_id: id,
      user_id: userId,
      action: 'TICKET_UPDATED',
      details: dto,
    });

    return updated;
  }
}

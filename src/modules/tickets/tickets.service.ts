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
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          reporting_manager: { select: { id: true, name: true, email: true } },
          hod: { select: { id: true, name: true, email: true } },
        },
      },
      department: { select: { id: true, name: true } },
      category: { select: { id: true, name: true } },
      subcategory: { select: { id: true, name: true, tat_hours: true } },
      assignee: {
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          reporting_manager: { select: { id: true, name: true, email: true } },
          hod: { select: { id: true, name: true, email: true } },
        },
      },
    };
  }

  private async sendNotificationWithCc(
    ticket: any,
    template: string,
    subject: string,
    actorUserId: number,
    extraContext: Record<string, any> = {},
  ) {
    try {
      const creator = ticket.user;
      const assignee = ticket.assignee;

      // 1. Gather Creator's RM & HOD
      const creatorCcEmails: string[] = [];
      if (creator?.reporting_manager?.email) {
        const rmEmail = creator.reporting_manager.email.trim();
        if (rmEmail && rmEmail.toLowerCase() !== creator.email.toLowerCase()) {
          creatorCcEmails.push(rmEmail);
        }
      }
      if (creator?.hod?.email) {
        const hodEmail = creator.hod.email.trim();
        if (
          hodEmail &&
          hodEmail.toLowerCase() !== creator.email.toLowerCase() &&
          !creatorCcEmails.some((e) => e.toLowerCase() === hodEmail.toLowerCase())
        ) {
          creatorCcEmails.push(hodEmail);
        }
      }

      // 2. Gather Assignee's RM & HOD
      const assigneeCcEmails: string[] = [];
      if (assignee?.reporting_manager?.email) {
        const rmEmail = assignee.reporting_manager.email.trim();
        if (rmEmail && rmEmail.toLowerCase() !== assignee.email.toLowerCase()) {
          assigneeCcEmails.push(rmEmail);
        }
      }
      if (assignee?.hod?.email) {
        const hodEmail = assignee.hod.email.trim();
        if (
          hodEmail &&
          hodEmail.toLowerCase() !== assignee.email.toLowerCase() &&
          !assigneeCcEmails.some((e) => e.toLowerCase() === hodEmail.toLowerCase())
        ) {
          assigneeCcEmails.push(hodEmail);
        }
      }

      // 3. Determine actor's email (to exclude actor from CC list)
      let actorEmail: string | null = null;
      if (creator && creator.id === actorUserId) {
        actorEmail = creator.email;
      } else if (assignee && assignee.id === actorUserId) {
        actorEmail = assignee.email;
      }

      // Determine Primary TO Recipients (excluding actor)
      const toRecipients: { email: string; name: string }[] = [];

      if (creator?.email && creator.id !== actorUserId) {
        toRecipients.push({ email: creator.email, name: creator.name });
      }

      if (
        assignee?.email &&
        assignee.id !== actorUserId &&
        assignee.id !== creator?.id
      ) {
        toRecipients.push({ email: assignee.email, name: assignee.name });
      }

      const toEmailsLower = new Set(toRecipients.map((r) => r.email.toLowerCase()));

      // Deduplicate CC Emails (excluding TO recipients, creator, assignee, and actor)
      const rawAllCc = [...creatorCcEmails, ...assigneeCcEmails];
      const ccList = Array.from(
        new Set(
          rawAllCc.filter(
            (email) =>
              email &&
              !toEmailsLower.has(email.toLowerCase()) &&
              (actorEmail ? email.toLowerCase() !== actorEmail.toLowerCase() : true),
          ),
        ),
      );

      const commonContext = {
        ticketNo: ticket.ticket_no,
        subject: ticket.subject,
        description: ticket.description,
        creatorName: creator?.name || null,
        creatorEmail: creator?.email || null,
        assigneeName: assignee?.name || null,
        assigneeEmail: assignee?.email || null,
        priority: ticket.priority,
        status: ticket.status,
        dueAt: ticket.due_at,
        ...extraContext,
      };

      // 4. Send to Primary TO Recipients (isCc: false)
      for (const recipient of toRecipients) {
        this.mailService
          .sendMail({
            to: recipient.email,
            subject,
            template,
            context: {
              ...commonContext,
              name: recipient.name,
              isCc: false,
            },
          })
          .catch((err) =>
            this.logger.error(
              `Failed to send ${template} notification to ${recipient.email}: ${err.message}`,
            ),
          );
      }

      // 5. Send to CC Recipients (isCc: true)
      if (ccList.length > 0) {
        this.mailService
          .sendMail({
            to: ccList,
            subject,
            template,
            context: {
              ...commonContext,
              isCc: true,
            },
          })
          .catch((err) =>
            this.logger.error(
              `Failed to send ${template} CC notification: ${err.message}`,
            ),
          );
      }
    } catch (err) {
      this.logger.error(
        `Error in sendNotificationWithCc for ${template}: ${err.message}`,
      );
    }
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

    // 1. Gather CC Emails for Creator Confirmation Email (Creator's RM & HOD)
    const creatorCcEmails: string[] = [];
    if (ticket.user?.reporting_manager?.email) {
      const rmEmail = ticket.user.reporting_manager.email.trim();
      if (rmEmail && rmEmail.toLowerCase() !== ticket.user.email.toLowerCase()) {
        creatorCcEmails.push(rmEmail);
      }
    }
    if (ticket.user?.hod?.email) {
      const hodEmail = ticket.user.hod.email.trim();
      if (
        hodEmail &&
        hodEmail.toLowerCase() !== ticket.user.email.toLowerCase() &&
        !creatorCcEmails.some((e) => e.toLowerCase() === hodEmail.toLowerCase())
      ) {
        creatorCcEmails.push(hodEmail);
      }
    }

    const commonMailContext = {
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
    };

    // 1a. Send personalized confirmation email to ticket creator (isCc: false)
    this.mailService
      .sendMail({
        to: ticket.user.email,
        subject: `[BOM Service Hub] Ticket Created: ${ticket.ticket_no} - ${ticket.subject}`,
        template: 'ticket-created',
        context: {
          ...commonMailContext,
          name: ticket.user.name,
          isCc: false,
        },
      })
      .catch((err) =>
        this.logger.error(`Failed to send creator email: ${err.message}`),
      );

    // 1b. Send notification email to Creator's RM & HOD (isCc: true)
    if (creatorCcEmails.length > 0) {
      this.mailService
        .sendMail({
          to: creatorCcEmails,
          subject: `[BOM Service Hub] Ticket Created: ${ticket.ticket_no} - ${ticket.subject}`,
          template: 'ticket-created',
          context: {
            ...commonMailContext,
            isCc: true,
          },
        })
        .catch((err) =>
          this.logger.error(`Failed to send creator CC email: ${err.message}`),
        );
    }

    // 2. Send notification emails for assignee (only if assigned to a different user)
    if (
      ticket.assignee &&
      ticket.assignee.email &&
      ticket.assignee.id !== ticket.user.id
    ) {
      const rawAssigneeCc: string[] = [];

      // Add Assignee's RM & HOD (based on assignee's department/hierarchy)
      if (ticket.assignee.reporting_manager?.email) {
        rawAssigneeCc.push(ticket.assignee.reporting_manager.email.trim());
      }
      if (ticket.assignee.hod?.email) {
        rawAssigneeCc.push(ticket.assignee.hod.email.trim());
      }

      // Filter out assignee's email AND any CC emails that already received the creation email (e.g. shared RM/HOD)
      const creatorCcLowerSet = new Set(
        creatorCcEmails.map((e) => e.toLowerCase()),
      );

      const assigneeCcList = Array.from(
        new Set(
          rawAssigneeCc.filter(
            (email) =>
              email &&
              email.toLowerCase() !== ticket.assignee.email.toLowerCase() &&
              !creatorCcLowerSet.has(email.toLowerCase()),
          ),
        ),
      );

      // 2a. Send personalized notification email to Assignee (isCc: false)
      this.mailService
        .sendMail({
          to: ticket.assignee.email,
          subject: `[BOM Service Hub] Ticket Assigned: ${ticket.ticket_no} - ${ticket.subject}`,
          template: 'ticket-assigned',
          context: {
            ...commonMailContext,
            assigneeName: ticket.assignee.name,
            assigneeEmail: ticket.assignee.email,
            isCc: false,
          },
        })
        .catch((err) =>
          this.logger.error(`Failed to send assignee email: ${err.message}`),
        );

      // 2b. Send notification email to Assignee's RM & HOD (isCc: true)
      if (assigneeCcList.length > 0) {
        this.mailService
          .sendMail({
            to: assigneeCcList,
            subject: `[BOM Service Hub] Ticket Assigned: ${ticket.ticket_no} - ${ticket.subject}`,
            template: 'ticket-assigned',
            context: {
              ...commonMailContext,
              assigneeName: ticket.assignee.name,
              assigneeEmail: ticket.assignee.email,
              isCc: true,
            },
          })
          .catch((err) =>
            this.logger.error(`Failed to send assignee CC email: ${err.message}`),
          );
      }
    }

    return this.findOne(ticket.id);
  }

  async findAll(user: any, query: ListTicketsDto) {
    let page = Math.max(1, query.page || 1);
    const limit = Math.min(100, query.limit || 10);

    const filters: Prisma.TicketWhereInput[] = [];

    const isAdminOrSuperAdmin =
      String(user.role).toLowerCase() === 'super_admin' ||
      String(user.role).toLowerCase() === 'admin' ||
      user.role === Role.super_admin ||
      user.role === Role.admin;

    const filterType = (query.type || query.scope)?.trim().toLowerCase();

    if (isAdminOrSuperAdmin) {
      if (filterType === 'raised_by_me' || filterType === 'created_by_me') {
        filters.push({ user_id: user.id });
      } else if (filterType === 'raised_on_me' || filterType === 'assigned_to_me') {
        filters.push({ assigned_to: user.id });
      }
    } else {
      const managedUserIds = await this.getManagedUserIds(user);

      if (filterType === 'raised_by_me' || filterType === 'created_by_me') {
        filters.push({ user_id: { in: managedUserIds } });
      } else if (filterType === 'raised_on_me' || filterType === 'assigned_to_me') {
        filters.push({
          AND: [
            {
              OR: [
                { assigned_to: { in: managedUserIds } },
                ...(user.role === Role.hod && user.department_id
                  ? [{ department_id: user.department_id }]
                  : []),
              ],
            },
            { NOT: { user_id: { in: managedUserIds } } },
          ],
        });
      } else {
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
          { assignee: { name: { contains: searchTerm, mode: 'insensitive' } } },
          { assignee: { email: { contains: searchTerm, mode: 'insensitive' } } },
        ],
      });
    }

    if (query.status) {
      const statusList = String(query.status)
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      if (statusList.length === 1) {
        filters.push({ status: statusList[0] as TicketStatus });
      } else if (statusList.length > 1) {
        filters.push({ status: { in: statusList as TicketStatus[] } });
      }
    }
    if (query.priority) filters.push({ priority: query.priority });
    if (query.department_id) filters.push({ department_id: query.department_id });
    if (query.category_id) filters.push({ category_id: query.category_id });
    if (query.subcategory_id) filters.push({ subcategory_id: query.subcategory_id });
    if (query.assigned_to) {
      filters.push({
        OR: [
          { assigned_to: query.assigned_to },
          { user_id: query.assigned_to },
        ],
      });
    }

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
      const isAdminOrSuperAdmin =
        String(currentUser.role).toLowerCase() === 'super_admin' ||
        String(currentUser.role).toLowerCase() === 'admin' ||
        currentUser.role === Role.super_admin ||
        currentUser.role === Role.admin;
      if (!isAdminOrSuperAdmin) {
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

    if (
      ticket.status === TicketStatus.resolved ||
      ticket.status === TicketStatus.closed
    ) {
      throw new BadRequestException(
        'Ticket is resolved or closed and its status cannot be changed.',
      );
    }

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

    let updatedByName = 'Support Team';
    if (userId === updated.user?.id) {
      updatedByName = updated.user.name;
    } else if (userId === updated.assignee?.id) {
      updatedByName = updated.assignee.name;
    } else {
      const actorUser = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { name: true },
      });
      if (actorUser) updatedByName = actorUser.name;
    }

    this.sendNotificationWithCc(
      updated,
      'ticket-status',
      `[BOM Service Hub] Ticket Status Updated: ${updated.ticket_no} - ${updated.status}`,
      userId,
      { status: updated.status, updatedByName },
    );

    return updated;
  }

  async reassignTicket(
    id: number,
    dto: ReassignTicketDto,
    currentUserId: number,
  ) {
    const ticket = await this.findOne(id);

    if (
      ticket.status === TicketStatus.resolved ||
      ticket.status === TicketStatus.closed
    ) {
      throw new BadRequestException(
        'Ticket is resolved or closed and cannot be reassigned.',
      );
    }

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

    /*
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
    */

    return updated;
  }

  async updateDueDate(id: number, dto: UpdateDueDateDto, userId: number) {
    const ticket = await this.findOne(id);

    if (
      ticket.status === TicketStatus.resolved ||
      ticket.status === TicketStatus.closed
    ) {
      throw new BadRequestException(
        'Ticket is resolved or closed and SLA due date cannot be updated.',
      );
    }

    const newDueDate = new Date(dto.due_at);

    if (isNaN(newDueDate.getTime())) {
      throw new BadRequestException('Invalid due date string format.');
    }

    if (newDueDate.getTime() === new Date(ticket.due_at).getTime()) {
      return ticket;
    }

    // Check SLA due date update count (Maximum 2 updates allowed per ticket)
    const updateCount = await this.prisma.ticketLog.count({
      where: {
        ticket_id: id,
        action: { in: ['DUE_DATE_UPDATED', 'SLA_DUE_DATE_UPDATED'] },
      },
    });

    if (updateCount >= 2) {
      throw new BadRequestException(
        'SLA Due Date for this ticket has already been updated 2 times (maximum limit reached).',
      );
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

    if (
      ticket.status === TicketStatus.resolved ||
      ticket.status === TicketStatus.closed
    ) {
      throw new BadRequestException(
        'Ticket is resolved or closed and cannot be escalated.',
      );
    }

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

    /*
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
    */

    return updated;
  }

  // added comment and updated by yash
  async addComment(id: number, dto: AddCommentDto, user: any) {
    const ticket = await this.findOne(id, user);

    if (
      ticket.status === TicketStatus.resolved ||
      ticket.status === TicketStatus.closed
    ) {
      throw new BadRequestException(
        'Ticket is resolved or closed and locked. No further comments can be added.',
      );
    }

    const sanitizedComment = SanitizeUtil.sanitizeString(dto.comment);

    const log = await this.ticketLogsService.createLog({
      ticket_id: id,
      user_id: user.id,
      action: 'COMMENT_ADDED',
      details: { comment: sanitizedComment },
    });

    this.sendNotificationWithCc(
      ticket,
      'ticket-comment',
      `[BOM Service Hub] New Comment on Ticket: ${ticket.ticket_no}`,
      user.id,
      { author: user.name, comment: sanitizedComment },
    );

    return log;
  }

  async update(
    id: number,
    dto: UpdateTicketDto,
    userId: number,
    files?: Express.Multer.File[],
  ) {
    const ticket = await this.findOne(id);

    if (
      ticket.status === TicketStatus.resolved ||
      ticket.status === TicketStatus.closed
    ) {
      throw new BadRequestException(
        'Ticket is resolved or closed and cannot be edited.',
      );
    }

    // Once created, ticket title (subject), description, department, priority, category, and subcategory are immutable.
    const updateData: any = {
      ...(dto.assigned_to !== undefined && { assigned_to: dto.assigned_to }),
    };

    let isDueDateChanged = false;
    let newDueDateObj: Date | null = null;

    if (dto.due_date) {
      const newDueDate = new Date(dto.due_date);
      if (!isNaN(newDueDate.getTime()) && newDueDate.getTime() !== new Date(ticket.due_at).getTime()) {
        const updateCount = await this.prisma.ticketLog.count({
          where: {
            ticket_id: id,
            action: { in: ['DUE_DATE_UPDATED', 'SLA_DUE_DATE_UPDATED'] },
          },
        });

        if (updateCount >= 2) {
          throw new BadRequestException(
            'SLA Due Date for this ticket has already been updated 2 times (maximum limit reached). Further extensions are not allowed.',
          );
        }

        updateData.due_at = newDueDate;
        isDueDateChanged = true;
        newDueDateObj = newDueDate;
      }
    }

    if (dto.status) {
      updateData.status = dto.status;
      if (dto.status === TicketStatus.resolved || dto.status === TicketStatus.closed) {
        if (!ticket.resolved_at) {
          updateData.resolved_at = new Date();
        }
      } else {
        updateData.resolved_at = null;
      }
    }

    const updated = await this.prisma.ticket.update({
      where: { id },
      data: updateData,
      include: this.getTicketIncludeRelations(),
    });

    if (files && files.length > 0) {
      for (const file of files) {
        await this.ticketAttachmentsService.createAttachment(ticket.id, file);
      }
    }

    // Log specific actions
    if (dto.status && dto.status !== ticket.status) {
      await this.ticketLogsService.createLog({
        ticket_id: id,
        user_id: userId,
        action: 'STATUS_CHANGED',
        details: {
          old_status: ticket.status,
          new_status: dto.status,
        },
      });
    }

    if (isDueDateChanged && newDueDateObj) {
      await this.ticketLogsService.createLog({
        ticket_id: id,
        user_id: userId,
        action: 'DUE_DATE_UPDATED',
        details: {
          old_due_at: ticket.due_at,
          new_due_at: newDueDateObj,
        },
      });
    }

    if (dto.comment && dto.comment.trim()) {
      const sanitizedComment = SanitizeUtil.sanitizeString(dto.comment);
      await this.ticketLogsService.createLog({
        ticket_id: id,
        user_id: userId,
        action: 'COMMENT_ADDED',
        details: { comment: sanitizedComment },
      });
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

import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../providers/database/prisma.service';
import { ReportFiltersDto } from './dto/report-filters.dto';
import { ExcelExporter } from './export/excel-exporter';
import { CsvExporter } from './export/csv-exporter';
import { Response } from 'express';
import { Prisma, Role, TicketStatus, Priority } from '@prisma/client';

export function isTicketDelayed(t: any): boolean {
  const now = new Date();
  const dueAt = t.due_at ? new Date(t.due_at) : null;
  if (!dueAt) return false;

  const status = String(t.status || '').toLowerCase();
  if (status === 'resolved' || status === 'closed') {
    const resolvedAt = t.resolved_at ? new Date(t.resolved_at) : (t.updated_at ? new Date(t.updated_at) : null);
    return resolvedAt ? resolvedAt > dueAt : false;
  }

  return dueAt < now;
}

export function filterTicketsByPerformance(tickets: any[], performanceStatus?: string): any[] {
  if (!performanceStatus || performanceStatus.toUpperCase() === 'ALL') return tickets;

  const key = performanceStatus.toUpperCase();
  const now = new Date();

  return tickets.filter((t) => {
    const status = String(t.status || '').toLowerCase();
    const dueAt = t.due_at ? new Date(t.due_at) : null;
    const priority = String(t.priority || '').toLowerCase();
    const delayed = isTicketDelayed(t);

    switch (key) {
      case 'OPEN':
        return status === 'open';
      case 'OPEN_DELAYED':
        return status === 'open' && dueAt !== null && dueAt < now;
      case 'WIP':
        return status === 'wip';
      case 'WIP_DELAYED':
        return status === 'wip' && dueAt !== null && dueAt < now;
      case 'RESOLVED_ON_TIME':
        return status === 'resolved' && !delayed;
      case 'RESOLVED_DELAYED':
        return status === 'resolved' && delayed;
      case 'CLOSED_ON_TIME':
        return status === 'closed' && !delayed;
      case 'CLOSED_DELAYED':
        return status === 'closed' && delayed;
      case 'UNASSIGNED':
        return !t.assigned_to && (status === 'open' || status === 'wip');
      case 'ESCALATED':
        return Boolean(t.escalated_at);
      case 'CRITICAL_HIGH_DELAYED':
        return (priority === 'critical' || priority === 'high') && delayed;
      case 'OVERDUE_ALL':
        return delayed;
      default:
        return true;
    }
  });
}

@Injectable()
export class ReportsService {
  constructor(private prisma: PrismaService) { }

  private async getFilteredTickets(user: any, filters: ReportFiltersDto) {
    const where = await this.buildWhereClause(user, filters);
    const tickets = await this.prisma.ticket.findMany({
      where,
      orderBy: { created_at: 'desc' },
      include: {
        user: { select: { name: true, email: true } },
        department: { select: { name: true } },
        category: { select: { name: true } },
        subcategory: { select: { name: true } },
        assignee: { select: { name: true, email: true } },
      },
    });

    return filterTicketsByPerformance(tickets, filters.performanceStatus);
  }

  private async buildWhereClause(
    user: any,
    filters: ReportFiltersDto,
  ): Promise<Prisma.TicketWhereInput> {
    const conditions: Prisma.TicketWhereInput[] = [];

    const isSuperAdmin = this.isSuperAdminUser(user);

    // Role-based visibility scoping
    if (user && !isSuperAdmin) {
      const managedUserIds = await this.getManagedUserIds(user);
      conditions.push({
        OR: [
          { user_id: { in: managedUserIds } },
          { assigned_to: { in: managedUserIds } },
          ...(user.role === Role.hod && user.department_id
            ? [{ department_id: user.department_id }]
            : []),
        ],
      });
    }

    const searchTerm = filters.search?.trim();
    if (searchTerm) {
      conditions.push({
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

    if (filters.status) {
      const statusList = String(filters.status)
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      if (statusList.length === 1) {
        conditions.push({ status: statusList[0] as TicketStatus });
      } else if (statusList.length > 1) {
        conditions.push({ status: { in: statusList as TicketStatus[] } });
      }
    }
    if (filters.priority) conditions.push({ priority: filters.priority });
    if (filters.department_id) conditions.push({ department_id: filters.department_id });
    if (filters.category_id) conditions.push({ category_id: filters.category_id });
    if (filters.subcategory_id) conditions.push({ subcategory_id: filters.subcategory_id });
    if (filters.assigned_to) {
      conditions.push({
        OR: [
          { assigned_to: filters.assigned_to },
          { user_id: filters.assigned_to },
        ],
      });
    }

    if (filters.startDate || filters.endDate) {
      conditions.push({
        created_at: {
          ...(filters.startDate && { gte: new Date(filters.startDate) }),
          ...(filters.endDate && { lte: new Date(filters.endDate) }),
        },
      });
    }

    if (filters.slaBreached === 'true') {
      conditions.push({
        due_at: { lt: new Date() },
        NOT: { status: { in: [TicketStatus.resolved, TicketStatus.closed] } },
      });
    }

    if (conditions.length === 0) return {};
    if (conditions.length === 1) return conditions[0];
    return { AND: conditions };
  }

  private isSuperAdminUser(user: any): boolean {
    if (!user || !user.role) return false;
    const roleStr = String(user.role).toLowerCase().trim();
    return (
      roleStr === 'super_admin' ||
      roleStr === 'superadmin' ||
      user.role === (Role as any).super_admin
    );
  }

  private async getManagedUserIds(user: any): Promise<number[]> {
    if (!user || !user.id) return [];
    const roleStr = String(user.role).toLowerCase().trim();

    if (roleStr === 'user') {
      return [user.id];
    }

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

  async getSummaryMetrics(user: any, filters: ReportFiltersDto) {
    const isSuperAdmin = this.isSuperAdminUser(user);
    const baseWhere = await this.buildWhereClause(user, filters);

    const now = new Date();
    const slaBreachedCondition: Prisma.TicketWhereInput = {
      due_at: { lt: now },
      NOT: { status: { in: [TicketStatus.resolved, TicketStatus.closed] } },
    };

    if (isSuperAdmin) {
      const [
        total,
        open,
        wip,
        resolved,
        closed,
        slaBreached,
      ] = await Promise.all([
        this.prisma.ticket.count({ where: baseWhere }),
        this.prisma.ticket.count({ where: { AND: [baseWhere, { status: TicketStatus.open }] } }),
        this.prisma.ticket.count({ where: { AND: [baseWhere, { status: TicketStatus.wip }] } }),
        this.prisma.ticket.count({ where: { AND: [baseWhere, { status: TicketStatus.resolved }] } }),
        this.prisma.ticket.count({ where: { AND: [baseWhere, { status: TicketStatus.closed }] } }),
        this.prisma.ticket.count({ where: { AND: [baseWhere, slaBreachedCondition] } }),
      ]);

      return {
        totalTickets: total,
        openTickets: open,
        wipTickets: wip,
        resolvedTickets: resolved,
        closedTickets: closed,
        slaBreachedTickets: slaBreached,
      };
    }

    const managedUserIds = await this.getManagedUserIds(user);

    const raisedByMeBase: Prisma.TicketWhereInput = {
      AND: [baseWhere, { user_id: { in: managedUserIds } }],
    };

    const raisedOnMeBase: Prisma.TicketWhereInput = {
      AND: [
        baseWhere,
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
    };

    const [
      myRaisedTotal,
      myRaisedOpen,
      myRaisedWip,
      myRaisedResolved,
      myRaisedClosed,
      myRaisedSlaBreached,
      myAssignedTotal,
      myAssignedOpen,
      myAssignedWip,
      myAssignedResolved,
      myAssignedClosed,
      myAssignedSlaBreached,
    ] = await Promise.all([
      this.prisma.ticket.count({ where: raisedByMeBase }),
      this.prisma.ticket.count({ where: { AND: [raisedByMeBase, { status: TicketStatus.open }] } }),
      this.prisma.ticket.count({ where: { AND: [raisedByMeBase, { status: TicketStatus.wip }] } }),
      this.prisma.ticket.count({ where: { AND: [raisedByMeBase, { status: TicketStatus.resolved }] } }),
      this.prisma.ticket.count({ where: { AND: [raisedByMeBase, { status: TicketStatus.closed }] } }),
      this.prisma.ticket.count({ where: { AND: [raisedByMeBase, slaBreachedCondition] } }),

      this.prisma.ticket.count({ where: raisedOnMeBase }),
      this.prisma.ticket.count({ where: { AND: [raisedOnMeBase, { status: TicketStatus.open }] } }),
      this.prisma.ticket.count({ where: { AND: [raisedOnMeBase, { status: TicketStatus.wip }] } }),
      this.prisma.ticket.count({ where: { AND: [raisedOnMeBase, { status: TicketStatus.resolved }] } }),
      this.prisma.ticket.count({ where: { AND: [raisedOnMeBase, { status: TicketStatus.closed }] } }),
      this.prisma.ticket.count({ where: { AND: [raisedOnMeBase, slaBreachedCondition] } }),
    ]);

    return {
      ticketsRaisedByMe: {
        total: myRaisedTotal,
        byStatus: {
          open: myRaisedOpen,
          wip: myRaisedWip,
          resolved: myRaisedResolved,
          closed: myRaisedClosed,
        },
        slaBreached: myRaisedSlaBreached,
      },
      ticketsRaisedOnMe: {
        total: myAssignedTotal,
        byStatus: {
          open: myAssignedOpen,
          wip: myAssignedWip,
          resolved: myAssignedResolved,
          closed: myAssignedClosed,
        },
        slaBreached: myAssignedSlaBreached,
      },
    };
  }

  async exportExcel(user: any, filters: ReportFiltersDto, res: Response) {
    const tickets = await this.getFilteredTickets(user, filters);
    return ExcelExporter.exportTicketsToExcel(tickets, res);
  }

  async exportCsv(user: any, filters: ReportFiltersDto, res: Response) {
    const tickets = await this.getFilteredTickets(user, filters);
    return CsvExporter.exportTicketsToCsv(tickets, res);
  }
}

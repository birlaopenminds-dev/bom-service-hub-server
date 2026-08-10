import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../providers/database/prisma.service';
import { ReportFiltersDto } from './dto/report-filters.dto';
import { ExcelExporter } from './export/excel-exporter';
import { CsvExporter } from './export/csv-exporter';
import { Response } from 'express';
import { Prisma, Role, TicketStatus } from '@prisma/client';

@Injectable()
export class ReportsService {
  constructor(private prisma: PrismaService) { }

  async getSummaryMetrics(user: any, filters: ReportFiltersDto) {
    const isSuperAdmin = this.isSuperAdminUser(user);
    const baseWhere = this.buildWhereClause(user, filters);

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
        // System-wide overall counts ONLY for super_admin
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

    // For ALL non-super_admin roles (hod, manager, user, admin)
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
      // Raised by me & my team counts
      this.prisma.ticket.count({ where: raisedByMeBase }),
      this.prisma.ticket.count({ where: { AND: [raisedByMeBase, { status: TicketStatus.open }] } }),
      this.prisma.ticket.count({ where: { AND: [raisedByMeBase, { status: TicketStatus.wip }] } }),
      this.prisma.ticket.count({ where: { AND: [raisedByMeBase, { status: TicketStatus.resolved }] } }),
      this.prisma.ticket.count({ where: { AND: [raisedByMeBase, { status: TicketStatus.closed }] } }),
      this.prisma.ticket.count({ where: { AND: [raisedByMeBase, slaBreachedCondition] } }),

      // Raised on me & my team counts
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

  async exportExcel(user: any, filters: ReportFiltersDto, res: Response) {
    const tickets = await this.getFilteredTickets(user, filters);
    return ExcelExporter.exportTicketsToExcel(tickets, res);
  }

  async exportCsv(user: any, filters: ReportFiltersDto, res: Response) {
    const tickets = await this.getFilteredTickets(user, filters);
    return CsvExporter.exportTicketsToCsv(tickets, res);
  }

  private async getFilteredTickets(user: any, filters: ReportFiltersDto) {
    const where = this.buildWhereClause(user, filters);
    return this.prisma.ticket.findMany({
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
  }

  private buildWhereClause(
    user: any,
    filters: ReportFiltersDto,
  ): Prisma.TicketWhereInput {
    const conditions: Prisma.TicketWhereInput[] = [];

    const isSuperAdmin = this.isSuperAdminUser(user);

    // Role-based visibility scoping
    if (user && !isSuperAdmin) {
      if ((user.role === Role.manager || user.role === Role.hod) && user.department_id) {
        conditions.push({
          OR: [
            { department_id: user.department_id },
            { user_id: user.id },
            { assigned_to: user.id },
          ],
        });
      } else {
        // admin and user role scoped to raised by or assigned to user
        conditions.push({
          OR: [{ user_id: user.id }, { assigned_to: user.id }],
        });
      }
    }

    if (filters.startDate || filters.endDate) {
      conditions.push({
        created_at: {
          ...(filters.startDate && { gte: new Date(filters.startDate) }),
          ...(filters.endDate && { lte: new Date(filters.endDate) }),
        },
      });
    }

    if (filters.status) conditions.push({ status: filters.status });
    if (filters.priority) conditions.push({ priority: filters.priority });
    if (filters.department_id) conditions.push({ department_id: filters.department_id });

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
}

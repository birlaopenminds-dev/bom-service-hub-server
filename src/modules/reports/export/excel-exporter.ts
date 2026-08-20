import * as ExcelJS from 'exceljs';
import { Response } from 'express';

export class ExcelExporter {
  private static getSlaPerformanceText(ticket: any): string {
    const now = new Date();
    const dueAt = ticket.due_at ? new Date(ticket.due_at) : null;
    const resolvedAt = ticket.resolved_at ? new Date(ticket.resolved_at) : (ticket.updated_at ? new Date(ticket.updated_at) : null);
    const status = String(ticket.status || '').toLowerCase();

    if (status === 'resolved' || status === 'closed') {
      if (dueAt && resolvedAt && resolvedAt > dueAt) {
        return `${status === 'resolved' ? 'Resolved' : 'Closed'} With Delay`;
      }
      return `${status === 'resolved' ? 'Resolved' : 'Closed'} On Time`;
    }

    if (dueAt && dueAt < now) {
      return `${status === 'wip' ? 'WIP' : 'Open'} (Delayed)`;
    }
    return `${status === 'wip' ? 'WIP' : 'Open'} (On Track)`;
  }

  static async exportTicketsToExcel(tickets: any[], res: Response) {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Tickets Report');

    worksheet.columns = [
      { header: 'Ticket No', key: 'ticket_no', width: 20 },
      { header: 'Subject', key: 'subject', width: 30 },
      { header: 'Status', key: 'status', width: 15 },
      { header: 'SLA Performance', key: 'sla_performance', width: 25 },
      { header: 'Priority', key: 'priority', width: 15 },
      { header: 'Requester', key: 'requester', width: 25 },
      { header: 'Department', key: 'department', width: 20 },
      { header: 'Category', key: 'category', width: 20 },
      { header: 'Subcategory', key: 'subcategory', width: 20 },
      { header: 'Assignee', key: 'assignee', width: 25 },
      { header: 'Due Date', key: 'due_at', width: 18 },
      { header: 'Created Date', key: 'created_at', width: 20 },
    ];

    tickets.forEach((t) => {
      worksheet.addRow({
        ticket_no: t.ticket_no,
        subject: t.subject,
        status: t.status.toUpperCase(),
        sla_performance: this.getSlaPerformanceText(t),
        priority: t.priority.toUpperCase(),
        requester: `${t.user?.name || 'N/A'} (${t.user?.email || ''})`,
        department: t.department?.name || 'N/A',
        category: t.category?.name || 'N/A',
        subcategory: t.subcategory?.name || 'N/A',
        assignee: t.assignee ? `${t.assignee.name} (${t.assignee.email})` : 'Unassigned',
        due_at: t.due_at ? new Date(t.due_at).toISOString().split('T')[0] : 'N/A',
        created_at: t.created_at ? new Date(t.created_at).toISOString().split('T')[0] : 'N/A',
      });
    });

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );

    res.setHeader(
      'Content-Disposition',
      'attachment; filename=tickets_report.xlsx',
    );

    await workbook.xlsx.write(res);
    res.end();
  }
}

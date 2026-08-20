import * as fastcsv from 'fast-csv';
import { Response } from 'express';

export class CsvExporter {
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

  static async exportTicketsToCsv(tickets: any[], res: Response) {
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=tickets_report.csv');

    const csvStream = fastcsv.format({ headers: true });
    csvStream.pipe(res);

    tickets.forEach((t) => {
      csvStream.write({
        'Ticket No': t.ticket_no,
        Subject: t.subject,
        Status: t.status.toUpperCase(),
        'SLA Performance': this.getSlaPerformanceText(t),
        Priority: t.priority.toUpperCase(),
        Requester: `${t.user?.name || 'N/A'} (${t.user?.email || ''})`,
        Department: t.department?.name || 'N/A',
        Category: t.category?.name || 'N/A',
        Subcategory: t.subcategory?.name || 'N/A',
        Assignee: t.assignee ? `${t.assignee.name} (${t.assignee.email})` : 'Unassigned',
        'Due Date': t.due_at ? new Date(t.due_at).toISOString().split('T')[0] : 'N/A',
        'Created Date': t.created_at ? new Date(t.created_at).toISOString().split('T')[0] : 'N/A',
      });
    });

    csvStream.end();
  }
}

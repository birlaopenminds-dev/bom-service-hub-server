import * as fastcsv from 'fast-csv';
import { Response } from 'express';

export class CsvExporter {
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
        Priority: t.priority.toUpperCase(),
        Requester: `${t.user.name} (${t.user.email})`,
        Department: t.department?.name || 'N/A',
        Assignee: t.assignee ? `${t.assignee.name} (${t.assignee.email})` : 'Unassigned',
        'Due Date': new Date(t.due_at).toISOString().split('T')[0],
        'Created Date': new Date(t.created_at).toISOString().split('T')[0],
      });
    });

    csvStream.end();
  }
}

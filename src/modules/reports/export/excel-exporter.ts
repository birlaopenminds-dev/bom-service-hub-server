import * as ExcelJS from 'exceljs';
import { Response } from 'express';

export class ExcelExporter {
  static async exportTicketsToExcel(tickets: any[], res: Response) {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Tickets Report');

    worksheet.columns = [
      { header: 'Ticket No', key: 'ticket_no', width: 20 },
      { header: 'Subject', key: 'subject', width: 30 },
      { header: 'Status', key: 'status', width: 15 },
      { header: 'Priority', key: 'priority', width: 15 },
      { header: 'Requester', key: 'requester', width: 25 },
      { header: 'Department', key: 'department', width: 25 },
      { header: 'Assignee', key: 'assignee', width: 25 },
      { header: 'Due Date', key: 'due_at', width: 20 },
      { header: 'Created Date', key: 'created_at', width: 20 },
    ];

    tickets.forEach((t) => {
      worksheet.addRow({
        ticket_no: t.ticket_no,
        subject: t.subject,
        status: t.status.toUpperCase(),
        priority: t.priority.toUpperCase(),
        requester: `${t.user.name} (${t.user.email})`,
        department: t.department?.name || 'N/A',
        assignee: t.assignee ? `${t.assignee.name} (${t.assignee.email})` : 'Unassigned',
        due_at: new Date(t.due_at).toISOString().split('T')[0],
        created_at: new Date(t.created_at).toISOString().split('T')[0],
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

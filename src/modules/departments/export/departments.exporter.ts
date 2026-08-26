import * as ExcelJS from 'exceljs';
import { Response } from 'express';

export class DepartmentsExporter {
  static async exportToExcel(departments: any[], res: Response) {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Departments List');

    // Define Columns
    worksheet.columns = [
      { header: 'ID', key: 'id', width: 10 },
      { header: 'Department Name', key: 'name', width: 30 },
      { header: 'Status', key: 'status', width: 15 },
      { header: 'Total Users', key: 'userCount', width: 15 },
      { header: 'Total Categories', key: 'categoryCount', width: 18 },
      { header: 'Total Tickets', key: 'ticketCount', width: 15 },
      { header: 'Created Date', key: 'created_at', width: 22 },
    ];

    // Style Header Row
    const headerRow = worksheet.getRow(1);
    headerRow.height = 28;
    headerRow.eachCell((cell) => {
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF1E293B' }, // Slate 800
      };
      cell.font = {
        name: 'Segoe UI',
        bold: true,
        color: { argb: 'FFFFFFFF' },
        size: 11,
      };
      cell.alignment = {
        vertical: 'middle',
        horizontal: 'left',
        wrapText: true,
      };
    });

    // Populate Rows
    departments.forEach((dept) => {
      worksheet.addRow({
        id: dept.id,
        name: dept.name,
        status: dept.is_active !== false ? 'Active' : 'Inactive',
        userCount: dept._count?.users ?? 0,
        categoryCount: dept._count?.categories ?? 0,
        ticketCount: dept._count?.tickets ?? 0,
        created_at: dept.created_at ? new Date(dept.created_at).toLocaleString() : '—',
      });
    });

    // Style Data Rows
    const rowCount = worksheet.rowCount;
    for (let i = 2; i <= rowCount; i++) {
      const row = worksheet.getRow(i);
      row.height = 20;
      row.eachCell((cell) => {
        cell.font = { name: 'Segoe UI', size: 10 };
        cell.alignment = { vertical: 'middle', horizontal: 'left' };
      });
    }

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename=departments_export_${Date.now()}.xlsx`,
    );

    await workbook.xlsx.write(res);
    res.end();
  }
}

import * as ExcelJS from 'exceljs';
import { Response } from 'express';

export class UsersExporter {
  static async exportToExcel(users: any[], res: Response) {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Users List');

    // Define Columns
    worksheet.columns = [
      { header: 'ID', key: 'id', width: 10 },
      { header: 'Full Name', key: 'name', width: 25 },
      { header: 'Email Address', key: 'email', width: 32 },
      { header: 'Mobile Number', key: 'mobile', width: 18 },
      { header: 'Role', key: 'role', width: 16 },
      { header: 'Department', key: 'department', width: 22 },
      { header: 'Reporting Manager', key: 'reporting_manager', width: 25 },
      { header: 'HOD', key: 'hod', width: 25 },
      { header: 'Status', key: 'status', width: 12 },
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
    users.forEach((u) => {
      worksheet.addRow({
        id: u.id,
        name: u.name || '—',
        email: u.email || '—',
        mobile: u.mobile || '—',
        role: u.role ? String(u.role).toUpperCase() : '—',
        department: u.department?.name || u.department_name || '—',
        reporting_manager: u.reporting_manager?.name || '—',
        hod: u.hod?.name || '—',
        status: u.is_active !== false ? 'Active' : 'Inactive',
        created_at: u.created_at ? new Date(u.created_at).toLocaleString() : '—',
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
      `attachment; filename=users_export_${Date.now()}.xlsx`,
    );

    await workbook.xlsx.write(res);
    res.end();
  }
}

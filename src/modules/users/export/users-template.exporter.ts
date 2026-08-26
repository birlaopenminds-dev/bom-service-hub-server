import * as ExcelJS from 'exceljs';
import { Response } from 'express';

export class UsersTemplateExporter {
  static async generateTemplate(res: Response) {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Users Import Template');

    // Define Columns
    worksheet.columns = [
      { header: 'Full Name *', key: 'name', width: 25 },
      { header: 'Email Address *', key: 'email', width: 32 },
      { header: 'Password (Optional)', key: 'password', width: 25 },
      { header: 'Mobile Number', key: 'mobile', width: 18 },
      { header: 'Role (user/manager/hod/admin/super_admin) *', key: 'role', width: 48 },
      { header: 'Department Name', key: 'department', width: 22 },
      { header: 'Reporting Manager Email', key: 'reporting_manager_email', width: 32 },
      { header: 'HOD Email', key: 'hod_email', width: 32 },
    ];

    // Style Header Row
    const headerRow = worksheet.getRow(1);
    headerRow.height = 28;
    headerRow.eachCell((cell) => {
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF2563EB' }, // Primary Blue
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

    // Sample Row 1 - Regular User
    worksheet.addRow({
      name: 'John Smith',
      email: 'john.smith@example.com',
      password: 'Welcome@123',
      mobile: '+919876543210',
      role: 'user',
      department: 'IT Support',
      reporting_manager_email: 'sarah.manager@example.com',
      hod_email: 'david.hod@example.com',
    });

    // Sample Row 2 - Manager
    worksheet.addRow({
      name: 'Sarah Manager',
      email: 'sarah.manager@example.com',
      password: 'Welcome@123',
      mobile: '+919876543211',
      role: 'manager',
      department: 'IT Support',
      reporting_manager_email: '',
      hod_email: 'david.hod@example.com',
    });

    // Sample Row 3 - HOD
    worksheet.addRow({
      name: 'David HOD',
      email: 'david.hod@example.com',
      password: 'Welcome@123',
      mobile: '+919876543212',
      role: 'hod',
      department: 'IT Support',
      reporting_manager_email: '',
      hod_email: '',
    });

    // Style Sample Rows
    for (let i = 2; i <= 4; i++) {
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
      'attachment; filename=users_import_template.xlsx',
    );

    await workbook.xlsx.write(res);
    res.end();
  }
}

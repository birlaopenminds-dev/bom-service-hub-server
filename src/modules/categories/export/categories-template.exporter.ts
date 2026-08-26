import * as ExcelJS from 'exceljs';
import { Response } from 'express';

export class CategoriesTemplateExporter {
  static async generateTemplate(res: Response) {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Categories Import Template');

    // Define Columns
    worksheet.columns = [
      { header: 'Category Name *', key: 'name', width: 30 },
      { header: 'Department Name *', key: 'department', width: 28 },
      { header: 'Status (active/inactive)', key: 'is_active', width: 25 },
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

    // Sample Rows
    worksheet.addRow({
      name: 'Hardware Issues',
      department: 'IT Support',
      is_active: 'active',
    });

    worksheet.addRow({
      name: 'Software Licenses',
      department: 'IT Support',
      is_active: 'active',
    });

    worksheet.addRow({
      name: 'Payroll Queries',
      department: 'Human Resources',
      is_active: 'active',
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
      'attachment; filename=categories_import_template.xlsx',
    );

    await workbook.xlsx.write(res);
    res.end();
  }
}

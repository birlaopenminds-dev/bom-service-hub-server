import * as ExcelJS from 'exceljs';
import { Response } from 'express';

export class SubcategoriesTemplateExporter {
  static async generateTemplate(res: Response) {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Subcategories Import Template');

    // Define Columns
    worksheet.columns = [
      { header: 'Subcategory Name *', key: 'name', width: 30 },
      { header: 'Parent Category Name *', key: 'category', width: 30 },
      { header: 'Default Assignee Email *', key: 'assignee_email', width: 32 },
      { header: 'TAT Hours (e.g. 24)', key: 'tat_hours', width: 22 },
      { header: 'Status (active/inactive)', key: 'is_active', width: 22 },
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
      name: 'Laptop Replacement',
      category: 'Hardware Issues',
      assignee_email: 'john.smith@example.com',
      tat_hours: 24,
      is_active: 'active',
    });

    worksheet.addRow({
      name: 'Monitor & Accessories',
      category: 'Hardware Issues',
      assignee_email: 'sarah.manager@example.com',
      tat_hours: 12,
      is_active: 'active',
    });

    worksheet.addRow({
      name: 'MS Office License',
      category: 'Software Licenses',
      assignee_email: 'david.hod@example.com',
      tat_hours: 48,
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
      'attachment; filename=subcategories_import_template.xlsx',
    );

    await workbook.xlsx.write(res);
    res.end();
  }
}

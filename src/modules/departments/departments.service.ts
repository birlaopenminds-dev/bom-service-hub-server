import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import * as ExcelJS from 'exceljs';
import { Response } from 'express';
import { PaginationUtil } from '../../common/utils/pagination.util';
import { CreateDepartmentDto } from './dto/create-department.dto';
import { UpdateDepartmentDto } from './dto/update-department.dto';
import { ListDepartmentsDto } from './dto/list-departments.dto';
import { PrismaService } from '@providers/database/prisma.service';
import { DepartmentsExporter } from './export/departments.exporter';

@Injectable()
export class DepartmentsService {
  constructor(private prisma: PrismaService) { }

  async create(dto: CreateDepartmentDto) {
    const existing = await this.prisma.department.findUnique({
      where: { name: dto.name },
    });

    if (existing) {
      throw new ConflictException(`Department with name "${dto.name}" already exists.`);
    }

    return this.prisma.department.create({
      data: { name: dto.name },
    });
  }

  async findAll(query?: ListDepartmentsDto) {
    let page: number | undefined;
    let limit: number | undefined;
    let search: string | undefined;
    let is_active: boolean | undefined;

    if (query) {
      page = query.page ? Math.max(1, Number(query.page)) : undefined;
      limit = query.limit ? Math.max(1, Number(query.limit)) : undefined;
      search = query.search?.trim();

      if (query.is_active !== undefined && (query.is_active as any) !== 'ALL' && query.is_active !== null) {
        is_active =
          typeof query.is_active === 'boolean'
            ? query.is_active
            : String(query.is_active).toLowerCase() === 'true';
      }
    }

    const where: any = {};

    if (search) where.name = { contains: search, mode: 'insensitive' };
    if (is_active !== undefined) where.is_active = is_active;

    const include = {
      _count: {
        select: { users: true, categories: true, tickets: true },
      },
    };

    if (page || limit) {
      const currentPage = page || 1;
      const currentLimit = limit || 10;
      const total = await this.prisma.department.count({ where });
      const skip = (currentPage - 1) * currentLimit;

      const departments = await this.prisma.department.findMany({
        where,
        skip,
        take: currentLimit,
        orderBy: { created_at: 'desc' },
        include,
      });

      return PaginationUtil.buildPaginatedResult(departments, total, currentPage, currentLimit);
    }

    const departments = await this.prisma.department.findMany({
      where,
      orderBy: { created_at: 'desc' },
      include,
    });

    return {
      data: departments,
    };
  }

  async getDropdown(isActive = true) {
    const where: any = {};
    if (isActive !== undefined) {
      where.is_active = isActive;
    }

    const departments = await this.prisma.department.findMany({
      where,
      select: {
        id: true,
        name: true,
        is_active: true,
      },
      orderBy: { name: 'asc' },
    });
    return { data: departments };
  }

  async findOne(id: number) {
    const department = await this.prisma.department.findUnique({
      where: { id },
      include: {
        categories: true,
        users: { select: { id: true, name: true, email: true, role: true } },
      },
    });

    if (!department) {
      throw new NotFoundException(`Department with ID "${id}" not found.`);
    }

    return department;
  }

  async update(id: number, dto: UpdateDepartmentDto) {
    await this.findOne(id);

    if (dto.name) {
      const existing = await this.prisma.department.findUnique({
        where: { name: dto.name },
      });
      if (existing && existing.id !== id) {
        throw new ConflictException(`Department with name "${dto.name}" already exists.`);
      }
    }

    return this.prisma.department.update({
      where: { id },
      data: dto,
    });
  }

  async toggleStatus(id: number) {
    const department = await this.findOne(id);

    return this.prisma.department.update({
      where: { id },
      data: { is_active: !department.is_active },
    });
  }

  async remove(id: number) {
    await this.findOne(id);

    return this.prisma.department.update({
      where: { id },
      data: { is_active: false },
    });
  }

  // Bulk import departments from uploaded Excel file (.xlsx or .xls)
  async importDepartmentsFromExcel(file: Express.Multer.File) {
    if (!file || !file.buffer) {
      throw new BadRequestException('Please upload a valid Excel file (.xlsx or .xls).');
    }

    const workbook = new ExcelJS.Workbook();
    try {
      await workbook.xlsx.load(file.buffer as any);
    } catch (err: any) {
      throw new BadRequestException(`Failed to parse Excel file: ${err.message}`);
    }

    const worksheet = workbook.worksheets[0];
    if (!worksheet) {
      throw new BadRequestException('Uploaded Excel file contains no worksheets.');
    }

    const createdDepartments: any[] = [];
    const errors: { row: number; name?: string; reason: string }[] = [];
    let totalRows = 0;
    let successCount = 0;
    let failureCount = 0;

    const getCellValue = (row: ExcelJS.Row, colIndex: number): string => {
      const cell = row.getCell(colIndex);
      if (!cell || cell.value === null || cell.value === undefined) return '';
      if (typeof cell.value === 'object') {
        if ('text' in cell.value && cell.value.text) return String(cell.value.text).trim();
        if ('result' in cell.value && cell.value.result) return String(cell.value.result).trim();
        if ('richText' in cell.value && Array.isArray((cell.value as any).richText)) {
          return (cell.value as any).richText.map((rt: any) => rt.text).join('').trim();
        }
      }
      return String(cell.value).trim();
    };

    const rowCount = worksheet.rowCount;

    for (let rowNum = 2; rowNum <= rowCount; rowNum++) {
      const row = worksheet.getRow(rowNum);

      const name = getCellValue(row, 1);
      const statusStr = getCellValue(row, 2).toLowerCase();

      // Skip empty row
      if (!name) {
        continue;
      }

      totalRows++;

      // Check existing department by name (case-insensitive search)
      const existing = await this.prisma.department.findFirst({
        where: { name: { equals: name, mode: 'insensitive' } },
      });

      if (existing) {
        failureCount++;
        errors.push({
          row: rowNum,
          name,
          reason: `Department "${name}" already exists in the system.`,
        });
        continue;
      }

      const isActive = statusStr ? statusStr === 'active' || statusStr === 'true' : true;

      try {
        const created = await this.prisma.department.create({
          data: {
            name,
            is_active: isActive,
          },
        });
        createdDepartments.push(created);
        successCount++;
      } catch (err: any) {
        failureCount++;
        errors.push({
          row: rowNum,
          name,
          reason: err.message || 'Database error creating department.',
        });
      }
    }

    return {
      message: `Excel import completed: ${successCount} department(s) created, ${failureCount} failed/skipped.`,
      summary: {
        totalRows,
        successCount,
        failureCount,
        createdDepartments,
        errors,
      },
    };
  }

  // Export departments to Excel spreadsheet download
  async exportDepartmentsToExcel(res: Response) {
    const departments = await this.prisma.department.findMany({
      orderBy: { created_at: 'desc' },
      include: {
        _count: {
          select: { users: true, categories: true, tickets: true },
        },
      },
    });

    return DepartmentsExporter.exportToExcel(departments, res);
  }
}


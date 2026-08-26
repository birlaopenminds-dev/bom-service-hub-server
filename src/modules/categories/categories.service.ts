import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import * as ExcelJS from 'exceljs';
import { PrismaService } from '../../providers/database/prisma.service';
import { PaginationUtil } from '../../common/utils/pagination.util';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { ListCategoriesDto } from './dto/list-categories.dto';

@Injectable()
export class CategoriesService {
  constructor(private prisma: PrismaService) { }

  async create(dto: CreateCategoryDto) {
    const department = await this.prisma.department.findUnique({
      where: { id: dto.department_id },
    });

    if (!department) throw new NotFoundException(`Department with ID "${dto.department_id}" not found.`);

    const existing = await this.prisma.category.findUnique({
      where: {
        department_id_name: {
          department_id: dto.department_id,
          name: dto.name,
        },
      },
    });

    if (existing) {
      throw new ConflictException(
        `Category "${dto.name}" already exists in this department.`,
      );
    }

    return this.prisma.category.create({
      data: {
        department_id: dto.department_id,
        name: dto.name,
      },
      include: { department: { select: { id: true, name: true } } },
    });
  }

  async findAll(query?: ListCategoriesDto) {
    let page: number | undefined;
    let limit: number | undefined;
    let search: string | undefined;
    let department_id: number | undefined;
    let is_active: boolean | undefined;

    if (query) {
      page = query.page ? Math.max(1, Number(query.page)) : undefined;
      limit = query.limit ? Math.max(1, Number(query.limit)) : undefined;
      search = query.search?.trim();
      department_id = query.department_id ? Number(query.department_id) : undefined;

      const activeValue = query.is_active !== undefined ? query.is_active : query.activeOnly;
      if (activeValue !== undefined && (activeValue as any) !== 'ALL' && activeValue !== null) {
        is_active =
          typeof activeValue === 'boolean'
            ? activeValue
            : String(activeValue).toLowerCase() === 'true';
      }
    }

    const where: any = {};

    if (search) {
      where.name = { contains: search, mode: 'insensitive' };
    }
    if (department_id) {
      where.department_id = department_id;
    }
    if (is_active !== undefined) {
      where.is_active = is_active;
    }

    const include = {
      department: { select: { id: true, name: true } },
      _count: {
        select: { subcategories: true, tickets: true },
      },
    };

    if (page || limit) {
      const currentPage = page || 1;
      const currentLimit = limit || 10;
      const total = await this.prisma.category.count({ where });
      const skip = (currentPage - 1) * currentLimit;

      const categories = await this.prisma.category.findMany({
        where,
        skip,
        take: currentLimit,
        orderBy: { created_at: 'desc' },
        include,
      });

      return PaginationUtil.buildPaginatedResult(categories, total, currentPage, currentLimit);
    }

    const categories = await this.prisma.category.findMany({
      where,
      orderBy: { created_at: 'desc' },
      include,
    });

    return {
      data: categories,
    };
  }

  async getDropdown(department_id?: number, is_active = true) {
    const where: any = {};
    if (department_id) {
      where.department_id = department_id;
    }
    if (is_active !== undefined) {
      where.is_active = is_active;
    }
    const categories = await this.prisma.category.findMany({
      where,
      select: {
        id: true,
        name: true,
        department_id: true,
        is_active: true,
      },
      orderBy: { name: 'asc' },
    });
    return { data: categories };
  }

  async findOne(id: number) {
    const category = await this.prisma.category.findUnique({
      where: { id },
      include: {
        department: true,
        subcategories: {
          include: {
            default_assignee: { select: { id: true, name: true, email: true } },
          },
        },
      },
    });

    if (!category) {
      throw new NotFoundException(`Category with ID "${id}" not found.`);
    }

    return category;
  }

  async update(id: number, dto: UpdateCategoryDto) {
    const category = await this.findOne(id);

    if (dto.name && dto.name !== category.name) {
      const existing = await this.prisma.category.findUnique({
        where: {
          department_id_name: {
            department_id: category.department_id,
            name: dto.name,
          },
        },
      });

      if (existing) {
        throw new ConflictException(
          `Category "${dto.name}" already exists in this department.`,
        );
      }
    }

    return this.prisma.category.update({
      where: { id },
      data: dto,
    });
  }

  async toggle(id: number) {
    const category = await this.findOne(id);
    return this.prisma.category.update({
      where: { id },
      data: { is_active: !category.is_active },
    });
  }

  async remove(id: number) {
    await this.findOne(id);

    return this.prisma.category.update({
      where: { id },
      data: { is_active: false },
    });
  }

  // Bulk import categories from uploaded Excel file (.xlsx or .xls)
  async importCategoriesFromExcel(file: Express.Multer.File) {
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

    const createdCategories: any[] = [];
    const errors: { row: number; name?: string; departmentName?: string; reason: string }[] = [];
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
      const departmentName = getCellValue(row, 2);
      const statusStr = getCellValue(row, 3).toLowerCase();

      // Skip empty row
      if (!name && !departmentName) {
        continue;
      }

      totalRows++;

      if (!name) {
        failureCount++;
        errors.push({ row: rowNum, name, departmentName, reason: 'Category Name is required.' });
        continue;
      }

      if (!departmentName) {
        failureCount++;
        errors.push({ row: rowNum, name, departmentName, reason: 'Department Name is required.' });
        continue;
      }

      // Look up Department by name (case-insensitive)
      const department = await this.prisma.department.findFirst({
        where: { name: { equals: departmentName, mode: 'insensitive' } },
      });

      if (!department) {
        failureCount++;
        errors.push({
          row: rowNum,
          name,
          departmentName,
          reason: `Department "${departmentName}" not found in system.`,
        });
        continue;
      }

      // Check existing category under this department (case-insensitive)
      const existing = await this.prisma.category.findFirst({
        where: {
          department_id: department.id,
          name: { equals: name, mode: 'insensitive' },
        },
      });

      if (existing) {
        failureCount++;
        errors.push({
          row: rowNum,
          name,
          departmentName,
          reason: `Category "${name}" already exists in department "${department.name}".`,
        });
        continue;
      }

      const isActive = statusStr ? statusStr === 'active' || statusStr === 'true' : true;

      try {
        const created = await this.prisma.category.create({
          data: {
            department_id: department.id,
            name,
            is_active: isActive,
          },
          include: { department: { select: { id: true, name: true } } },
        });
        createdCategories.push(created);
        successCount++;
      } catch (err: any) {
        failureCount++;
        errors.push({
          row: rowNum,
          name,
          departmentName,
          reason: err.message || 'Database error creating category.',
        });
      }
    }

    return {
      message: `Excel import completed: ${successCount} category(ies) created, ${failureCount} failed/skipped.`,
      summary: {
        totalRows,
        successCount,
        failureCount,
        createdCategories,
        errors,
      },
    };
  }
}


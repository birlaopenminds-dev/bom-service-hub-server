import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
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
}

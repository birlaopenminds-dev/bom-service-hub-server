import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../providers/database/prisma.service';
import { PaginationUtil } from '../../common/utils/pagination.util';
import { CreateSubcategoryDto } from './dto/create-subcategory.dto';
import { UpdateSubcategoryDto } from './dto/update-subcategory.dto';
import { ListSubcategoriesDto } from './dto/list-subcategories.dto';

@Injectable()
export class SubcategoriesService {
  constructor(private prisma: PrismaService) { }

  async create(dto: CreateSubcategoryDto) {
    const category = await this.prisma.category.findUnique({
      where: { id: dto.category_id },
    });

    if (!category) {
      throw new NotFoundException(`Category with ID "${dto.category_id}" not found.`);
    }

    if (dto.default_assignee_id) {
      const assignee = await this.prisma.user.findUnique({
        where: { id: dto.default_assignee_id },
      });
      if (!assignee) {
        throw new NotFoundException(
          `Default assignee user with ID "${dto.default_assignee_id}" not found.`,
        );
      }
    }

    const existing = await this.prisma.subcategory.findUnique({
      where: {
        category_id_name: {
          category_id: dto.category_id,
          name: dto.name,
        },
      },
    });

    if (existing) {
      throw new ConflictException(
        `Subcategory "${dto.name}" already exists in this category.`,
      );
    }

    return this.prisma.subcategory.create({
      data: {
        category_id: dto.category_id,
        name: dto.name,
        default_assignee_id: dto.default_assignee_id || null,
        tat_hours: dto.tat_hours || 24,
      },
      include: {
        category: { select: { id: true, name: true, department_id: true } },
        default_assignee: { select: { id: true, name: true, email: true } },
      },
    });
  }

  async findAll(query?: ListSubcategoriesDto) {
    let page: number | undefined;
    let limit: number | undefined;
    let search: string | undefined;
    let category_id: number | undefined;
    let department_id: number | undefined;
    let default_assignee_id: number | undefined;
    let is_active: boolean | undefined;

    if (query) {
      page = query.page ? Math.max(1, Number(query.page)) : undefined;
      limit = query.limit ? Math.max(1, Number(query.limit)) : undefined;
      search = query.search?.trim();
      category_id = query.category_id ? Number(query.category_id) : undefined;
      department_id = query.department_id ? Number(query.department_id) : undefined;
      default_assignee_id = query.default_assignee_id ? Number(query.default_assignee_id) : undefined;

      const activeValue = query.is_active;
      if (activeValue !== undefined) {
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
    if (category_id) {
      where.category_id = category_id;
    }
    if (department_id) {
      where.category = { department_id };
    }
    if (default_assignee_id) {
      where.default_assignee_id = default_assignee_id;
    }
    if (is_active !== undefined) {
      where.is_active = is_active;
    }

    const include = {
      category: { select: { id: true, name: true, department_id: true, department: { select: { id: true, name: true } } } },
      default_assignee: { select: { id: true, name: true, email: true } },
      _count: {
        select: { tickets: true },
      },
    };

    if (page || limit) {
      const currentPage = page || 1;
      const currentLimit = limit || 10;
      const total = await this.prisma.subcategory.count({ where });
      const skip = (currentPage - 1) * currentLimit;

      const subcategories = await this.prisma.subcategory.findMany({
        where,
        skip,
        take: currentLimit,
        orderBy: { created_at: 'desc' },
        include,
      });

      return PaginationUtil.buildPaginatedResult(subcategories, total, currentPage, currentLimit);
    }

    const subcategories = await this.prisma.subcategory.findMany({
      where,
      orderBy: { created_at: 'desc' },
      include,
    });

    return {
      data: subcategories,
    };
  }

  async getDropdown(category_id?: number, is_active = true, default_assignee_id?: number) {
    const where: any = {};
    if (category_id) where.category_id = category_id;
    if (is_active !== undefined) where.is_active = is_active;
    if (default_assignee_id) where.default_assignee_id = default_assignee_id

    const subcategories = await this.prisma.subcategory.findMany({
      where,
      select: {
        id: true,
        name: true,
        category_id: true,
        default_assignee_id: true,
        tat_hours: true,
        is_active: true,
      },
      orderBy: { name: 'asc' },
    });
    return { data: subcategories };
  }

  async findOne(id: number) {
    const subcategory = await this.prisma.subcategory.findUnique({
      where: { id },
      include: {
        category: { include: { department: true } },
        default_assignee: { select: { id: true, name: true, email: true, role: true } },
      },
    });

    if (!subcategory) throw new NotFoundException(`Subcategory with ID "${id}" not found.`);

    return subcategory;
  }

  async update(id: number, dto: UpdateSubcategoryDto) {
    const subcategory = await this.findOne(id);

    if (dto.name && dto.name !== subcategory.name) {
      const existing = await this.prisma.subcategory.findUnique({
        where: {
          category_id_name: {
            category_id: subcategory.category_id,
            name: dto.name,
          },
        },
      });

      if (existing) {
        throw new ConflictException(
          `Subcategory "${dto.name}" already exists in this category.`,
        );
      }
    }

    if (dto.default_assignee_id) {
      const assignee = await this.prisma.user.findUnique({
        where: { id: dto.default_assignee_id },
      });
      if (!assignee) {
        throw new NotFoundException(
          `Default assignee user with ID "${dto.default_assignee_id}" not found.`,
        );
      }
    }

    return this.prisma.subcategory.update({
      where: { id },
      data: dto,
      include: {
        default_assignee: { select: { id: true, name: true, email: true } },
      },
    });
  }

  async toggleStatus(id: number) {
    const subcategory = await this.findOne(id);

    return this.prisma.subcategory.update({
      where: { id },
      data: { is_active: !subcategory.is_active },
    });
  }

  async remove(id: number) {
    await this.findOne(id);

    return this.prisma.subcategory.update({
      where: { id },
      data: { is_active: false },
    });
  }
}

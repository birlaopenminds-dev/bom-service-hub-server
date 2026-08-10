import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PaginationUtil } from '../../common/utils/pagination.util';
import { CreateDepartmentDto } from './dto/create-department.dto';
import { UpdateDepartmentDto } from './dto/update-department.dto';
import { ListDepartmentsDto } from './dto/list-departments.dto';
import { PrismaService } from '@providers/database/prisma.service';

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
}

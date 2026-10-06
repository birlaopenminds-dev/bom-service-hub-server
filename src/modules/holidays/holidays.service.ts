import {
  Injectable,
  Logger,
  OnModuleInit,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../providers/database/prisma.service';
import { CreateHolidayDto } from './dto/create-holiday.dto';
import { UpdateHolidayDto } from './dto/update-holiday.dto';
import { ListHolidaysDto } from './dto/list-holidays.dto';
import { format, addDays, parseISO, isValid } from 'date-fns';
import { PaginationUtil } from '../../common/utils/pagination.util';

@Injectable()
export class HolidaysService implements OnModuleInit {
  private readonly logger = new Logger(HolidaysService.name);

  /**
   * Fast In-Memory Cache for Active Holidays.
   * Stored as a Set of 'YYYY-MM-DD' strings (e.g., '2026-10-02')
   * for O(1) instantaneous lookup without querying PostgreSQL on every SLA calculation.
   */
  private holidayCache = new Set<string>();

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Automatically warm up the holiday cache when NestJS boots up.
   */
  async onModuleInit() {
    await this.refreshHolidayCache();
  }

  /**
   * Fetches all active holidays from the database and rebuilds the in-memory Set.
   * This is invoked on server startup and whenever a holiday is created, updated, or deleted.
   */
  async refreshHolidayCache(): Promise<void> {
    try {
      const activeHolidays = await this.prisma.holiday.findMany({
        where: { is_active: true },
        select: { date: true, name: true },
      });

      const newSet = new Set<string>();
      for (const h of activeHolidays) {
        const dateKey = this.formatDateKey(h.date);
        newSet.add(dateKey);
      }

      this.holidayCache = newSet;
      this.logger.log(`Holiday cache refreshed. Loaded ${this.holidayCache.size} active holidays.`);
    } catch (error) {
      this.logger.error('Failed to refresh holiday cache', error);
    }
  }

  // =========================================================================================
  // CORE CALENDAR & SLA CALCULATION ENGINE
  // =========================================================================================

  /**
   * Formats any Date or ISO string into a normalized 'yyyy-MM-dd' calendar key.
   * @param date Date object or string
   */
  formatDateKey(date: Date | string): string {
    const d = typeof date === 'string' ? parseISO(date) : date;
    return format(d, 'yyyy-MM-dd');
  }

  /**
   * Checks if a given date falls on a fixed weekend (Saturday or Sunday).
   * In JavaScript getDay():
   * 0 = Sunday
   * 6 = Saturday
   */
  isWeekend(date: Date): boolean {
    const day = date.getDay();
    return day === 0 || day === 6;
  }

  /**
   * Checks if a given date falls on an approved active organization holiday
   * (e.g. Gandhi Jayanti, Diwali, Navratri, etc.).
   */
  isHoliday(date: Date): boolean {
    const key = this.formatDateKey(date);
    return this.holidayCache.has(key);
  }

  /**
   * Returns true if the date is NOT a business working day
   * (i.e. it is either Saturday, Sunday, or an active public/company holiday).
   */
  isNonWorkingDay(date: Date): boolean {
    return this.isWeekend(date) || this.isHoliday(date);
  }

  /**
   * Returns true if the date is a legitimate working business day.
   */
  isWorkingDay(date: Date): boolean {
    return !this.isNonWorkingDay(date);
  }

  /**
   * Given any date, rolls forward to the nearest future working day.
   * If the input date is already a working day, it is returned unchanged.
   */
  getNextWorkingDay(startDate: Date): Date {
    let curr = new Date(startDate);
    while (this.isNonWorkingDay(curr)) {
      curr = addDays(curr, 1);
    }
    return curr;
  }

  /**
   * =======================================================================================
   * BUSINESS-AWARE SLA DUE DATE CALCULATION
   * =======================================================================================
   *
   * Architectural Algorithm Walkthrough:
   * ------------------------------------
   * 1. TAT Interpretation:
   *    In enterprise service desks, Turn-Around Time (TAT) is commonly specified in hours:
   *    - 24 Hours = 1 Full Business Day
   *    - 48 Hours = 2 Full Business Days
   *    - 72 Hours = 3 Full Business Days
   *
   * 2. Edge Case - Ticket Created on a Non-Working Day (Weekend / Holiday):
   *    Suppose someone submits a ticket on Saturday at 2:00 PM or Sunday at 10:00 AM.
   *    Since offices/support teams are closed, the SLA clock CANNOT tick on weekends.
   *    The ticket's created_at remains untouched, and the SLA reference clock automatically
   *    starts on the NEXT working business day morning at 09:30 AM.
   *
   * 3. Business Days Addition (Skipping Sat, Sun & Holidays):
   *    Suppose a ticket is created on Friday at 5:00 PM with a 24h TAT (1 working day):
   *    - Day 1 forward is Saturday -> SKIPPED (Weekend)
   *    - Day 2 forward is Sunday   -> SKIPPED (Weekend)
   *    - Day 3 forward is Monday   -> Check if Monday is Gandhi Jayanti / Holiday:
   *        - If YES (Holiday)     -> SKIPPED
   *        - If NO (Working Day)  -> 1st Working Day completed! Target = Monday at 5:00 PM.
   *
   * 4. Granular / Remaining Hours:
   *    If tatHours is not an exact multiple of 24 (e.g. 30 hours = 1 day + 6 hours),
   *    the remaining hours are added, and if the final timestamp touches non-working hours/days,
   *    it shifts smoothly forward.
   *
   * @param startDate The ticket creation date/time (or base start date)
   * @param tatHours The Turn-Around Time in hours (e.g. 24, 48, 72)
   * @returns Date The calculated SLA breach due date (`due_at`)
   */
  calculateSlaDueDate(startDate: Date, tatHours: number): Date {
    if (!tatHours || tatHours <= 0) {
      tatHours = 24; // Default fallback to 24h
    }

    let cursor = new Date(startDate);

    // -----------------------------------------------------------------------------------
    // STEP 1: Adjust for creation on weekends or public holidays (Off-day creation)
    // -----------------------------------------------------------------------------------
    // Note: ticket.created_at is NEVER modified and always preserves the exact time of user submission.
    // If a ticket is raised on an off-day (Saturday, Sunday, or official company holiday),
    // the SLA reference clock for due_at begins on the NEXT valid working business day at 09:30 AM.
    if (this.isNonWorkingDay(cursor)) {
      cursor = this.getNextWorkingDay(cursor);
      cursor.setHours(9, 30, 0, 0); // Start official SLA countdown from 09:30 AM on next working day
    }

    // -----------------------------------------------------------------------------------
    // STEP 2: Calculate full working days and remaining hours
    // -----------------------------------------------------------------------------------
    // For 24h -> 1 working day, 0 remaining hours
    // For 48h -> 2 working days, 0 remaining hours
    // For 72h -> 3 working days, 0 remaining hours
    const fullWorkingDays = Math.floor(tatHours / 24);
    const remainingHours = tatHours % 24;

    // -----------------------------------------------------------------------------------
    // STEP 3: Advance cursor by the required number of working days
    // -----------------------------------------------------------------------------------
    let workingDaysAdded = 0;
    while (workingDaysAdded < fullWorkingDays) {
      cursor = addDays(cursor, 1);
      // Only count days that are NOT weekends and NOT holidays
      if (this.isWorkingDay(cursor)) {
        workingDaysAdded++;
      }
    }

    // -----------------------------------------------------------------------------------
    // STEP 4: Add any fractional remaining hours (if tatHours is not a multiple of 24)
    // -----------------------------------------------------------------------------------
    if (remainingHours > 0) {
      cursor.setHours(cursor.getHours() + remainingHours);
      // If adding hours pushed us into a weekend or holiday, shift to next working day
      if (this.isNonWorkingDay(cursor)) {
        const savedHours = cursor.getHours();
        const savedMinutes = cursor.getMinutes();
        cursor = this.getNextWorkingDay(cursor);
        cursor.setHours(savedHours, savedMinutes, 0, 0);
      }
    }

    return cursor;
  }

  /**
   * Helper used by Escalation Cron Jobs.
   * Calculates whether `requiredWorkingHours` (e.g., 48h for Stage 2, 72h for Stage 3)
   * have legitimately elapsed since `escalatedAt`, strictly excluding weekends and holidays.
   */
  addWorkingHours(startDate: Date, hours: number): Date {
    return this.calculateSlaDueDate(startDate, hours);
  }

  // =========================================================================================
  // HOLIDAY MANAGEMENT CRUD (For Admins & HR)
  // =========================================================================================

  /**
   * Create a new holiday entry (e.g., 'Diwali', '2026-11-08')
   */
  async create(dto: CreateHolidayDto) {
    const parsedDate = parseISO(dto.date);
    if (!isValid(parsedDate)) {
      throw new ConflictException('Invalid date format. Expected YYYY-MM-DD');
    }

    const normalizedDate = new Date(this.formatDateKey(parsedDate));

    // Check if holiday with same date already exists
    const existing = await this.prisma.holiday.findUnique({
      where: { date: normalizedDate },
    });

    if (existing) {
      throw new ConflictException(
        `Holiday for date ${dto.date} already exists: "${existing.name}".`,
      );
    }

    const holiday = await this.prisma.holiday.create({
      data: {
        name: dto.name.trim(),
        date: normalizedDate,
        is_active: dto.is_active ?? true,
      },
    });

    // Invalidate and refresh cache immediately
    await this.refreshHolidayCache();

    return {
      message: 'Holiday created successfully',
      holiday,
    };
  }

  /**
   * List all holidays with pagination, search, optional filtering by year and active status
   */
  async findAll(query: ListHolidaysDto) {
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

    if (search) {
      where.name = { contains: search, mode: 'insensitive' };
    }

    if (is_active !== undefined) {
      where.is_active = is_active;
    }

    if (query?.year) {
      const yearStart = new Date(`${query.year}-01-01T00:00:00.000Z`);
      const yearEnd = new Date(`${query.year}-12-31T23:59:59.999Z`);
      where.date = {
        gte: yearStart,
        lte: yearEnd,
      };
    }

    if (page || limit) {
      const currentPage = page || 1;
      const currentLimit = limit || 10;
      const total = await this.prisma.holiday.count({ where });
      const skip = (currentPage - 1) * currentLimit;

      const holidays = await this.prisma.holiday.findMany({
        where,
        skip,
        take: currentLimit,
        orderBy: { date: 'asc' },
      });

      const formatted = holidays.map((h) => ({
        ...h,
        date_formatted: format(h.date, 'yyyy-MM-dd'),
      }));

      return PaginationUtil.buildPaginatedResult(formatted, total, currentPage, currentLimit);
    }

    const holidays = await this.prisma.holiday.findMany({
      where,
      orderBy: { date: 'asc' },
    });

    return {
      data: holidays.map((h) => ({
        ...h,
        date_formatted: format(h.date, 'yyyy-MM-dd'),
      })),
      count: holidays.length,
    };
  }

  /**
   * Toggle holiday active status
   */
  async toggleStatus(id: number) {
    const holiday = await this.findOne(id);
    const updated = await this.prisma.holiday.update({
      where: { id },
      data: { is_active: !holiday.is_active },
    });
    await this.refreshHolidayCache();
    return {
      message: `Holiday status updated to ${updated.is_active ? 'active' : 'inactive'} successfully.`,
      data: updated,
    };
  }

  /**
   * Get single holiday by ID
   */
  async findOne(id: number) {
    const holiday = await this.prisma.holiday.findUnique({ where: { id } });
    if (!holiday) {
      throw new NotFoundException(`Holiday with ID ${id} not found`);
    }
    return holiday;
  }

  /**
   * Update holiday details
   */
  async update(id: number, dto: UpdateHolidayDto) {
    await this.findOne(id);

    const data: any = {};
    if (dto.name !== undefined) data.name = dto.name.trim();
    if (dto.is_active !== undefined) data.is_active = dto.is_active;
    if (dto.date !== undefined) {
      const parsed = parseISO(dto.date);
      if (!isValid(parsed)) throw new ConflictException('Invalid date format');
      data.date = new Date(this.formatDateKey(parsed));
    }

    const updated = await this.prisma.holiday.update({
      where: { id },
      data,
    });

    await this.refreshHolidayCache();

    return {
      message: 'Holiday updated successfully',
      holiday: updated,
    };
  }

  /**
   * Delete a holiday
   */
  async remove(id: number) {
    await this.findOne(id);

    await this.prisma.holiday.delete({ where: { id } });
    await this.refreshHolidayCache();

    return {
      message: 'Holiday removed successfully',
    };
  }
}

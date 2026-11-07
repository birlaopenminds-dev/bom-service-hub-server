import { PrismaClient, TicketStatus } from '@prisma/client';
import { format, addDays, parseISO } from 'date-fns';

const prisma = new PrismaClient();

interface RecalculateOptions {
  isDryRun: boolean;
  resetPrematureEscalation: boolean;
}

class SlaCalculator {
  private holidayCache = new Set<string>();

  async init(prismaClient: PrismaClient) {
    const activeHolidays = await prismaClient.holiday.findMany({
      where: { is_active: true },
      select: { date: true, name: true },
    });

    for (const h of activeHolidays) {
      const key = this.formatDateKey(h.date);
      this.holidayCache.add(key);
    }

    console.log(`[Calendar] Loaded ${this.holidayCache.size} active company/public holidays from database.`);
  }

  formatDateKey(date: Date | string): string {
    const d = typeof date === 'string' ? parseISO(date) : date;
    return format(d, 'yyyy-MM-dd');
  }

  isWeekend(date: Date): boolean {
    const day = date.getDay();
    return day === 0 || day === 6; // Sunday = 0, Saturday = 6
  }

  isHoliday(date: Date): boolean {
    const key = this.formatDateKey(date);
    return this.holidayCache.has(key);
  }

  isNonWorkingDay(date: Date): boolean {
    return this.isWeekend(date) || this.isHoliday(date);
  }

  isWorkingDay(date: Date): boolean {
    return !this.isNonWorkingDay(date);
  }

  getNextWorkingDay(startDate: Date): Date {
    let curr = new Date(startDate);
    while (this.isNonWorkingDay(curr)) {
      curr = addDays(curr, 1);
    }
    return curr;
  }

  /**
   * If a date falls on a weekend or company holiday, rolls it forward to the
   * next legitimate working business day while preserving the exact time of day.
   */
  rollForwardIfNonWorking(date: Date): Date {
    let curr = new Date(date);
    if (!this.isNonWorkingDay(curr)) {
      return curr;
    }
    const savedHours = curr.getHours();
    const savedMinutes = curr.getMinutes();
    const savedSeconds = curr.getSeconds();
    const savedMs = curr.getMilliseconds();

    curr = this.getNextWorkingDay(curr);
    curr.setHours(savedHours, savedMinutes, savedSeconds, savedMs);
    return curr;
  }

  calculateSlaDueDate(startDate: Date, tatHours: number): Date {
    if (!tatHours || tatHours <= 0) {
      tatHours = 24; // Default fallback
    }

    let cursor = new Date(startDate);

    // STEP 1: Adjust for creation on weekends or public holidays (Off-day creation)
    if (this.isNonWorkingDay(cursor)) {
      cursor = this.getNextWorkingDay(cursor);
      cursor.setHours(9, 30, 0, 0); // Start official SLA countdown from 09:30 AM on next working day
    }

    // STEP 2: Calculate full working days and remaining hours
    const fullWorkingDays = Math.floor(tatHours / 24);
    const remainingHours = tatHours % 24;

    // STEP 3: Advance cursor by the required number of working days
    let workingDaysAdded = 0;
    while (workingDaysAdded < fullWorkingDays) {
      cursor = addDays(cursor, 1);
      if (this.isWorkingDay(cursor)) {
        workingDaysAdded++;
      }
    }

    // STEP 4: Add any fractional remaining hours
    if (remainingHours > 0) {
      cursor.setHours(cursor.getHours() + remainingHours);
      if (this.isNonWorkingDay(cursor)) {
        const savedHours = cursor.getHours();
        const savedMinutes = cursor.getMinutes();
        cursor = this.getNextWorkingDay(cursor);
        cursor.setHours(savedHours, savedMinutes, 0, 0);
      }
    }

    return cursor;
  }
}

async function main() {
  const args = process.argv.slice(2);
  const isApply = args.includes('--apply') || args.includes('--execute');
  const isDryRun = !isApply;
  const resetPrematureEscalation = args.includes('--reset-escalations') || true;

  console.log('========================================================================');
  console.log('  BOM ServiceHub - SLA Due Date Recalculation & Holiday Alignment Tool');
  console.log('========================================================================');
  console.log(`Mode: ${isDryRun ? 'DRY-RUN (Simulating changes only, DB will NOT be modified)' : 'EXECUTE (Writing changes to database)'}`);
  console.log('------------------------------------------------------------------------\n');

  const calculator = new SlaCalculator();
  await calculator.init(prisma);

  // Explicitly target active tickets: OPEN and WIP (Work In Progress)
  const activeTickets = await prisma.ticket.findMany({
    where: {
      status: { in: [TicketStatus.open, TicketStatus.wip] },
    },
    include: {
      subcategory: {
        select: {
          name: true,
          tat_hours: true,
        },
      },
      logs: {
        where: {
          action: { in: ['DUE_DATE_UPDATED', 'SLA_DUE_DATE_UPDATED'] },
        },
        orderBy: { id: 'desc' },
        take: 1,
      },
    },
    orderBy: { id: 'asc' },
  });

  const openCount = activeTickets.filter((t) => t.status === TicketStatus.open).length;
  const wipCount = activeTickets.filter((t) => t.status === TicketStatus.wip).length;

  console.log(`Found ${activeTickets.length} active ticket(s) in database (OPEN: ${openCount}, WIP: ${wipCount}).\n`);

  if (activeTickets.length === 0) {
    console.log('No active (OPEN/WIP) tickets found. Exiting.');
    return;
  }

  const now = new Date();
  let modifiedCount = 0;
  let prematureEscalationResetCount = 0;
  let skippedPastCount = 0;
  let skippedValidWorkingDayCount = 0;

  for (const ticket of activeTickets) {
    const tatHours = ticket.subcategory?.tat_hours || 24;
    const oldDueAt = new Date(ticket.due_at);

    // CRITICAL FILTER: Only touch tickets whose expiry is on the UPCOMING weekend and holidays (not previous/past)
    const isUpcoming = oldDueAt >= now;
    const isNonWorking = calculator.isNonWorkingDay(oldDueAt);

    if (!isUpcoming) {
      skippedPastCount++;
      continue; // Expiry was in the past -> DO NOT TOUCH
    }

    if (!isNonWorking) {
      skippedValidWorkingDayCount++;
      continue; // Expiry is already on a legitimate business working day -> DO NOT TOUCH
    }

    // Roll the upcoming weekend/holiday deadline forward to the next working business day
    const newDueAt = calculator.rollForwardIfNonWorking(oldDueAt);

    const oldTime = oldDueAt.getTime();
    const newTime = newDueAt.getTime();

    // Check if difference is greater than 1 minute (to avoid tiny millisecond drift)
    const isDifferent = Math.abs(newTime - oldTime) > 60 * 1000;

    const willPrematureEscalationReset =
      ticket.escalated_at && resetPrematureEscalation && now < newDueAt;

    if (isDifferent || willPrematureEscalationReset) {
      modifiedCount++;

      console.log(`Ticket: ${ticket.ticket_no} (ID: ${ticket.id}) [Status: ${ticket.status.toUpperCase()}]`);
      console.log(`  Subcategory: ${ticket.subcategory?.name || 'N/A'} (TAT: ${tatHours}h)`);
      console.log(`  Created At : ${ticket.created_at.toISOString()}`);
      console.log(`  Old Due At : ${oldDueAt.toISOString()} ⚠️ [UPCOMING WEEKEND/HOLIDAY]`);
      console.log(`  New Due At : ${newDueAt.toISOString()} ✅ [ADJUSTED TO NEXT BUSINESS WORKING DAY]`);

      if (ticket.escalated_at) {
        if (willPrematureEscalationReset) {
          prematureEscalationResetCount++;
          console.log(`  Escalation : Currently escalated at ${ticket.escalated_at.toISOString()}. New due date is still in the future -> Escalation will be RESET to null.`);
        } else {
          console.log(`  Escalation : Currently escalated at ${ticket.escalated_at.toISOString()} and remains breached.`);
        }
      }

      if (!isDryRun) {
        // Prepare update payload
        const updateData: any = {
          due_at: newDueAt,
        };

        if (willPrematureEscalationReset) {
          updateData.escalated_at = null;
        }

        await prisma.ticket.update({
          where: { id: ticket.id },
          data: updateData,
        });

        // Add Ticket Log audit entry
        await prisma.ticketLog.create({
          data: {
            ticket_id: ticket.id,
            user_id: ticket.user_id,
            action: 'SLA_RECALCULATED_HOLIDAYS_FIX',
            details: {
              old_due_at: oldDueAt,
              new_due_at: newDueAt,
              tat_hours: tatHours,
              previous_escalated_at: ticket.escalated_at,
              escalation_reset: willPrematureEscalationReset,
              reason: 'Recalculated SLA to exclude weekends and official company holidays.',
            },
          },
        });

        console.log(`  Status     : ✅ Updated in database.`);
      } else {
        console.log(`  Status     : [DRY-RUN] Will be updated when run with --apply.`);
      }

      console.log('');
    }
  }

  console.log('------------------------------------------------------------------------');
  console.log(`Summary:`);
  console.log(`  Total Active Tickets Scanned (OPEN & WIP): ${activeTickets.length}`);
  console.log(`    - Open Tickets                         : ${openCount}`);
  console.log(`    - In-Progress (WIP) Tickets            : ${wipCount}`);
  console.log(`  Upcoming Tickets Adjusted (Weekend/Hol.) : ${modifiedCount}`);
  console.log(`  Tickets With Premature Escalation Reset  : ${prematureEscalationResetCount}`);
  console.log(`  Tickets Skipped (Past Expiry - Untouched): ${skippedPastCount}`);
  console.log(`  Tickets Skipped (Valid Working Day)      : ${skippedValidWorkingDayCount}`);
  if (isDryRun) {
    console.log(`\nTo execute these changes in the database, run:`);
    console.log(`  npx ts-node prisma/recalculate-due-dates.ts --apply\n`);
  } else {
    console.log(`\n✅ All changes successfully committed to the database.\n`);
  }
}

main()
  .catch((e) => {
    console.error('Error running SLA recalculation script:', e);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });


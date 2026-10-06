import { format, formatDistanceToNow, addHours, parseISO } from 'date-fns';

export class DateUtil {
  // Formats a date into a clean, human-readable string (e.g. "04 Aug 2026, 11:30 AM")
  static formatDate(date: Date | string | number | null | undefined): string {
    if (!date) return 'N/A';
    const parsedDate = typeof date === 'string' ? parseISO(date) : new Date(date);
    if (isNaN(parsedDate.getTime())) return 'N/A';
    return format(parsedDate, 'dd MMM yyyy, hh:mm a');
  }

  // Returns a relative time string (e.g. "in 4 hours" or "2 hours ago")
  static formatRelative(date: Date | string | number | null | undefined): string {
    if (!date) return 'N/A';
    const parsedDate = typeof date === 'string' ? parseISO(date) : new Date(date);
    if (isNaN(parsedDate.getTime())) return 'N/A';
    return formatDistanceToNow(parsedDate, { addSuffix: true });
  }

  /**
   * Calculates due date by adding TAT hours (24, 48, 72, etc.)
   * Static fallback method that skips Saturdays and Sundays.
   * For database-aware calculation including company/public holidays,
   * use HolidaysService.calculateSlaDueDate().
   */
  static calculateDueDate(tatHours: number): Date {
    const days = Math.floor(tatHours / 24);
    const remHours = tatHours % 24;

    let target = new Date();

    // If starting on a weekend, roll forward to Monday morning at 9:30 AM
    while (target.getDay() === 0 || target.getDay() === 6) {
      target.setDate(target.getDate() + 1);
      target.setHours(9, 30, 0, 0);
    }

    // Add working days (skipping Sat & Sun)
    let added = 0;
    while (added < days) {
      target.setDate(target.getDate() + 1);
      const day = target.getDay();
      if (day !== 0 && day !== 6) {
        added++;
      }
    }

    if (remHours > 0) {
      target = addHours(target, remHours);
      while (target.getDay() === 0 || target.getDay() === 6) {
        target.setDate(target.getDate() + 1);
      }
    }

    return target;
  }
}


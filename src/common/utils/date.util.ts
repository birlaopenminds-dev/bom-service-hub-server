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

  // Calculates due date by adding TAT hours to current time
  static calculateDueDate(tatHours: number): Date {
    return addHours(new Date(), tatHours);
  }
}

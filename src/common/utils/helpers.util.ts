import { DateUtil } from './date.util';

export class HelpersUtil {
  static generateTicketNumber(id: number = 1): string {
    const paddedId = id.toString().padStart(7, '0');
    return `TKT-${paddedId}`;
  }

  static calculateDueDate(tatHours: number): Date {
    return DateUtil.calculateDueDate(tatHours);
  }
}


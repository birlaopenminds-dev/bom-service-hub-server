import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../providers/database/prisma.service';

export interface ICreateTicketLog {
  ticket_id: number;
  user_id: number;
  action: string;
  details?: any;
}

@Injectable()
export class TicketLogsService {
  private readonly logger = new Logger(TicketLogsService.name);

  constructor(private prisma: PrismaService) { }

  async createLog(data: ICreateTicketLog) {
    try {
      return await this.prisma.ticketLog.create({
        data: {
          ticket_id: data.ticket_id,
          user_id: data.user_id,
          action: data.action,
          details: data.details || null,
        },
        include: {
          user: { select: { id: true, name: true, email: true, role: true } },
        },
      });
    } catch (err) {
      this.logger.error(`Failed to create ticket log: ${err.message}`);
    }
  }

  async getLogsByTicketId(ticketId: number) {
    return this.prisma.ticketLog.findMany({
      where: { ticket_id: ticketId },
      orderBy: { created_at: 'asc' },
      include: {
        user: { select: { id: true, name: true, email: true, role: true } },
      },
    });
  }
}

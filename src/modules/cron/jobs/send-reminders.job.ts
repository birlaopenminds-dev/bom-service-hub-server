import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../providers/database/prisma.service';
import { MailService } from '../../mail/mail.service';
import { TicketStatus } from '@prisma/client';

@Injectable()
export class SendRemindersJob {
  private readonly logger = new Logger(SendRemindersJob.name);

  constructor(
    private prisma: PrismaService,
    private mailService: MailService,
  ) {}

  async execute() {
    this.logger.log('Running SendRemindersJob SLA warning task...');
    const now = new Date();
    const warningWindow = new Date(now.getTime() + 4 * 60 * 60 * 1000); // 4 hours before SLA breach

    const ticketsNearingBreach = await this.prisma.ticket.findMany({
      where: {
        due_at: { gte: now, lte: warningWindow },
        NOT: { status: { in: [TicketStatus.resolved, TicketStatus.closed] } },
      },
      include: { user: true, assignee: true },
    });

    let count = 0;
    for (const ticket of ticketsNearingBreach) {
      if (ticket.assignee) {
        await this.mailService.sendMail({
          to: ticket.assignee.email,
          subject: `[SLA WARNING] Ticket ${ticket.ticket_no} Due Soon`,
          template: 'ticket-due-date',
          context: {
            name: ticket.assignee.name,
            ticketNo: ticket.ticket_no,
            subject: ticket.subject,
            description: ticket.description,
            creatorName: ticket.user?.name || null,
            creatorEmail: ticket.user?.email || null,
            assigneeName: ticket.assignee.name,
            assigneeEmail: ticket.assignee.email,
            dueAt: ticket.due_at,
          },
        });
        count++;
      }
    }

    this.logger.log(`SendRemindersJob sent ${count} SLA warnings.`);
    return { jobName: 'SendRemindersJob', processedCount: count, success: true, executedAt: now };
  }
}

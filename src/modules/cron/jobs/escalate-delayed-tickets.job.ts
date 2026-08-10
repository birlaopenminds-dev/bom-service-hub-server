import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../providers/database/prisma.service';
import { MailService } from '../../mail/mail.service';
import { TicketLogsService } from '../../ticket-logs/ticket-logs.service';
import { TicketStatus } from '@prisma/client';

@Injectable()
export class EscalateDelayedTicketsJob {
  private readonly logger = new Logger(EscalateDelayedTicketsJob.name);

  constructor(
    private prisma: PrismaService,
    private mailService: MailService,
    private ticketLogsService: TicketLogsService,
  ) {}

  async execute() {
    this.logger.log('Running EscalateDelayedTicketsJob cron task...');
    const now = new Date();

    // Find all unresolved tickets past due_at that are not yet escalated
    const overdueTickets = await this.prisma.ticket.findMany({
      where: {
        due_at: { lt: now },
        escalated_at: null,
        NOT: { status: { in: [TicketStatus.resolved, TicketStatus.closed] } },
      },
      include: {
        user: true,
        assignee: true,
        department: true,
      },
    });

    let count = 0;
    for (const ticket of overdueTickets) {
      await this.prisma.ticket.update({
        where: { id: ticket.id },
        data: { escalated_at: now },
      });

      await this.ticketLogsService.createLog({
        ticket_id: ticket.id,
        user_id: ticket.user_id,
        action: 'AUTO_ESCALATED_SLA_BREACH',
        details: { due_at: ticket.due_at, escalated_at: now },
      });

      // Send email alert to user and assignee
      await this.mailService.sendMail({
        to: ticket.user.email,
        subject: `[SLA BREACH] Ticket Auto-Escalated: ${ticket.ticket_no}`,
        template: 'ticket-auto-escalated',
        context: {
          name: ticket.user.name,
          ticketNo: ticket.ticket_no,
          subject: ticket.subject,
          description: ticket.description,
          creatorName: ticket.user.name,
          creatorEmail: ticket.user.email,
          assigneeName: ticket.assignee?.name || null,
          assigneeEmail: ticket.assignee?.email || null,
          dueAt: ticket.due_at,
        },
      });

      count++;
    }

    this.logger.log(`EscalateDelayedTicketsJob completed. Auto-escalated ${count} tickets.`);
    return { jobName: 'EscalateDelayedTicketsJob', processedCount: count, success: true, executedAt: now };
  }
}

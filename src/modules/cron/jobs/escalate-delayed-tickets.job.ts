import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../providers/database/prisma.service';
import { MailService } from '../../mail/mail.service';
import { TicketLogsService } from '../../ticket-logs/ticket-logs.service';
import { TicketStatus, Role } from '@prisma/client';
import { DateUtil } from '../../../common/utils/date.util';

@Injectable()
export class EscalateDelayedTicketsJob {
  private readonly logger = new Logger(EscalateDelayedTicketsJob.name);

  constructor(
    private prisma: PrismaService,
    private mailService: MailService,
    private ticketLogsService: TicketLogsService,
  ) { }

  async execute() {
    this.logger.log('Running EscalateDelayedTicketsJob cron task...');
    const now = new Date();

    let countStage1 = 0;
    let countStage2 = 0;
    let countStage3 = 0;

    // ----------------------------------------------------------------------
    // STAGE 1: Initial SLA Breach (due_at < now AND escalated_at IS NULL)
    // ----------------------------------------------------------------------
    const overdueTickets = await this.prisma.ticket.findMany({
      where: {
        due_at: { lt: now },
        escalated_at: null,
        NOT: { status: { in: [TicketStatus.resolved, TicketStatus.closed] } },
      },
      include: {
        user: {
          include: { reporting_manager: true, hod: true },
        },
        assignee: {
          include: { reporting_manager: true, hod: true },
        },
        department: true,
      },
    });

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

      await this.sendEscalationEmail(ticket, 'stage1', []);
      countStage1++;
    }

    // ----------------------------------------------------------------------
    // STAGE 2: 48 Hours Past Escalation Notice (escalated_at <= now - 48h)
    // ----------------------------------------------------------------------
    const fortyEightHoursAgo = new Date(now.getTime() - 48 * 60 * 60 * 1000);

    const stage2Candidates = await this.prisma.ticket.findMany({
      where: {
        escalated_at: { lte: fortyEightHoursAgo },
        NOT: { status: { in: [TicketStatus.resolved, TicketStatus.closed] } },
      },
      include: {
        user: {
          include: { reporting_manager: true, hod: true },
        },
        assignee: {
          include: { reporting_manager: true, hod: true },
        },
        department: true,
        logs: {
          where: { action: 'ESCALATED_48H_NOTICE' },
        },
      },
    });

    for (const ticket of stage2Candidates) {
      if (ticket.logs.length === 0) {
        await this.ticketLogsService.createLog({
          ticket_id: ticket.id,
          user_id: ticket.user_id,
          action: 'ESCALATED_48H_NOTICE',
          details: { escalated_at: ticket.escalated_at, notice_sent_at: now },
        });

        await this.sendEscalationEmail(ticket, 'stage2', ['sandeep.pinto@birlaopenminds.com']);
        countStage2++;
      }
    }

    // ----------------------------------------------------------------------
    // STAGE 3: 72 Hours Past Escalation Notice (escalated_at <= now - 72h)
    // ----------------------------------------------------------------------
    const seventyTwoHoursAgo = new Date(now.getTime() - 72 * 60 * 60 * 1000);

    const stage3Candidates = await this.prisma.ticket.findMany({
      where: {
        escalated_at: { lte: seventyTwoHoursAgo },
        NOT: { status: { in: [TicketStatus.resolved, TicketStatus.closed] } },
      },
      include: {
        user: {
          include: { reporting_manager: true, hod: true },
        },
        assignee: {
          include: { reporting_manager: true, hod: true },
        },
        department: true,
        logs: {
          where: { action: 'ESCALATED_72H_NOTICE' },
        },
      },
    });

    for (const ticket of stage3Candidates) {
      if (ticket.logs.length === 0) {
        await this.ticketLogsService.createLog({
          ticket_id: ticket.id,
          user_id: ticket.user_id,
          action: 'ESCALATED_72H_NOTICE',
          details: { escalated_at: ticket.escalated_at, notice_sent_at: now },
        });

        await this.sendEscalationEmail(ticket, 'stage3', [
          'sandeep.pinto@birlaopenminds.com',
          'yatharth.gautam@birlaopenminds.com',
          'sarada.murali@birlaopenminds.com',
        ]);
        countStage3++;
      }
    }

    this.logger.log(
      `EscalateDelayedTicketsJob completed. Stage1: ${countStage1}, Stage2 (48h): ${countStage2}, Stage3 (72h): ${countStage3}`,
    );

    return {
      jobName: 'EscalateDelayedTicketsJob',
      processedCount: countStage1 + countStage2 + countStage3,
      success: true,
      executedAt: now,
    };
  }

  private async sendEscalationEmail(
    ticket: any,
    stage: 'stage1' | 'stage2' | 'stage3',
    extraCcEmails?: string[],
  ) {
    const toList: string[] = [];
    const rawCcList: string[] = [];

    // TO: Ticket Creator
    if (ticket.user?.email) {
      toList.push(ticket.user.email.trim());
    }

    // TO: Ticket Assignee (if assigned)
    if (ticket.assignee?.email) {
      toList.push(ticket.assignee.email.trim());
    }

    if (toList.length === 0) return;

    // CC: Creator's RM
    if (ticket.user?.reporting_manager?.email) {
      rawCcList.push(ticket.user.reporting_manager.email.trim());
    }

    // CC: Creator's HOD (with department fallback)
    if (ticket.user?.hod?.email) {
      rawCcList.push(ticket.user.hod.email.trim());
    } else if (ticket.user?.department_id) {
      const creatorDeptHods = await this.prisma.user.findMany({
        where: {
          role: Role.hod,
          is_active: true,
          OR: [
            { department_id: ticket.user.department_id },
            { hod_departments: { some: { id: ticket.user.department_id } } },
          ],
        },
        select: { email: true },
      });
      creatorDeptHods.forEach((h) => {
        if (h.email) rawCcList.push(h.email.trim());
      });
    }

    // CC: Assignee's RM
    if (ticket.assignee?.reporting_manager?.email) {
      rawCcList.push(ticket.assignee.reporting_manager.email.trim());
    }

    // CC: Assignee's HOD (with department fallback)
    if (ticket.assignee?.hod?.email) {
      rawCcList.push(ticket.assignee.hod.email.trim());
    } else if (ticket.assignee?.department_id) {
      const assigneeDeptHods = await this.prisma.user.findMany({
        where: {
          role: Role.hod,
          is_active: true,
          OR: [
            { department_id: ticket.assignee.department_id },
            { hod_departments: { some: { id: ticket.assignee.department_id } } },
          ],
        },
        select: { email: true },
      });
      assigneeDeptHods.forEach((h) => {
        if (h.email) rawCcList.push(h.email.trim());
      });
    }

    // CC: Extra management escalation emails (Sandeep Pinto , Yatharth Gautam, Sarada Murli)
    if (extraCcEmails && extraCcEmails.length > 0) {
      rawCcList.push(...extraCcEmails);
    }

    // Deduplicate lists
    const uniqueTo = Array.from(new Set(toList));
    const toLowerSet = new Set(uniqueTo.map((e) => e.toLowerCase()));

    const uniqueCc = Array.from(
      new Set(
        rawCcList
          .map((e) => e.trim())
          .filter((email) => email && !toLowerSet.has(email.toLowerCase())),
      ),
    );

    let subjectPrefix = '[SLA BREACH - ESCALATED]';
    if (stage === 'stage2') {
      subjectPrefix = '[SLA BREACH - 48H ESCALATED]';
    } else if (stage === 'stage3') {
      subjectPrefix = '[SLA BREACH - 72H ESCALATED]';
    }

    const subject = `${subjectPrefix} Ticket Overdue: ${ticket.ticket_no} - ${ticket.subject}`;

    try {
      await this.mailService.sendMail({
        to: uniqueTo,
        cc: uniqueCc.length > 0 ? uniqueCc : undefined,
        subject,
        template: 'ticket-auto-escalated',
        context: {
          name: ticket.user?.name || 'User',
          ticketNo: ticket.ticket_no,
          subject: ticket.subject,
          description: ticket.description,
          creatorName: ticket.user?.name || null,
          creatorEmail: ticket.user?.email || null,
          assigneeName: ticket.assignee?.name || null,
          assigneeEmail: ticket.assignee?.email || null,
          dueAtFormatted: ticket.due_at ? DateUtil.formatDate(ticket.due_at) : 'N/A',
          stage,
        },
      });
    } catch (err) {
      this.logger.error(`Failed to send ${stage} escalation email for ${ticket.ticket_no}: ${err.message}`);
    }
  }
}

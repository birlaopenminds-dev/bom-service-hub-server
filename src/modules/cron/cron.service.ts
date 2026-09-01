import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { EscalateDelayedTicketsJob } from './jobs/escalate-delayed-tickets.job';
import { CleanBlacklistedTokensJob } from './jobs/clean-blacklisted-tokens.job';
// import { GenerateReportsJob } from './jobs/generate-reports.job';
// import { SendRemindersJob } from './jobs/send-reminders.job';

@Injectable()
export class CronService {
  private readonly logger = new Logger(CronService.name);

  constructor(
    private escalateJob: EscalateDelayedTicketsJob,
    private cleanTokensJob: CleanBlacklistedTokensJob,
    // private reportsJob: GenerateReportsJob,
    // private remindersJob: SendRemindersJob,
  ) {}

  // Run every 5 minutes (Auto-escalate overdue tickets & multi-tier SLA escalation notices)
  @Cron('*/5 * * * *')
  async handleAutoEscalation() {
    this.logger.log('Executing Cron: Auto-escalate overdue tickets');
    await this.escalateJob.execute();
  }

  // Run daily at midnight
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async handleTokenCleanup() {
    this.logger.log('Executing Cron: Cleanup expired blacklisted tokens');
    await this.cleanTokensJob.execute();
  }

  // // Run every 2 hours (Disabled as requested)
  // async handleSlaReminders() {
  //   this.logger.log('Executing Cron: Send SLA breach reminders');
  //   await this.remindersJob.execute();
  // }

  // // Run every Sunday at midnight (Disabled as requested)
  // async handleWeeklyReports() {
  //   this.logger.log('Executing Cron: Weekly reports job');
  //   await this.reportsJob.execute();
  // }
}

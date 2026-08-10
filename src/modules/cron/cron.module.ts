import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { CronService } from './cron.service';
import { EscalateDelayedTicketsJob } from './jobs/escalate-delayed-tickets.job';
import { CleanBlacklistedTokensJob } from './jobs/clean-blacklisted-tokens.job';
import { GenerateReportsJob } from './jobs/generate-reports.job';
import { SendRemindersJob } from './jobs/send-reminders.job';
import { DatabaseModule } from '../../providers/database/database.provider';
import { MailModule } from '../mail/mail.module';
import { TicketLogsModule } from '../ticket-logs/ticket-logs.module';

@Module({
  imports: [ScheduleModule.forRoot(), DatabaseModule, MailModule, TicketLogsModule],
  providers: [
    CronService,
    EscalateDelayedTicketsJob,
    CleanBlacklistedTokensJob,
    GenerateReportsJob,
    SendRemindersJob,
  ],
  exports: [CronService],
})
export class CronModule {}

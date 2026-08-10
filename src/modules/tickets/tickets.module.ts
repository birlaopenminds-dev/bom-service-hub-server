import { Module } from '@nestjs/common';
import { TicketsService } from './tickets.service';
import { TicketsController } from './tickets.controller';
import { DatabaseModule } from '../../providers/database/database.provider';
import { TicketLogsModule } from '../ticket-logs/ticket-logs.module';
import { TicketAttachmentsModule } from '../ticket-attachments/ticket-attachments.module';
import { MailModule } from '../mail/mail.module';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [
    DatabaseModule,
    TicketLogsModule,
    TicketAttachmentsModule,
    MailModule,
    AuditModule,
  ],
  controllers: [TicketsController],
  providers: [TicketsService],
  exports: [TicketsService],
})
export class TicketsModule {}

import { Module } from '@nestjs/common';
import { TicketAttachmentsService } from './ticket-attachments.service';
import { DatabaseModule } from '../../providers/database/database.provider';
import { StorageProvider } from '../../providers/storage/storage.provider';

@Module({
  imports: [DatabaseModule],
  providers: [TicketAttachmentsService, StorageProvider],
  exports: [TicketAttachmentsService],
})
export class TicketAttachmentsModule {}

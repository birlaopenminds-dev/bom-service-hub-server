import { Module } from '@nestjs/common';
import { TicketLogsService } from './ticket-logs.service';
import { DatabaseModule } from '../../providers/database/database.provider';

@Module({
  imports: [DatabaseModule],
  providers: [TicketLogsService],
  exports: [TicketLogsService],
})
export class TicketLogsModule {}

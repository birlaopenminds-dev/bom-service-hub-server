import { Module } from '@nestjs/common';
import { MailService } from './mail.service';
import { DatabaseModule } from '../../providers/database/database.provider';

@Module({
  imports: [DatabaseModule],
  providers: [MailService],
  exports: [MailService],
})
export class MailModule {}

import { Module } from '@nestjs/common';
import { AuditService } from './audit.service';
import { DatabaseModule } from '../../providers/database/database.provider';

@Module({
  imports: [DatabaseModule],
  providers: [AuditService],
  exports: [AuditService],
})
export class AuditModule {}

import { Module } from '@nestjs/common';
import { UploadsService } from './uploads.service';
import { UploadsController } from './uploads.controller';
import { StorageProvider } from '../../providers/storage/storage.provider';

@Module({
  controllers: [UploadsController],
  providers: [UploadsService, StorageProvider],
  exports: [UploadsService],
})
export class UploadsModule {}

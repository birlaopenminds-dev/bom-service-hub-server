import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs';

@Injectable()
export class StorageProvider {
  private readonly logger = new Logger(StorageProvider.name);

  ensureDirectoryExists(dirPath: string) {
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
      this.logger.log(`Created storage directory: ${dirPath}`);
    }
  }

  deleteFile(filePath: string): boolean {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      return true;
    }
    return false;
  }
}

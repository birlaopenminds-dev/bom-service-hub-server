import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { StorageProvider } from '../../providers/storage/storage.provider';
import { FileValidator } from '../ticket-attachments/validators/file-validator';
import * as path from 'path';
import * as fs from 'fs';

@Injectable()
export class UploadsService {
  constructor(private storageProvider: StorageProvider) {
    this.storageProvider.ensureDirectoryExists('./public/uploads');
  }

  async handleFileUpload(file: Express.Multer.File) {
    FileValidator.validateFile(file);

    return {
      filename: file.filename,
      originalName: file.originalname,
      mimeType: file.mimetype,
      size: file.size,
      url: `/uploads/${file.filename}`,
    };
  }

  getFilePath(filename: string): string {
    const filePath = path.join(process.cwd(), 'public', 'uploads', filename);
    if (!fs.existsSync(filePath)) {
      throw new NotFoundException(`File "${filename}" not found on storage.`);
    }
    return filePath;
  }
}

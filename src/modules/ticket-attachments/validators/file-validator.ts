import { BadRequestException } from '@nestjs/common';

export class FileValidator {
  private static readonly ALLOWED_MIME_TYPES = [
    'image/jpeg',
    'image/png',
    'image/gif',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/plain',
    'text/csv',
  ];

  private static readonly MAX_SIZE = 10 * 1024 * 1024; // 10MB

  static validateFile(file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('No file provided for upload.');
    }

    if (file.size > this.MAX_SIZE) {
      throw new BadRequestException(
        `File "${file.originalname}" exceeds maximum allowed limit of 10MB.`,
      );
    }

    if (!this.ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      throw new BadRequestException(
        `File type "${file.mimetype}" is not allowed.`,
      );
    }

    return true;
  }
}

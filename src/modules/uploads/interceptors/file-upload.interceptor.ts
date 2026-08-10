import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import { v4 as uuidv4 } from 'uuid';
import * as fs from 'fs';
import { BadRequestException } from '@nestjs/common';

export const ticketAttachmentStorage = diskStorage({
  destination: (req, file, callback) => {
    const uploadDir = join(process.cwd(), 'public', 'uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    callback(null, uploadDir);
  },
  filename: (req, file, callback) => {
    const uniqueSuffix = uuidv4();
    const fileExt = extname(file.originalname);
    callback(null, `${uniqueSuffix}${fileExt}`);
  },
});

const allowedFileTypes = /\.(jpg|jpeg|png|gif|webp|pdf|doc|docx|xls|xlsx|csv|txt)$/i;

export const CustomFileUploadInterceptor = (fieldName = 'file') => {
  return FileInterceptor(fieldName, {
    storage: ticketAttachmentStorage,
    limits: {
      fileSize: 10 * 1024 * 1024, // 10MB
    },
    fileFilter: (req, file, callback) => {
      if (file.originalname.match(allowedFileTypes)) {
        return callback(null, true);
      }
      return callback(
        new BadRequestException(
          'Unsupported file format. Allowed formats: PNG, JPG, GIF, WEBP, Excel (XLSX, XLS, CSV), PDF, Word (DOC, DOCX), and TXT.'
        ),
        false
      );
    },
  });
};

export const CustomFilesUploadInterceptor = (fieldName = 'attachments', maxCount = 5) => {
  return FilesInterceptor(fieldName, maxCount, {
    storage: ticketAttachmentStorage,
    limits: {
      fileSize: 10 * 1024 * 1024, // 10MB per file
    },
    fileFilter: (req, file, callback) => {
      if (file.originalname.match(allowedFileTypes)) {
        return callback(null, true);
      }
      return callback(
        new BadRequestException(
          'Unsupported file format. Allowed formats: PNG, JPG, GIF, WEBP, Excel (XLSX, XLS, CSV), PDF, Word (DOC, DOCX), and TXT.'
        ),
        false
      );
    },
  });
};

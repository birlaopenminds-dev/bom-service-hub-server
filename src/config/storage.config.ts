import { registerAs } from '@nestjs/config';

export default registerAs('storage', () => ({
  uploadDest: process.env.UPLOAD_DEST || './public/uploads',
  maxFileSize: parseInt(process.env.MAX_FILE_SIZE || '10485760', 10),
}));

import { registerAs } from '@nestjs/config';

export default registerAs('logging', () => ({
  level: process.env.LOG_LEVEL || 'info',
  dir: process.env.LOG_DIR || 'logs',
}));

import { registerAs } from '@nestjs/config';

export default registerAs('email', () => ({
  host: process.env.SMTP_HOST || process.env.MAIL_HOST || 'smtp.office365.com',
  port: parseInt(process.env.SMTP_PORT || process.env.MAIL_PORT || '587', 10),
  user: process.env.SMTP_USER || process.env.MAIL_USER,
  pass: process.env.SMTP_PASS || process.env.MAIL_PASS,
  from: process.env.MAIL_FROM || process.env.SMTP_USER,
  fromName: process.env.MAIL_FROM_NAME || 'BOM Service Hub',
}));

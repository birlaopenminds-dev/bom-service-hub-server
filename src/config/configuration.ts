export default () => ({
  environment: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '5000', 10),
  apiPrefix: process.env.API_PREFIX || 'api',
  apiVersion: process.env.API_VERSION || '1',
  database: {
    url: process.env.DATABASE_URL,
  },
  jwt: {
    secret: process.env.JWT_SECRET,
    expiresIn: process.env.JWT_EXPIRATION || '15m',
    refreshSecret: process.env.JWT_REFRESH_SECRET,
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRATION || '7d',
  },
  rateLimit: {
    ttl: parseInt(process.env.THROTTLE_TTL || '60', 10),
    limit: parseInt(process.env.THROTTLE_LIMIT || '100', 10),
  },
  upload: {
    dest: process.env.UPLOAD_DEST || './public/uploads',
    maxSize: parseInt(process.env.MAX_FILE_SIZE || '10485760', 10),
  },
  mail: {
    host: process.env.SMTP_HOST || process.env.MAIL_HOST || 'smtp.office365.com',
    port: parseInt(process.env.SMTP_PORT || process.env.MAIL_PORT || '587', 10),
    user: process.env.SMTP_USER || process.env.MAIL_USER,
    pass: process.env.SMTP_PASS || process.env.MAIL_PASS,
    from: process.env.MAIL_FROM || process.env.SMTP_USER,
    fromName: process.env.MAIL_FROM_NAME || 'BOM Service Hub',
  },
  security: {
    cookieSecret: process.env.COOKIE_SECRET,
  },
});

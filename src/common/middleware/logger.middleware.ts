import { Injectable, NestMiddleware, Logger } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

@Injectable()
export class LoggerMiddleware implements NestMiddleware {
  private readonly logger = new Logger('HTTP');

  use(req: Request, res: Response, next: NextFunction) {
    const startTime = Date.now();
    const { ip, method, originalUrl } = req;
    const userAgent = req.get('user-agent') || 'Unknown';

    res.on('finish', () => {
      const { statusCode } = res;
      const responseTime = Date.now() - startTime;
      const contentLength = res.get('content-length') || '0';
      const clientIp = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || ip;

      this.logger.log(
        `[${method}] ${originalUrl} | Status: ${statusCode} | Time: ${responseTime}ms | IP: ${clientIp} | Size: ${contentLength}B | UA: ${userAgent}`,
      );
    });

    next();
  }
}


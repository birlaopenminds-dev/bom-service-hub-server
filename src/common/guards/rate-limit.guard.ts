import {
  Injectable,
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RATE_LIMIT_KEY, RateLimitOptions } from '../decorators/rate-limit.decorator';

@Injectable()
export class RateLimitGuard implements CanActivate {
  private requestCounts = new Map<string, { count: number; resetTime: number }>();

  constructor(private reflector: Reflector) { }

  canActivate(context: ExecutionContext): boolean {
    const options = this.reflector.getAllAndOverride<RateLimitOptions>(
      RATE_LIMIT_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!options) {
      return true;
    }

    const req = context.switchToHttp().getRequest();
    const ip = req.ip || req.connection.remoteAddress || 'unknown';
    const key = `${req.path}_${ip}`;
    const now = Date.now();

    const record = this.requestCounts.get(key);

    if (!record || now > record.resetTime) {
      this.requestCounts.set(key, {
        count: 1,
        resetTime: now + options.ttl * 1000,
      });
      return true;
    }

    if (record.count >= options.limit) {
      throw new HttpException(
        `Too Many Requests: You have exceeded the allowable rate limit. Please wait ${Math.ceil(
          (record.resetTime - now) / 1000,
        )} seconds before trying again.`,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    record.count += 1;
    return true;
  }
}

import { SetMetadata } from "@nestjs/common";

export const RATE_LIMIT_KEY = "rate_limit";
export interface RateLimitOptions {
  ttl: number; // in seconds
  limit: number; // max requests
}

export const RateLimit = (options: RateLimitOptions) =>
  SetMetadata(RATE_LIMIT_KEY, options);

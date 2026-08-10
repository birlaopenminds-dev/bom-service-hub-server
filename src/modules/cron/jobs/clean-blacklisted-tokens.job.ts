import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../providers/database/prisma.service';

@Injectable()
export class CleanBlacklistedTokensJob {
  private readonly logger = new Logger(CleanBlacklistedTokensJob.name);

  constructor(private prisma: PrismaService) {}

  async execute() {
    this.logger.log('Running CleanBlacklistedTokensJob task...');
    const now = new Date();

    const deleted = await this.prisma.blacklistedToken.deleteMany({
      where: { expires_at: { lt: now } },
    });

    this.logger.log(`Cleaned ${deleted.count} expired blacklisted tokens from database.`);
    return { jobName: 'CleanBlacklistedTokensJob', processedCount: deleted.count, success: true, executedAt: now };
  }
}

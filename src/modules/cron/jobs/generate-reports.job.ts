import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../providers/database/prisma.service';

@Injectable()
export class GenerateReportsJob {
  private readonly logger = new Logger(GenerateReportsJob.name);

  constructor(private prisma: PrismaService) {}

  async execute() {
    this.logger.log('Running GenerateReportsJob scheduled task...');
    const totalTickets = await this.prisma.ticket.count();
    this.logger.log(`Scheduled report calculated. Total tickets in system: ${totalTickets}`);
    return { jobName: 'GenerateReportsJob', processedCount: totalTickets, success: true, executedAt: new Date() };
  }
}

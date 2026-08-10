import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../providers/database/prisma.service';

export interface ICreateAuditLog {
  userId: number;
  action: string;
  resource: string;
  resourceId?: string | number;
  oldValues?: any;
  newValues?: any;
  ipAddress?: string;
  userAgent?: string;
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private prisma: PrismaService) { }

  async log(data: ICreateAuditLog) {
    try {
      await this.prisma.auditLog.create({
        data: {
          user_id: data.userId,
          action: data.action,
          resource: data.resource,
          resource_id: data.resourceId !== undefined ? String(data.resourceId) : null,
          old_values: data.oldValues || null,
          new_values: data.newValues || null,
          ip_address: data.ipAddress,
          user_agent: data.userAgent,
        },
      });
    } catch (error) {
      this.logger.error(`Audit logging failed: ${error.message}`);
    }
  }
}

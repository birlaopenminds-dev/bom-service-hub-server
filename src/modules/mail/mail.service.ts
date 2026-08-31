import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import * as ejs from 'ejs';
import * as path from 'path';
import { PrismaService } from '../../providers/database/prisma.service';
import { Prisma, EmailStatus } from '@prisma/client';
import { ISendEmailOptions } from './interfaces/email.interface';
import * as fs from 'fs';

import { DateUtil } from '../../common/utils/date.util';
import { PaginationUtil } from '../../common/utils/pagination.util';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private transporter: nodemailer.Transporter;
  private readonly fromEmail: string;
  private readonly templatePath: string;
  private readonly devTemplatePath: string;

  constructor(
    private configService: ConfigService,
    private prisma: PrismaService,
  ) {
    const mailConfig = this.configService.get('mail');

    if (!mailConfig) {
      throw new Error('Mail configuration is missing');
    }

    const rawFrom = mailConfig.from || process.env.MAIL_FROM || process.env.SMTP_USER;
    const fromName = mailConfig.fromName || process.env.MAIL_FROM_NAME || 'BOM Service Hub';
    this.fromEmail = rawFrom && rawFrom.includes('<') ? rawFrom : `"${fromName}" <${rawFrom}>`;

    this.templatePath = path.join(
      process.cwd(),
      'dist',
      'src',
      'modules',
      'mail',
      'templates',
    );
    this.devTemplatePath = path.join(
      process.cwd(),
      'src',
      'modules',
      'mail',
      'templates',
    );

    const port = Number(mailConfig.port) || 587;
    const isGmail = mailConfig?.host?.includes('gmail');

    this.transporter = nodemailer.createTransport(
      isGmail
        ? {
          service: 'gmail',
          auth: {
            user: mailConfig.user,
            pass: mailConfig.pass,
          },
          tls: {
            rejectUnauthorized: false,
          },
        }
        : {
          host: mailConfig.host,
          port: port,
          secure: port === 465,
          auth: {
            user: mailConfig.user,
            pass: mailConfig.pass,
          },
          tls: {
            rejectUnauthorized: false,
          },
        },
    );
  }

  async sendMail(options: ISendEmailOptions): Promise<boolean> {
    const recipients = Array.isArray(options.to) ? options.to : [options.to];
    for (const email of recipients) {
      if (!this.isValidEmail(email)) {
        throw new BadRequestException(`Invalid email address: ${email}`);
      }
    }

    // Enrich context with DateUtil formatted dates if date strings/objects are present
    const enrichedContext = {
      ...options.context,
      formatDate: (d: any) => DateUtil.formatDate(d),
      formatRelative: (d: any) => DateUtil.formatRelative(d),
      dueAtFormatted: options.context?.dueAt ? DateUtil.formatDate(options.context.dueAt) : null,
      dueAtRelative: options.context?.dueAt ? DateUtil.formatRelative(options.context.dueAt) : null,
      createdAtFormatted: options.context?.createdAt ? DateUtil.formatDate(options.context.createdAt) : null,
    };

    const html = await this.renderTemplate(options.template, enrichedContext);

    const logoPath = path.join(process.cwd(), 'public', 'assets', 'bom_logo.png');
    const defaultAttachments = fs.existsSync(logoPath)
      ? [
        {
          filename: 'bom_logo.png',
          path: logoPath,
          cid: 'bom_logo',
        },
      ]
      : [];

    try {
      const info = await this.transporter.sendMail({
        from: this.fromEmail,
        to: options.to,
        cc: options.cc,
        bcc: options.bcc,
        subject: options.subject,
        html,
        attachments: [...defaultAttachments, ...(options.attachments || [])],
      });

      // Log success
      await this.createEmailLog(options, EmailStatus.sent);

      const recipientLog = Array.isArray(options.to) ? options.to.join(', ') : options.to;
      this.logger.log(`Email sent to ${recipientLog} [${options.subject}] - ${info.messageId}`);
      return true;
    } catch (error) {
      const recipientLog = Array.isArray(options.to) ? options.to.join(', ') : options.to;
      this.logger.error(`Email send failed to ${recipientLog}: ${error.message}`, error.stack);

      // Log failure
      await this.createEmailLog(options, EmailStatus.failed, error.message);

      return false;
    }
  }

  private async renderTemplate(template: string, context: any): Promise<string> {
    const paths = [
      this.templatePath,
      this.devTemplatePath,
      path.join(process.cwd(), 'dist', 'src', 'modules', 'mail', 'templates'),
      path.join(process.cwd(), 'dist', 'modules', 'mail', 'templates'),
      path.join(process.cwd(), 'src', 'modules', 'mail', 'templates'),
      path.join(__dirname, 'templates'),
    ];

    for (const basePath of paths) {
      const templatePath = path.join(basePath, `${template}.ejs`);
      try {
        await fs.promises.access(templatePath, fs.constants.F_OK);
        const rendered = await ejs.renderFile(templatePath, context);
        return rendered;
      } catch (error) {
        this.logger.debug(`Template check failed at ${templatePath}: ${error.message}`);
        continue;
      }
    }

    // Fallback if template doesn't exist or rendering throws
    this.logger.warn(`Template ${template} not found or failed to render, using HTML fallback`);
    return `
      <div style="font-family: sans-serif; padding: 24px; max-width: 600px; margin: auto; border: 1px solid #e2e8f0; border-radius: 8px;">
        <h2 style="color: #0f172a;">BOM ServiceHub Notification</h2>
        <p>Hello <strong>${context.name || 'User'}</strong>,</p>
        <p>Your account password has been reset by an Administrator. Your login credentials are:</p>
        <p><strong>Email:</strong> ${context.email || ''}<br/><strong>Default Password:</strong> ${context.defaultPassword || 'Welcome@123'}</p>
        <p style="margin-top: 20px;"><a href="${context.loginUrl || 'https://tickets.birlaopenminds.com/login'}" style="background: #2563eb; color: #fff; padding: 10px 20px; text-decoration: none; border-radius: 6px;">Log In to ServiceHub Portal</a></p>
      </div>
    `;
  }

  private async createEmailLog(
    options: ISendEmailOptions,
    status: EmailStatus,
    error?: string,
  ): Promise<void> {
    try {
      const toStr = Array.isArray(options.to) ? options.to.join(', ') : options.to;
      const ccStr = options.cc
        ? ` (CC: ${Array.isArray(options.cc) ? options.cc.join(', ') : options.cc})`
        : '';
      const recipientSummary = `${toStr}${ccStr}`;

      await this.prisma.emailLog.create({
        data: {
          recipient: recipientSummary,
          subject: options.subject,
          template: options.template,
          status,
          ...(error && { error }),
        },
      });
    } catch (logError) {
      this.logger.error(`Failed to create email log: ${logError.message}`);
    }
  }

  private isValidEmail(email: string): boolean {
    if (!email || typeof email !== 'string') return false;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email.trim());
  }

  async getEmailLogs(query: {
    page?: number;
    limit?: number;
    search?: string;
    status?: string;
  }) {
    let page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 10));
    const skip = (page - 1) * limit;

    const filters: Prisma.EmailLogWhereInput[] = [];

    const search = query.search?.trim();
    if (search) {
      filters.push({
        OR: [
          { recipient: { contains: search, mode: 'insensitive' } },
          { subject: { contains: search, mode: 'insensitive' } },
          { template: { contains: search, mode: 'insensitive' } },
          { error: { contains: search, mode: 'insensitive' } },
        ],
      });
    }

    if (query.status && query.status.toUpperCase() !== 'ALL') {
      const statusLower = query.status.toLowerCase();
      if (statusLower === 'failed') {
        filters.push({ status: EmailStatus.failed });
      } else if (statusLower === 'sent') {
        filters.push({ status: EmailStatus.sent });
      }
    }

    const where: Prisma.EmailLogWhereInput = filters.length > 0 ? { AND: filters } : {};

    const [logs, totalCount] = await Promise.all([
      this.prisma.emailLog.findMany({
        where,
        orderBy: { created_at: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.emailLog.count({ where }),
    ]);

    return PaginationUtil.buildPaginatedResult(logs, totalCount, page, limit);
  }
}
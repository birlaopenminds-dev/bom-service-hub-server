import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../providers/database/prisma.service';
import { StorageProvider } from '../../providers/storage/storage.provider';
import * as path from 'path';
import * as fs from 'fs';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class TicketAttachmentsService {
  constructor(
    private prisma: PrismaService,
    private storageProvider: StorageProvider,
  ) { }

  async createAttachment(ticketId: number, file: Express.Multer.File) {
    const ticket = await this.prisma.ticket.findUnique({
      where: { id: ticketId },
    });

    if (!ticket) {
      throw new NotFoundException(`Ticket with ID ${ticketId} not found.`);
    }

    const storedName =
      file.filename || `${uuidv4()}${path.extname(file.originalname || '')}`;

    // If buffer was passed instead of diskStorage, persist buffer to disk
    if (!file.filename && file.buffer) {
      const uploadDir = path.join(process.cwd(), 'public', 'uploads');
      this.storageProvider.ensureDirectoryExists(uploadDir);
      fs.writeFileSync(path.join(uploadDir, storedName), file.buffer);
    }

    return this.prisma.ticketAttachment.create({
      data: {
        ticket_id: ticketId,
        original_name: file.originalname || 'attachment',
        stored_name: storedName,
        file_size: file.size || 0,
      },
    });
  }

  async getAttachments(ticketId: number) {
    return this.prisma.ticketAttachment.findMany({
      where: { ticket_id: ticketId },
      orderBy: { uploaded_at: 'desc' },
    });
  }

  async deleteAttachment(attachmentId: number) {
    const attachment = await this.prisma.ticketAttachment.findUnique({
      where: { id: attachmentId },
    });

    if (!attachment) {
      throw new NotFoundException(`Attachment with ID ${attachmentId} not found.`);
    }

    const filePath = path.join(process.cwd(), 'public', 'uploads', attachment.stored_name);
    this.storageProvider.deleteFile(filePath);

    return this.prisma.ticketAttachment.delete({
      where: { id: attachmentId },
    });
  }
}

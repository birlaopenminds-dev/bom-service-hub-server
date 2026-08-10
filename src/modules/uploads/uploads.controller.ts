import {
  Controller,
  Post,
  Get,
  Param,
  UseInterceptors,
  UploadedFile,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiConsumes, ApiBody, ApiResponse, ApiParam } from '@nestjs/swagger';
import { UploadsService } from './uploads.service';
import { CustomFileUploadInterceptor } from './interceptors/file-upload.interceptor';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { Response } from 'express';

@ApiTags('Uploads')
@Controller({ path: 'uploads', version: '1' })
export class UploadsController {
  constructor(private readonly uploadsService: UploadsService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @UseInterceptors(CustomFileUploadInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file'],
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description: 'Single attachment file to upload (image, document, PDF)',
        },
      },
    },
  })
  @ApiOperation({ summary: 'Upload file to public uploads storage' })
  @ApiResponse({ status: 201, description: 'File uploaded successfully' })
  @ApiResponse({ status: 400, description: 'No file provided or unsupported file format' })
  @ApiResponse({ status: 401, description: 'Unauthorized token or session revoked' })
  async uploadFile(@UploadedFile() file: Express.Multer.File) {
    return this.uploadsService.handleFileUpload(file);
  }

  @Get(':filename')
  @ApiOperation({ summary: 'Retrieve / stream uploaded file by filename' })
  @ApiParam({ name: 'filename', type: String, description: 'Target filename to retrieve' })
  @ApiResponse({ status: 200, description: 'File content stream returned successfully' })
  @ApiResponse({ status: 404, description: 'File not found on server' })
  async getFile(@Param('filename') filename: string, @Res() res: Response) {
    const filePath = this.uploadsService.getFilePath(filename);
    return res.sendFile(filePath);
  }
}

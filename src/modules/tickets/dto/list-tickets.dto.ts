import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBooleanString, IsDateString, IsEnum, IsInt, IsOptional, IsString } from 'class-validator';
import { Type } from 'class-transformer';
import { Priority, TicketStatus } from '@prisma/client';

export class ListTicketsDto {
  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @Type(() => Number)
  page?: number;

  @ApiPropertyOptional({ example: 10 })
  @IsOptional()
  @Type(() => Number)
  limit?: number;

  @ApiPropertyOptional({ example: 'laptop' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ enum: TicketStatus })
  @IsOptional()
  @IsEnum(TicketStatus)
  status?: TicketStatus;

  @ApiPropertyOptional({ enum: Priority })
  @IsOptional()
  @IsEnum(Priority)
  priority?: Priority;

  @ApiPropertyOptional({ example: 1, description: 'Filter by Department ID' })
  @IsOptional()
  @IsInt()
  @Type(() => Number)
  department_id?: number;

  @ApiPropertyOptional({ example: 2, description: 'Filter by Category ID' })
  @IsOptional()
  @IsInt()
  @Type(() => Number)
  category_id?: number;

  @ApiPropertyOptional({ example: 3, description: 'Filter by Subcategory ID' })
  @IsOptional()
  @IsInt()
  @Type(() => Number)
  subcategory_id?: number;

  @ApiPropertyOptional({ example: 4, description: 'Filter by Assigned User ID' })
  @IsOptional()
  @IsInt()
  @Type(() => Number)
  assigned_to?: number;

  @ApiPropertyOptional({ description: 'Filter tickets breaching SLA due_at' })
  @IsOptional()
  @IsBooleanString()
  slaBreached?: string;

  @ApiPropertyOptional({ example: '2026-01-01T00:00:00.000Z' })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({ example: '2026-12-31T23:59:59.000Z' })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiPropertyOptional({ example: 'OPEN_DELAYED', description: 'Filter by Performance & SLA Status' })
  @IsOptional()
  @IsString()
  performanceStatus?: string;
}

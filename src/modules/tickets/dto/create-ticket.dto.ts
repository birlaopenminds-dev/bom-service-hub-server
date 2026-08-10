import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsInt, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { Type } from 'class-transformer';
import { Priority } from '@prisma/client';

export class CreateTicketDto {
  @ApiProperty({ example: 1 })
  @IsInt()
  @Type(() => Number)
  @IsNotEmpty()
  department_id: number;

  @ApiProperty({ example: 2 })
  @IsInt()
  @Type(() => Number)
  @IsNotEmpty()
  category_id: number;

  @ApiProperty({ example: 3 })
  @IsInt()
  @Type(() => Number)
  @IsNotEmpty()
  subcategory_id: number;

  @ApiProperty({ enum: Priority, example: Priority.medium })
  @IsEnum(Priority)
  priority: Priority;

  @ApiProperty({ example: 'Laptop won\'t turn on' })
  @IsString()
  @IsNotEmpty()
  subject: string;

  @ApiProperty({ example: 'Power light blinks red and laptop shuts down after 5 seconds.' })
  @IsString()
  @IsNotEmpty()
  description: string;

  @ApiPropertyOptional({ example: 4 })
  @IsOptional()
  @IsInt()
  @Type(() => Number)
  assigned_to?: number;
}

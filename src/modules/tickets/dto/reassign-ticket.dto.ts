import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { Type } from 'class-transformer';

export class ReassignTicketDto {
  @ApiProperty({ example: 4 })
  @IsInt()
  @Type(() => Number)
  @IsNotEmpty()
  assigned_to: number;

  @ApiPropertyOptional({ example: 'Reassigning to specialized hardware engineer.' })
  @IsOptional()
  @IsString()
  reason?: string;
}

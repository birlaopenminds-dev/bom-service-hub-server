import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsNotEmpty, IsOptional, IsString, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateSubcategoryDto {
  @ApiProperty({ example: 1 })
  @IsInt()
  @Type(() => Number)
  @IsNotEmpty()
  category_id: number;

  @ApiProperty({ example: 'Laptop Hardware Repair' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiPropertyOptional({ example: 2 })
  @IsOptional()
  @IsInt()
  @Type(() => Number)
  default_assignee_id?: number;

  @ApiPropertyOptional({ example: 24, description: 'Turnaround time in hours' })
  @IsOptional()
  @IsInt()
  @Type(() => Number)
  @Min(1)
  tat_hours?: number;
}

import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsInt, IsOptional, IsString, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class UpdateSubcategoryDto {
  @ApiPropertyOptional({ example: 'Laptop Screen Replacement' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ example: 2 })
  @IsOptional()
  @IsInt()
  @Type(() => Number)
  default_assignee_id?: number;

  @ApiPropertyOptional({ example: 48 })
  @IsOptional()
  @IsInt()
  @Type(() => Number)
  @Min(1)
  tat_hours?: number;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  is_active?: boolean;

  //category_id
  @ApiPropertyOptional({ example: 2 })
  @IsOptional()
  @IsInt()
  @Type(() => Number)
  category_id?: number;
}

import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsNotEmpty, IsString } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateCategoryDto {
  @ApiProperty({ example: 1 })
  @IsInt()
  @Type(() => Number)
  @IsNotEmpty()
  department_id: number;

  @ApiProperty({ example: 'Hardware Issues' })
  @IsString()
  @IsNotEmpty()
  name: string;
}

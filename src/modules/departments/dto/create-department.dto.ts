import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class CreateDepartmentDto {
  @ApiProperty({ example: 'Information Technology' })
  @IsString()
  @IsNotEmpty()
  name: string;
}

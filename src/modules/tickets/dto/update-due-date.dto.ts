import { ApiProperty } from '@nestjs/swagger';
import { IsDateString, IsNotEmpty, IsString } from 'class-validator';

export class UpdateDueDateDto {
  @ApiProperty({ example: '2026-08-05T18:00:00.000Z' })
  @IsDateString()
  @IsNotEmpty()
  due_at: string;

  @ApiProperty({ example: 'Extended due date to allow procurement of replacement parts.' })
  @IsString()
  @IsNotEmpty()
  reason: string;
}

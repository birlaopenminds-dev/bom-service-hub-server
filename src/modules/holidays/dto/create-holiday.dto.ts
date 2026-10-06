import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsDateString, IsBoolean, IsOptional } from 'class-validator';

export class CreateHolidayDto {
  @ApiProperty({ example: 'Gandhi Jayanti', description: 'Name of the holiday' })
  @IsNotEmpty({ message: 'Holiday name is required' })
  @IsString({ message: 'Holiday name must be a string' })
  name: string;

  @ApiProperty({ example: '2026-10-02', description: 'Date of the holiday in YYYY-MM-DD format' })
  @IsNotEmpty({ message: 'Holiday date is required' })
  @IsDateString({}, { message: 'Date must be a valid ISO date string (YYYY-MM-DD)' })
  date: string;

  @ApiPropertyOptional({ example: true, default: true, description: 'Whether the holiday is active' })
  @IsOptional()
  @IsBoolean({ message: 'is_active must be a boolean' })
  is_active?: boolean;
}

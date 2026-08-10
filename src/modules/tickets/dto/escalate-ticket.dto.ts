import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class EscalateTicketDto {
  @ApiProperty({ example: 'No response from technician for over 24 hours.' })
  @IsString()
  @IsNotEmpty()
  reason: string;
}

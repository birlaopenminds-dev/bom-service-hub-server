import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class AddCommentDto {
  @ApiProperty({ example: 'Please send the serial number of the laptop.' })
  @IsString()
  @IsNotEmpty()
  comment: string;
}

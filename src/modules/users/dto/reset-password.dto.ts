import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MinLength } from 'class-validator';

export class ResetUserPasswordDto {
  @ApiProperty({
    example: 'NewTemporaryPassword@123',
    description: 'New password for the target user account (must be at least 8 characters with upper, lower, digit & special char)',
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(8)
  newPassword: string;
}

export class AdminResetUserPasswordDto extends ResetUserPasswordDto {}


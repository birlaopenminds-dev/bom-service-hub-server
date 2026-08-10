import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsString, MinLength } from 'class-validator';

export class RequestResetPasswordDto {
  @ApiProperty({ example: 'user@bomservicehub.com' })
  @IsEmail()
  @IsNotEmpty()
  email: string;
}

export class ConfirmResetPasswordDto {
  @ApiProperty({ example: 'reset-token-uuid-or-string' })
  @IsString()
  @IsNotEmpty()
  token: string;

  @ApiProperty({ example: 'NewSecurePass@2026' })
  @IsString()
  @IsNotEmpty()
  @MinLength(8)
  newPassword: string;
}

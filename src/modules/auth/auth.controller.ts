import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  Req,
  Res,
  UseGuards,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { RequestResetPasswordDto, ConfirmResetPasswordDto } from './dto/reset-password.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { GetUser } from '../../common/decorators/get-user.decorator';
import { RateLimit } from '../../common/decorators/rate-limit.decorator';

@ApiTags('Auth')
@Controller({ path: 'auth', version: '1' })
export class AuthController {
  constructor(private readonly authService: AuthService) { }

  private setRefreshTokenCookie(res: Response, token: string) {
    res.cookie('refreshToken', token, {
      httpOnly: true,
      secure: true,
      sameSite: 'strict',
      path: '/',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });
  }

  // /api/v1/auth/login
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @RateLimit({ ttl: 900, limit: 5 }) // 5 attempts per 15 minutes
  @ApiOperation({ summary: 'Authenticate user & receive JWT access token (refresh token set in HttpOnly cookie)' })
  @ApiResponse({ status: 200, description: 'Login successful' })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
  async login(
    @Body() loginDto: LoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const ipAddress = req.ip || req.connection?.remoteAddress;
    const userAgent = req.get('user-agent');
    const result = await this.authService.login(loginDto, ipAddress, userAgent);

    this.setRefreshTokenCookie(res, result.tokens.refreshToken);

    return {
      user: result.user,
      accessToken: result.tokens.accessToken,
    };
  }

  // /api/v1/auth/refresh
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Refresh JWT access token using valid refresh token cookie' })
  @ApiResponse({ status: 200, description: 'Token refreshed successfully' })
  async refreshToken(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const refreshToken = req.cookies?.refreshToken;
    if (!refreshToken) {
      throw new UnauthorizedException(
        'Refresh token is missing. Please log in again.',
      );
    }

    const result = await this.authService.refreshToken(refreshToken);

    this.setRefreshTokenCookie(res, result.tokens.refreshToken);

    return {
      accessToken: result.tokens.accessToken,
    };
  }

  // /api/v1/auth/logout
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Logout & blacklist current access and refresh tokens' })
  @ApiResponse({ status: 200, description: 'Logout successful' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async logout(
    @GetUser() user: any,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const refreshToken = req.cookies?.refreshToken;
    const result = await this.authService.logout(user.id, user.rawToken, refreshToken);

    res.clearCookie('refreshToken', {
      httpOnly: true,
      secure: true,
      sameSite: 'strict',
      path: '/',
    });

    return result;
  }

  // /api/v1/auth/change-password
  @Post('change-password')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Change current logged-in user password' })
  @ApiResponse({ status: 200, description: 'Password changed successfully' })
  @ApiResponse({ status: 400, description: 'Invalid current password or validation error' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async changePassword(
    @GetUser('id') userId: number,
    @Body() dto: ChangePasswordDto,
  ) {
    return this.authService.changePassword(userId, dto);
  }

  // /api/v1/auth/request-reset-password
  @Post('request-reset-password')
  @HttpCode(HttpStatus.OK)
  @RateLimit({ ttl: 86400, limit: 3 }) // 3 attempts per 24 hours
  @ApiOperation({ summary: 'Request password reset link via email' })
  @ApiResponse({ status: 200, description: 'Password reset email sent if user exists' })
  @ApiResponse({ status: 400, description: 'Validation failed' })
  async requestPasswordReset(@Body() dto: RequestResetPasswordDto) {
    return this.authService.requestPasswordReset(dto);
  }

  // /api/v1/auth/confirm-reset-password
  @Post('confirm-reset-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Confirm password reset using token' })
  @ApiResponse({ status: 200, description: 'Password reset successfully' })
  @ApiResponse({ status: 400, description: 'Invalid or expired token or validation error' })
  async confirmPasswordReset(@Body() dto: ConfirmResetPasswordDto) {
    return this.authService.confirmPasswordReset(dto);
  }
}

import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  NotFoundException,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../providers/database/prisma.service';
import { MailService } from '../mail/mail.service';
import { AuditService } from '../audit/audit.service';
import { EncryptionUtil } from '../../common/utils/encryption.util';
import { ValidatorsUtil } from '../../common/utils/validators.util';
import { LoginDto } from './dto/login.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { RequestResetPasswordDto, ConfirmResetPasswordDto } from './dto/reset-password.dto';
import { TokenType } from '@prisma/client';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private configService: ConfigService,
    private mailService: MailService,
    private auditService: AuditService,
  ) { }

  async validateUser(email: string, pass: string): Promise<any> {
    const user = await this.prisma.user.findUnique({
      where: { email },
    });

    if (!user || !user.is_active) {
      return null;
    }

    const isMatch = await EncryptionUtil.comparePassword(pass, user.password_hash);
    if (!isMatch) {
      return null;
    }

    return user;
  }

  private async generateTokens(userId: number, email: string, role: string) {
    const payload = { sub: userId, email, role };

    const accessToken = this.jwtService.sign(payload, {
      secret: this.configService.get('jwt.secret'),
      expiresIn: this.configService.get('jwt.expiresIn'),
    });

    const refreshToken = this.jwtService.sign(payload, {
      secret: this.configService.get('jwt.refreshSecret'),
      expiresIn: this.configService.get('jwt.refreshExpiresIn'),
    });

    return {
      accessToken,
      refreshToken,
    };
  }

  async login(loginDto: LoginDto, ipAddress?: string, userAgent?: string) {
    const user = await this.validateUser(loginDto.email, loginDto.password);

    if (!user) {
      throw new UnauthorizedException(
        'Invalid email address or password. Please check your login credentials and try again.',
      );
    }

    // Generate tokens
    const tokens = await this.generateTokens(user.id, user.email, user.role);

    // Update last login
    await this.prisma.user.update({
      where: { id: user.id },
      data: { last_login_at: new Date() },
    });

    // Audit log
    await this.auditService.log({
      userId: user.id,
      action: 'USER_LOGIN',
      resource: 'users',
      resourceId: user.id,
      ipAddress,
      userAgent,
    });

    return {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        department_id: user.department_id,
        password_changed: user.password_changed,
      },
      tokens: {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
      },
    };
  }

  async refreshToken(token: string) {
    try {
      const payload = this.jwtService.verify(token, {
        secret: this.configService.get('jwt.refreshSecret'),
      });

      const user = await this.prisma.user.findUnique({
        where: { id: payload.sub },
      });

      if (!user || !user.is_active) {
        throw new UnauthorizedException(
          'Your account is inactive or no longer exists. Please contact support.',
        );
      }

      // Check if refresh token is blacklisted
      const blacklisted = await this.prisma.blacklistedToken.findUnique({
        where: { token },
      });

      if (blacklisted) {
        throw new UnauthorizedException(
          'This session has expired or is invalid. Please log in again.',
        );
      }

      // Blacklist old refresh token (rotation)
      const expiresAt = new Date(payload.exp * 1000);
      await this.prisma.blacklistedToken.create({
        data: {
          token,
          token_type: TokenType.refresh,
          user_id: user.id,
          expires_at: expiresAt,
        },
      });

      // Generate new tokens
      const newTokens = await this.generateTokens(user.id, user.email, user.role);
      return {
        tokens: {
          accessToken: newTokens.accessToken,
          refreshToken: newTokens.refreshToken,
        },
      };
    } catch (err) {
      if (err instanceof UnauthorizedException) {
        throw err;
      }
      throw new UnauthorizedException(
        'Your session is invalid or has expired. Please log in again to continue.',
      );
    }
  }

  async logout(userId: number, rawAccessToken?: string, refreshToken?: string) {
    if (rawAccessToken) {
      const decodedAccess: any = this.jwtService.decode(rawAccessToken);
      const accessExpiresAt = decodedAccess?.exp
        ? new Date(decodedAccess.exp * 1000)
        : new Date(Date.now() + 15 * 60 * 1000);

      await this.prisma.blacklistedToken.upsert({
        where: { token: rawAccessToken },
        update: {},
        create: {
          token: rawAccessToken,
          token_type: TokenType.access,
          user_id: userId,
          expires_at: accessExpiresAt,
        },
      });
    }

    if (refreshToken) {
      const decodedRefresh: any = this.jwtService.decode(refreshToken);
      const refreshExpiresAt = decodedRefresh?.exp
        ? new Date(decodedRefresh.exp * 1000)
        : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

      await this.prisma.blacklistedToken.upsert({
        where: { token: refreshToken },
        update: {},
        create: {
          token: refreshToken,
          token_type: TokenType.refresh,
          user_id: userId,
          expires_at: refreshExpiresAt,
        },
      });
    }

    return { message: 'Logged out successfully.' };
  }

  async changePassword(userId: number, dto: ChangePasswordDto) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) throw new NotFoundException('User account not found.');

    const isMatch = await EncryptionUtil.comparePassword(dto.currentPassword, user.password_hash);

    if (!isMatch) throw new BadRequestException('The current password you entered is incorrect.');

    if (!ValidatorsUtil.isStrongPassword(dto.newPassword)) {
      throw new BadRequestException(
        'Password is too weak. It must be at least 8 characters long and include uppercase, lowercase, number, and special character.',
      );
    }

    const newHashedPassword = await EncryptionUtil.hashPassword(dto.newPassword);

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        password_hash: newHashedPassword,
        password_changed: true,
      },
    });

    return { message: 'Password changed successfully.' };
  }

  async requestPasswordReset(dto: RequestResetPasswordDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (!user || !user.is_active) {
      return { message: 'User not found or inactive. Please contact IT support.' };
    }

    const resetToken = this.jwtService.sign(
      { sub: user.id, email: user.email, type: 'password_reset' },
      {
        secret: this.configService.get('jwt.secret'),
        expiresIn: '15m',
      },
    );

    // Send reset email
    const isSent = await this.mailService.sendMail({
      to: user.email,
      subject: 'BOM ServiceHub - Reset Your Password',
      template: 'password-reset',
      context: {
        name: user.name,
        token: resetToken,
        resetUrl: `http://localhost:3000/reset-password?token=${resetToken}`,
        // resetUrl: `https://tickets.birlaopenminds.com/reset-password?token=${resetToken}`,
      },
    });

    if (!isSent) {
      throw new InternalServerErrorException(
        'Failed to send password reset email. Please verify SMTP mail configuration/App Password.',
      );
    }

    return { message: 'Email sent for password reset.' };
  }

  async confirmPasswordReset(dto: ConfirmResetPasswordDto) {
    let payload: any;
    try {
      payload = this.jwtService.verify(dto.token, {
        secret: this.configService.get('jwt.secret'),
      });
    } catch (err) {
      throw new BadRequestException('Invalid or expired password reset token.');
    }

    if (payload.type !== 'password_reset') {
      throw new BadRequestException('Invalid password reset token.');
    }

    // Check if token has already been used/blacklisted
    const isBlacklisted = await this.prisma.blacklistedToken.findUnique({
      where: { token: dto.token },
    });

    if (isBlacklisted) throw new BadRequestException('This password reset token has already been used.');

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
    });

    if (!user || !user.is_active) throw new BadRequestException('User account not found or is inactive.');

    if (!ValidatorsUtil.isStrongPassword(dto.newPassword)) {
      throw new BadRequestException(
        'Password must be at least 8 characters long and include uppercase, lowercase, number, and special character.',
      );
    }

    const newHashedPassword = await EncryptionUtil.hashPassword(dto.newPassword);

    // Update password in DB
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        password_hash: newHashedPassword,
        password_changed: true,
      },
    });

    // Blacklist used reset token
    const expiresAt = new Date(payload.exp * 1000);
    await this.prisma.blacklistedToken.create({
      data: {
        token: dto.token,
        token_type: TokenType.access,
        user_id: user.id,
        expires_at: expiresAt,
      },
    });

    return { message: 'Password reset completed successfully. Please log in.' };
  }

}

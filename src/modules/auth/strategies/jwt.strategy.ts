import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '@providers/database/prisma.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    private configService: ConfigService,
    private prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('jwt.secret') || process.env.JWT_SECRET || 'qY0VmIw44R7oL7OVB8emoFiMgdc5KPLWSeHKQohe9zX',
      passReqToCallback: true,
    });
  }

  async validate(req: any, payload: any) {
    const rawToken = ExtractJwt.fromAuthHeaderAsBearerToken()(req);

    // Check if token is blacklisted
    const isBlacklisted = await this.prisma.blacklistedToken.findUnique({
      where: { token: rawToken },
    });

    if (isBlacklisted) {
      throw new UnauthorizedException(
        'Your session has been signed out or revoked. Please log in again to continue.',
      );
    }

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
    });

    if (!user) {
      throw new UnauthorizedException(
        'User account not found. Please log in with a valid account.',
      );
    }

    if (!user.is_active) {
      throw new UnauthorizedException(
        'Your account has been deactivated. Please contact your system administrator or support team.',
      );
    }

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      department_id: user.department_id,
      rawToken,
    };
  }
}

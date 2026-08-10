import {
  Injectable,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  canActivate(context: ExecutionContext) {
    return super.canActivate(context);
  }

  handleRequest(err: any, user: any, info: any) {
    if (err || !user) {
      let message = 'Authentication required. Please log in to access this resource.';
      if (info?.message) {
        const infoMsg = String(info.message).toLowerCase();
        if (infoMsg.includes('jwt expired') || infoMsg.includes('token expired')) {
          message = 'Your login session has expired. Please log in again to continue.';
        } else if (infoMsg.includes('invalid') || infoMsg.includes('malformed') || infoMsg.includes('signature')) {
          message = 'Invalid authentication token. Please log in again.';
        } else if (infoMsg.includes('no auth token') || infoMsg.includes('missing')) {
          message = 'Authentication token is missing. Please include a valid Bearer token in the Authorization header.';
        }
      }
      throw (
        err ||
        new UnauthorizedException(message)
      );
    }

    return user;
  }
}

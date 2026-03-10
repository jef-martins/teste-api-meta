import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { AuthService } from './auth.service';

@Injectable()
export class WsAuthGuard implements CanActivate {
  constructor(private authService: AuthService) {}

  canActivate(context: ExecutionContext): boolean {
    const client = context.switchToWs().getClient();
    const token = client.handshake?.auth?.token || client.handshake?.query?.token;

    if (!token) return false;

    try {
      const payload = this.authService.verifyToken(token as string);
      client.data.user = {
        id: payload.id,
        email: payload.email,
        papel: payload.papel,
      };
      return true;
    } catch {
      return false;
    }
  }
}

import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey:
        process.env.JWT_SECRET || 'telebots-dev-secret-change-in-production',
    });
  }

  validate(payload: { id: string; email: string; papel: string; master: boolean }) {
    return { id: payload.id, email: payload.email, papel: payload.papel, master: payload.master ?? false };
  }
}

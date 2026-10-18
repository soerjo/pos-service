import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { loadUmsPublicKey } from '../../../common/utils/ums-jwt-key.util.js';
import { AuthService } from '../auth.service.js';
import { AuthUser } from 'src/common/interfaces/auth-user.interface.js';

/**
 * JWT strategy that verifies access tokens issued by ums-service (RS256).
 * Tokens are verified locally against the UMS public key
 * (env: UMS_JWT_PUBLIC_KEY or UMS_JWT_PUBLIC_KEY_PATH) — no per-request call to UMS.
 * After cryptographic verification, the local User record (by UMS subject id)
 * is resolved to enrich the request user with POS-local data.
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private configService: ConfigService,
    private authService: AuthService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: loadUmsPublicKey(
        configService.get<string>('UMS_JWT_PUBLIC_KEY'),
        configService.get<string>('UMS_JWT_PUBLIC_KEY_PATH'),
      ),
      algorithms: ['RS256'],
    });
  }

  async validate(payload: {
    sub: string;
    email?: string;
    roles?: string[];
    orgs?: string[];
  }): Promise<AuthUser> {
    if (!payload.sub) {
      throw new UnauthorizedException('Invalid token payload');
    }
    // Local user record is optional data enrichment; fallback to minimal AuthUser if not in local DB.
    let local: AuthUser | null = null;
    try {
      local = await this.authService.validateUserById(payload.sub);
    } catch {
      local = null;
    }

    if (local) {
      return local;
    }

    return {
      id: payload.sub,
      email: payload.email ?? '',
      firstName: null,
      lastName: null,
      role: 'USER',
      organizationId: '',
    };
  }
}

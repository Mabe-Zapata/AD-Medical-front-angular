import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { APP_SETTINGS } from '../../../core/config/app-settings';
import { toAppError } from '../../../core/http/api-error';
import { UserProfile } from '../domain/entities/session';
import { AuthRepository, IssuedToken } from '../domain/ports/auth.ports';

interface LoginResponse {
  access_token: string;
  expires_in: number;
}

interface MeResponse {
  id: string;
  roles: string[];
  permissions: string[];
}

@Injectable()
export class HttpAuthRepository extends AuthRepository {
  private readonly http = inject(HttpClient);
  private readonly base = inject(APP_SETTINGS).apiBaseUrl;

  async login(email: string, password: string): Promise<IssuedToken> {
    try {
      const response = await firstValueFrom(
        this.http.post<LoginResponse>(`${this.base}/auth/login`, { email, password }),
      );
      return { token: response.access_token, expiresInSeconds: response.expires_in };
    } catch (error) {
      throw toAppError(error, { unauthorizedAs: 'invalid_credentials' });
    }
  }

  async fetchProfile(token: string): Promise<UserProfile> {
    try {
      const me = await firstValueFrom(
        this.http.get<MeResponse>(`${this.base}/me`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
      );
      return { id: me.id, roles: me.roles, permissions: me.permissions };
    } catch (error) {
      throw toAppError(error);
    }
  }
}

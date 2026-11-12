import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, firstValueFrom } from 'rxjs';

import { APP_SETTINGS } from '../../../core/config/app-settings';
import { toAppError } from '../../../core/http/api-error';
import { NewUser, UserSummary } from '../domain/entities/users';
import { UsersRepository } from '../domain/ports/users.repository';

interface UserDto {
  id: string;
  email: string;
  nombres: string;
  apellidos: string;
  activo: boolean;
  roles: string[];
}

/** Talks to /api/v1/users and translates the backend's Spanish fields. */
@Injectable()
export class HttpUsersRepository extends UsersRepository {
  private readonly http = inject(HttpClient);
  private readonly base = `${inject(APP_SETTINGS).apiBaseUrl}/users`;

  async listUsers(): Promise<UserSummary[]> {
    const response = await this.call(
      this.http.get<{ items: UserDto[] }>(this.base, { params: new HttpParams().set('limit', 200) }),
    );
    return response.items.map((u) => ({
      id: u.id,
      email: u.email,
      firstName: u.nombres,
      lastName: u.apellidos,
      active: u.activo,
      roles: u.roles,
    }));
  }

  async createUser(user: NewUser): Promise<string> {
    const response = await this.call(
      this.http.post<{ id: string }>(this.base, {
        email: user.email,
        password: user.password,
        first_name: user.firstName,
        last_name: user.lastName,
        roles: user.roles,
      }),
    );
    return response.id;
  }

  private async call<T>(request: Observable<T>): Promise<T> {
    try {
      return await firstValueFrom(request);
    } catch (error) {
      throw toAppError(error);
    }
  }
}

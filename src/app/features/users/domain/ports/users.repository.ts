import { NewUser, UserSummary } from '../entities/users';

/** Port to the user administration API. Implementations throw `AppError`. */
export abstract class UsersRepository {
  /** Accounts ordered by email. */
  abstract listUsers(): Promise<UserSummary[]>;
  /** Returns the id of the new account. */
  abstract createUser(user: NewUser): Promise<string>;
}

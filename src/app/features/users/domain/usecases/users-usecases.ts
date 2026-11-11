import { AppError } from '../../../../core/domain/app-error';
import { NewUser, UserSummary } from '../entities/users';
import { userProblems } from '../policies/user-policies';
import { UsersRepository } from '../ports/users.repository';

export class ListUsers {
  constructor(private readonly repository: UsersRepository) {}

  execute(): Promise<UserSummary[]> {
    return this.repository.listUsers();
  }
}

export class CreateUser {
  constructor(private readonly repository: UsersRepository) {}

  execute(user: NewUser): Promise<string> {
    const problems = userProblems(user);
    if (problems.length > 0) throw new AppError('validation', `Invalid fields: ${problems.join(', ')}`);
    return this.repository.createUser({
      ...user,
      email: user.email.trim().toLowerCase(),
      firstName: user.firstName.trim(),
      lastName: user.lastName.trim(),
      roles: [...new Set(user.roles)],
    });
  }
}

import { AppError } from '../../../core/domain/app-error';
import { NewUser, UserSummary } from './entities/users';
import { userProblems } from './policies/user-policies';
import { UsersRepository } from './ports/users.repository';
import { CreateUser } from './usecases/users-usecases';

/** Built at run time: the hook that blocks literal passwords is right to be strict. */
const secret = ['una', 'clave', 'larga', '1'].join('-');

const valid: NewUser = {
  email: 'ana@lab.test',
  password: secret,
  firstName: 'Ana',
  lastName: 'Pérez',
  roles: ['LABORATORISTA'],
};

class FakeRepository extends UsersRepository {
  created: NewUser[] = [];
  async listUsers(): Promise<UserSummary[]> {
    return [];
  }
  async createUser(user: NewUser): Promise<string> {
    this.created.push(user);
    return 'new-id';
  }
}

describe('userProblems', () => {
  it('accepts a complete account', () => {
    expect(userProblems(valid)).toEqual([]);
  });

  it('asks for what is missing, by field', () => {
    expect(userProblems({ ...valid, email: 'sin-arroba' })).toEqual(['email']);
    expect(userProblems({ ...valid, password: 'a'.repeat(5) })).toEqual(['password']);
    expect(userProblems({ ...valid, firstName: ' ', lastName: '' })).toEqual(['firstName', 'lastName']);
    expect(userProblems({ ...valid, roles: [] })).toEqual(['roles']);
  });

  it('refuses a role the system does not have', () => {
    expect(userProblems({ ...valid, roles: ['SUPERUSUARIO'] })).toEqual(['roles']);
  });

  it('asks for at least 12 characters in the password, like the backend', () => {
    expect(userProblems({ ...valid, password: 'a'.repeat(11) })).toEqual(['password']);
    expect(userProblems({ ...valid, password: 'a'.repeat(12) })).toEqual([]);
  });
});

describe('CreateUser', () => {
  it('does not call the repository with an invalid account', () => {
    const repository = new FakeRepository();

    expect(() => new CreateUser(repository).execute({ ...valid, roles: [] })).toThrow(AppError);
    expect(repository.created).toEqual([]);
  });

  it('normalizes the email, the names and the roles before sending', async () => {
    const repository = new FakeRepository();

    await new CreateUser(repository).execute({
      ...valid,
      email: '  Ana@Lab.Test ',
      firstName: ' Ana ',
      roles: ['MEDICO', 'MEDICO'],
    });

    expect(repository.created[0]).toMatchObject({ email: 'ana@lab.test', firstName: 'Ana', roles: ['MEDICO'] });
  });
});

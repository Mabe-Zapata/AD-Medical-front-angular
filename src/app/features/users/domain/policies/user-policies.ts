import { ASSIGNABLE_ROLES, NewUser } from '../entities/users';

export const MIN_PASSWORD_LENGTH = 12;

/** What is wrong with a new account, as field names, before asking the backend (which says the same). */
export function userProblems(user: NewUser): string[] {
  const problems: string[] = [];
  const email = user.email.trim();
  if (email.length < 3 || email.length > 255 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) problems.push('email');
  if (user.password.length < MIN_PASSWORD_LENGTH || user.password.length > 256) problems.push('password');
  const first = user.firstName.trim();
  if (first.length < 1 || first.length > 100) problems.push('firstName');
  const last = user.lastName.trim();
  if (last.length < 1 || last.length > 100) problems.push('lastName');
  const roles = new Set(user.roles);
  if (roles.size < 1 || [...roles].some((role) => !(ASSIGNABLE_ROLES as readonly string[]).includes(role))) {
    problems.push('roles');
  }
  return problems;
}

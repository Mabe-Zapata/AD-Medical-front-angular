import { AppError } from '../../core/domain/app-error';
import { describeError } from './error-message';

describe('describeError', () => {
  it('words known failures in Spanish', () => {
    expect(describeError(new AppError('forbidden', 'x')).message).toBe(
      'No tienes permiso para realizar esta acción.',
    );
    expect(describeError(new AppError('network', 'x')).message).toContain('No se pudo conectar');
  });

  it('tells the user when the server is down', () => {
    expect(describeError(new AppError('unavailable', 'x')).message).toContain('no está disponible');
  });

  it('lets a screen override the wording and keeps the support code', () => {
    const view = describeError(new AppError('conflict', 'x', 'corr-1'), { conflict: 'Ya existe.' });
    expect(view).toEqual({ message: 'Ya existe.', supportCode: 'corr-1' });
  });

  it('translates the fields the backend rejected', () => {
    expect(describeError(new AppError('validation', 'Invalid fields: nombre')).message).toBe(
      'Revisa el nombre e inténtalo de nuevo.',
    );
    expect(
      describeError(new AppError('validation', 'Invalid fields: email, password, id')).message,
    ).toBe('Revisa el correo y la contraseña e inténtalo de nuevo.');
  });

  it('says to review the data when no rejected field is known, without leaking names', () => {
    const view = describeError(new AppError('validation', 'Invalid fields: id, is_active'));
    expect(view.message).toBe('Revisa los datos ingresados e inténtalo de nuevo.');
  });

  it('never shows the internal English message', () => {
    for (const kind of [
      'invalid_credentials',
      'unauthenticated',
      'forbidden',
      'not_found',
      'conflict',
      'validation',
      'rate_limited',
      'network',
      'unavailable',
      'not_staff',
      'unknown',
    ] as const) {
      const view = describeError(new AppError(kind, 'email and password are required'));
      expect(view.message).not.toContain('required');
    }
  });

  it('does not throw on foreign errors', () => {
    expect(describeError(new Error('boom')).message).toBe(
      'Ocurrió un error inesperado. Inténtalo de nuevo.',
    );
    expect(describeError('text').message).toBe('Ocurrió un error inesperado. Inténtalo de nuevo.');
  });
});

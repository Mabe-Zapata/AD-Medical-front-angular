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

  it('appends which fields the backend rejected', () => {
    const view = describeError(new AppError('validation', 'Invalid fields: nombre'));
    expect(view.message).toBe('Los datos enviados no son válidos. Invalid fields: nombre');
  });

  it('does not throw on foreign errors', () => {
    expect(describeError(new Error('boom')).message).toBe('Ocurrió un error inesperado.');
    expect(describeError('text').message).toBe('Ocurrió un error inesperado.');
  });
});

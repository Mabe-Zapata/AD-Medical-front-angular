import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';

import { AppError } from '../../../../core/domain/app-error';
import { SessionState } from '../session.state';
import { LoginPage, safeRedirect } from './login.page';

describe('safeRedirect', () => {
  it('keeps same-site paths', () => {
    expect(safeRedirect('/conocimiento/reglas')).toBe('/conocimiento/reglas');
  });

  it.each([null, '', 'https://evil.test', '//evil.test', 'conocimiento'])(
    'falls back for %s',
    (target) => {
      expect(safeRedirect(target)).toBe('/inicio');
    },
  );
});

describe('LoginPage', () => {
  const signIn = vi.fn();

  function setup(signInImpl: (email: string, password: string) => Promise<unknown> = signIn) {
    TestBed.configureTestingModule({
      providers: [provideRouter([]), { provide: SessionState, useValue: { signIn: signInImpl } }],
    });
    const router = TestBed.inject(Router);
    const navigate = vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);
    const fixture = TestBed.createComponent(LoginPage);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    return { fixture, el, navigate };
  }

  function fill(el: HTMLElement, email: string, password: string): void {
    const set = (selector: string, value: string) => {
      const input = el.querySelector<HTMLInputElement>(selector)!;
      input.value = value;
      input.dispatchEvent(new Event('input'));
    };
    set('#email', email);
    set('#password', password);
  }

  beforeEach(() => signIn.mockReset());

  it('shows validation messages instead of calling the API when the form is empty', async () => {
    const { fixture, el } = setup();

    el.querySelector<HTMLButtonElement>('button[type=submit]')!.click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(signIn).not.toHaveBeenCalled();
    expect(el.textContent).toContain('Escribe un correo válido.');
  });

  it('signs in and goes to the start page', async () => {
    signIn.mockResolvedValue({});
    const { fixture, el, navigate } = setup();

    fill(el, 'doctor@demo.test', 'secret');
    el.querySelector<HTMLButtonElement>('button[type=submit]')!.click();
    await fixture.whenStable();

    expect(signIn).toHaveBeenCalledWith('doctor@demo.test', 'secret');
    expect(navigate).toHaveBeenCalledWith('/inicio');
  });

  it('explains wrong credentials in Spanish and never shows a support code', async () => {
    const { fixture, el, navigate } = setup(async () => {
      throw new AppError('invalid_credentials', 'x', 'corr-123');
    });

    fill(el, 'doctor@demo.test', 'bad');
    el.querySelector<HTMLButtonElement>('button[type=submit]')!.click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(el.textContent).toContain('Ese correo y esa contraseña no coinciden.');
    expect(el.textContent).not.toContain('corr-123');
    expect(navigate).not.toHaveBeenCalled();
  });

  it('tells a patient to use the patient portal', async () => {
    const { fixture, el } = setup(async () => {
      throw new AppError('not_staff', 'x');
    });

    fill(el, 'paciente@demo.test', 'secret');
    el.querySelector<HTMLButtonElement>('button[type=submit]')!.click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(el.textContent).toContain('portal del paciente');
  });
});

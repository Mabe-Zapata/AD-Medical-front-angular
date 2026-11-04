import { TestBed } from '@angular/core/testing';

import { AppError } from '../../../../core/domain/app-error';
import { isUuid } from '../../../../core/domain/dates';
import { SessionState } from '../../../auth/presentation/session.state';
import { ValidateReference } from '../../domain/usecases/knowledge-usecases';
import { NHANES_PACK } from '../review-pack';
import { ReviewPage } from './review.page';

describe('NHANES review pack', () => {
  const refs = NHANES_PACK.references;

  it('lists seven distinct drafts with valid ids and ordered limits', () => {
    expect(refs).toHaveLength(7);
    expect(new Set(refs.map((r) => r.id)).size).toBe(7);
    for (const ref of refs) {
      expect(isUuid(ref.id)).toBe(true);
      expect(ref.min).toBeLessThan(ref.max);
    }
  });

  it('has no gap or overlap between the age bands of each analyte and sex', () => {
    const groups = new Map<string, typeof refs>();
    for (const ref of refs) {
      const key = `${ref.analyte}|${ref.sex === 'Ambos' ? '*' : ref.sex}`;
      groups.set(key, [...(groups.get(key) ?? []), ref]);
    }
    // Sex-neutral bands share the age axis with the sex-specific ones: check each sex axis.
    for (const sex of ['Hombres', 'Mujeres']) {
      const axis = refs
        .filter((r) => r.analyte.startsWith('Hemoglobina') && (r.sex === sex || r.sex === 'Ambos'))
        .sort((a, b) => a.minAgeDays - b.minAgeDays);
      for (let i = 1; i < axis.length; i++) {
        expect(axis[i].minAgeDays).toBe((axis[i - 1].maxAgeDays ?? -2) + 1);
      }
      expect(axis.at(-1)?.maxAgeDays).toBeNull();
    }
  });
});

describe('ReviewPage', () => {
  // A plain object, not vi.fn(): vitest flags the rejected promise of a mock as unhandled.
  const calls: string[] = [];
  let outcome: () => Promise<void> = async () => undefined;
  const validateReference = {
    execute: (id: string) => {
      calls.push(id);
      return outcome();
    },
  };
  const first = NHANES_PACK.references[0];

  function setup(...granted: string[]) {
    TestBed.configureTestingModule({
      providers: [
        {
          provide: SessionState,
          useValue: { can: (p: string) => granted.includes(p), isSignedIn: () => true },
        },
        { provide: ValidateReference, useValue: validateReference },
      ],
    });
    const fixture = TestBed.createComponent(ReviewPage);
    fixture.detectChanges();
    return { fixture, el: fixture.nativeElement as HTMLElement };
  }

  const click = (el: HTMLElement, text: string) =>
    [...el.querySelectorAll<HTMLButtonElement>('button')]
      .find((b) => b.textContent?.includes(text))!
      .click();

  beforeEach(() => {
    calls.length = 0;
    outcome = async () => undefined;
  });

  it('shows the drafts and the open decisions to someone who cannot validate, without buttons', () => {
    const { el } = setup('conocimiento.leer');

    expect(el.textContent).toContain('Glucosa en plasma en ayunas');
    expect(el.textContent).toContain('82 – 123 mg/dL');
    expect(el.textContent).toContain('Decisiones que solo puede tomar el clínico');
    expect(el.querySelector('tbody button')).toBeNull();
    expect(el.textContent).toContain('Solo los médicos pueden publicar');
  });

  it('asks for confirmation before publishing and can be cancelled', () => {
    const { fixture, el } = setup('conocimiento.validar');

    click(el, 'Validar');
    fixture.detectChanges();
    expect(el.textContent).toContain('No se puede editar después');
    expect(calls).toEqual([]);

    click(el, 'Cancelar');
    fixture.detectChanges();
    expect(el.textContent).not.toContain('No se puede editar después');
    expect(calls).toEqual([]);
  });

  it('publishes one draft after confirming and marks it as validated', async () => {
    const { fixture, el } = setup('conocimiento.validar');

    click(el, 'Validar');
    fixture.detectChanges();
    click(el, 'Sí, publicar');
    await fixture.whenStable();
    fixture.detectChanges();

    expect(calls).toEqual([first.id]);
    expect(el.textContent).toContain('Rango publicado');
    expect(el.querySelectorAll('tbody button')).toHaveLength(6);
  });

  it('explains in Spanish that a draft is missing from the connected database', async () => {
    outcome = async () => {
      throw new AppError('not_found', 'x', 'c-9');
    };
    const { fixture, el } = setup('conocimiento.validar');

    click(el, 'Validar');
    fixture.detectChanges();
    click(el, 'Sí, publicar');
    await fixture.whenStable();
    fixture.detectChanges();

    expect(el.textContent).toContain('no existe en la base de datos conectada');
    expect(el.textContent).toContain('c-9');
  });
});

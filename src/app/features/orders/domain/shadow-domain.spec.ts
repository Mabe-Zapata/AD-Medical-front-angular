import { AppError } from '../../../core/domain/app-error';
import { NewShadowEdit, ShadowEdit } from './entities/shadow';
import { SHADOW_CATEGORIES, shadowEditProblems } from './policies/shadow-policies';
import { ShadowRepository } from './ports/shadow.repository';
import { EditShadowFinding, GetShadowReport } from './usecases/shadow-usecases';

const ID = '3b9f2a52-1c61-4f0e-9d0a-6a1c1c2f7e11';
const SNAPSHOT = '8d3c7a11-92b4-4d0b-8e56-0f5d9a3b6c22';

const edit = (over: Partial<NewShadowEdit>): NewShadowEdit => ({
  action: 'CONFIRMAR',
  newCategory: null,
  reason: 'Coincide con la clínica.',
  ...over,
});

describe('shadowEditProblems', () => {
  it('accepts a confirmation with a reason and no category', () => {
    expect(shadowEditProblems('ANEMIA', 'ANEMIA_LEVE', edit({}))).toEqual([]);
  });

  it('accepts a discard with a reason and no category', () => {
    expect(shadowEditProblems('HIERRO', 'SIN_DEFICIENCIA', edit({ action: 'DESCARTAR' }))).toEqual([]);
  });

  it('requires a reason that is not blank', () => {
    expect(shadowEditProblems('ANEMIA', 'ANEMIA_LEVE', edit({ reason: '   ' }))).toContain(
      'a reason is required',
    );
  });

  it('refuses a reason longer than the API accepts', () => {
    expect(shadowEditProblems('ANEMIA', 'ANEMIA_LEVE', edit({ reason: 'x'.repeat(501) }))).toContain(
      'the reason is too long',
    );
  });

  it('a modification needs a new category', () => {
    expect(shadowEditProblems('ANEMIA', 'ANEMIA_LEVE', edit({ action: 'MODIFICAR' }))).toContain(
      'the new category is required',
    );
  });

  it('a modification takes only a category of that finding', () => {
    const problems = shadowEditProblems(
      'ANEMIA',
      'ANEMIA_LEVE',
      edit({ action: 'MODIFICAR', newCategory: 'PREDIABETES' }),
    );
    expect(problems).toContain('the category is not valid for this finding');
  });

  it('a modification must differ from the suggestion', () => {
    const problems = shadowEditProblems(
      'ANEMIA',
      'ANEMIA_LEVE',
      edit({ action: 'MODIFICAR', newCategory: 'ANEMIA_LEVE' }),
    );
    expect(problems).toContain('the new category must differ from the suggestion');
  });

  it('accepts a modification to another category of the same finding', () => {
    expect(
      shadowEditProblems('ANEMIA', 'ANEMIA_LEVE', edit({ action: 'MODIFICAR', newCategory: 'ANEMIA_GRAVE' })),
    ).toEqual([]);
  });

  it('confirming or discarding must not send a category', () => {
    expect(shadowEditProblems('ANEMIA', 'ANEMIA_LEVE', edit({ newCategory: 'SIN_ANEMIA' }))).toContain(
      'only a modification takes a category',
    );
  });

  it('knows the categories of the three editable findings', () => {
    expect(Object.keys(SHADOW_CATEGORIES)).toEqual(['ANEMIA', 'HIERRO', 'DIABETES']);
  });
});

/** A repository that only records what it was asked. */
class RecordingRepository extends ShadowRepository {
  readonly calls: unknown[][] = [];
  async getReport(orderId: string) {
    this.calls.push(['report', orderId]);
    return { findings: [] };
  }
  async recordSnapshot(): Promise<never> {
    throw new Error('not used');
  }
  async editFinding(...args: unknown[]) {
    this.calls.push(['edit', ...args]);
    return 'ANEMIA_GRAVE';
  }
  async listEdits(): Promise<ShadowEdit[]> {
    return [];
  }
}

describe('shadow use cases', () => {
  it('refuse an order id that is not a UUID without calling the API', () => {
    const repo = new RecordingRepository();
    expect(() => new GetShadowReport(repo).execute('nope')).toThrow(AppError);
    expect(repo.calls).toEqual([]);
  });

  it('refuse an invalid edit without calling the API', () => {
    const repo = new RecordingRepository();
    expect(() =>
      new EditShadowFinding(repo).execute(ID, SNAPSHOT, 'ANEMIA', 'ANEMIA_LEVE', edit({ reason: '' })),
    ).toThrow(AppError);
    expect(repo.calls).toEqual([]);
  });

  it('send the reason trimmed', async () => {
    const repo = new RecordingRepository();
    await new EditShadowFinding(repo).execute(
      ID,
      SNAPSHOT,
      'ANEMIA',
      'ANEMIA_LEVE',
      edit({ reason: '  Coincide.  ' }),
    );
    expect(repo.calls[0]).toEqual([
      'edit',
      ID,
      SNAPSHOT,
      'ANEMIA',
      { action: 'CONFIRMAR', newCategory: null, reason: 'Coincide.' },
    ]);
  });
});

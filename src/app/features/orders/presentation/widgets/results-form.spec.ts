import { TestBed } from '@angular/core/testing';

import { ResultsFormComponent, ResultsFormDraft } from './results-form';

const DETAIL = '6f1c2b3a-4d5e-4f60-8a7b-9c0d1e2f3a4b';
const TEST = '11111111-2222-4333-8444-555555555555';
const HB = { id: 'a0000000-0000-4000-8000-00000000b001', name: 'Hemoglobina', unit: 'g/dL', valueType: 'NUMERICO' };
const HT = { id: 'a0000000-0000-4000-8000-00000000b002', name: 'Hematocrito', unit: '%', valueType: 'NUMERICO' };

describe('ResultsFormComponent', () => {
  it('pre-fills the test identifier the laboratory came with from the worklist', async () => {
    const fixture = TestBed.createComponent(ResultsFormComponent);
    fixture.componentRef.setInput('initialDetailId', DETAIL);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const id = fixture.nativeElement.querySelector('#result-test') as HTMLElement;
    expect(id.textContent?.trim()).toBe(DETAIL);
  });

  it('leaves the identifier empty when there is nothing to pre-fill', async () => {
    const fixture = TestBed.createComponent(ResultsFormComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const id = fixture.nativeElement.querySelector('#result-test') as HTMLElement;
    expect(id.textContent?.trim()).toBe('');
  });

  it('prefills the mandatory analytes of the chosen test, with their usual unit', async () => {
    const fixture = TestBed.createComponent(ResultsFormComponent);
    fixture.componentRef.setInput('tests', [{ detailId: DETAIL, testTypeId: TEST, status: 'PENDIENTE', name: 'Hemograma' }]);
    fixture.componentRef.setInput('analytes', [HB, HT]);
    fixture.componentRef.setInput('testAnalytes', [
      { id: HB.id, name: HB.name, unit: 'g/dL', valueType: 'NUMERICO', mandatory: true },
      { id: HT.id, name: HT.name, unit: '%', valueType: 'NUMERICO', mandatory: false },
    ]);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const analyte = fixture.nativeElement.querySelector('#analyte-0') as HTMLSelectElement;
    const unit = fixture.nativeElement.querySelector('#unit-0') as HTMLInputElement;
    expect(fixture.nativeElement.querySelectorAll('select[id^="analyte-"]')).toHaveLength(1);
    expect(analyte.value).toBe(HB.id);
    expect(unit.value).toBe('g/dL');
  });

  it('tells the page which test was chosen, so it can load that test analytes', async () => {
    const fixture = TestBed.createComponent(ResultsFormComponent);
    const chosen: string[] = [];
    fixture.componentInstance.testChanged.subscribe((id) => chosen.push(id));
    fixture.componentRef.setInput('tests', [{ detailId: DETAIL, testTypeId: TEST, status: 'PENDIENTE', name: 'Hemograma' }]);
    fixture.componentRef.setInput('initialDetailId', DETAIL);
    fixture.detectChanges();
    await fixture.whenStable();

    expect(chosen).toEqual([TEST]);
  });
});

describe('ResultsFormComponent navigation and state', () => {
  it('offers a way back to the caller', () => {
    const fixture = TestBed.createComponent(ResultsFormComponent);
    const backs: number[] = [];
    fixture.componentInstance.back.subscribe(() => backs.push(1));
    fixture.detectChanges();

    [...(fixture.nativeElement as HTMLElement).querySelectorAll('button')]
      .find((b) => b.textContent?.includes('Regresar'))!
      .click();

    expect(backs).toEqual([1]);
  });

  it('reports dirty only once the person types, and the whole form as a draft', async () => {
    const fixture = TestBed.createComponent(ResultsFormComponent);
    const states: { dirty: boolean; draft: ResultsFormDraft }[] = [];
    fixture.componentInstance.state.subscribe((state) => states.push(state));
    fixture.detectChanges();
    await fixture.whenStable();
    expect(states.every((state) => !state.dirty)).toBe(true);

    const input = fixture.nativeElement.querySelector('#value-0') as HTMLInputElement;
    input.value = '13,5';
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    expect(states.at(-1)?.dirty).toBe(true);
    expect(states.at(-1)?.draft.rows[0].value).toBe('13,5');
  });
});


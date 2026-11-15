import { TestBed } from '@angular/core/testing';

import { ResultsFormComponent } from './results-form';

const DETAIL = '6f1c2b3a-4d5e-4f60-8a7b-9c0d1e2f3a4b';

describe('ResultsFormComponent', () => {
  it('pre-fills the test identifier the laboratory came with from the worklist', async () => {
    const fixture = TestBed.createComponent(ResultsFormComponent);
    fixture.componentRef.setInput('initialDetailId', DETAIL);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const input = fixture.nativeElement.querySelector('#result-test') as HTMLInputElement;
    expect(input.value).toBe(DETAIL);
  });

  it('leaves the identifier empty when there is nothing to pre-fill', async () => {
    const fixture = TestBed.createComponent(ResultsFormComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const input = fixture.nativeElement.querySelector('#result-test') as HTMLInputElement;
    expect(input.value).toBe('');
  });
});

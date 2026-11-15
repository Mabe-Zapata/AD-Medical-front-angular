import { TestBed } from '@angular/core/testing';

import { DialogComponent } from './dialog';

describe('DialogComponent', () => {
  function render() {
    const fixture = TestBed.createComponent(DialogComponent);
    fixture.componentRef.setInput('title', 'Tienes cambios sin guardar');
    fixture.componentRef.setInput('message', '¿Quieres guardarlos?');
    fixture.componentRef.setInput('actions', [
      { label: 'Guardar borrador', value: 'draft', tone: 'primary' },
      { label: 'Regresar sin guardar', value: 'discard', tone: 'danger' },
      { label: 'Seguir editando', value: 'stay', tone: 'ghost' },
    ]);
    fixture.componentRef.setInput('dismissValue', 'stay');
    fixture.detectChanges();
    return fixture;
  }

  it('shows the question as an alert dialog with every option', () => {
    const el = render().nativeElement as HTMLElement;

    expect(el.querySelector('[role=alertdialog]')?.getAttribute('aria-labelledby')).toBe('dialog-title');
    expect(el.textContent).toContain('Tienes cambios sin guardar');
    expect([...el.querySelectorAll('button')].map((b) => b.textContent?.trim())).toEqual([
      'Guardar borrador',
      'Regresar sin guardar',
      'Seguir editando',
    ]);
  });

  it('reports the value of the option the person picks', () => {
    const fixture = render();
    const chosen: string[] = [];
    fixture.componentInstance.chosen.subscribe((value) => chosen.push(value));

    (fixture.nativeElement.querySelectorAll('button')[1] as HTMLButtonElement).click();

    expect(chosen).toEqual(['discard']);
  });

  it('reports the dismiss value when Escape is pressed', () => {
    const fixture = render();
    const chosen: string[] = [];
    fixture.componentInstance.chosen.subscribe((value) => chosen.push(value));

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));

    expect(chosen).toEqual(['stay']);
  });
});

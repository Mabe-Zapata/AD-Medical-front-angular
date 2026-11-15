import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { BreadcrumbsComponent } from './breadcrumbs';

describe('BreadcrumbsComponent', () => {
  function render(items: { label: string; link?: string }[]) {
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
    const fixture = TestBed.createComponent(BreadcrumbsComponent);
    fixture.componentRef.setInput('items', items);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('links every step but the last, which is marked as the current place', () => {
    const el = render([
      { label: 'Inicio', link: '/inicio' },
      { label: 'Órdenes y resultados', link: '/ordenes' },
      { label: 'Orden 3B9F2A52' },
    ]);

    const links = [...el.querySelectorAll('a')].map((a) => a.getAttribute('href'));
    expect(links).toEqual(['/inicio', '/ordenes']);
    expect(el.querySelector('[aria-current="page"]')?.textContent).toBe('Orden 3B9F2A52');
  });

  it('is labelled for assistive technology and separates the steps', () => {
    const el = render([{ label: 'Inicio', link: '/inicio' }, { label: 'Órdenes y resultados' }]);

    expect(el.querySelector('nav')?.getAttribute('aria-label')).toBe('Migas de pan');
    expect(el.querySelectorAll('.sep')).toHaveLength(1);
  });
});

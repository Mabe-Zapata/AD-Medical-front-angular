import { ChangeDetectionStrategy, Component, input } from '@angular/core';

import { formatDate, formatRange } from '../../../../shared/presentation/format';
import { ReferenceRange } from '../../domain/entities/knowledge';
import { PaginatorComponent } from '../../../../shared/presentation/molecules/paginator';
import { PageState } from '../../../../shared/presentation/pagination';

@Component({
  selector: 'app-reference-table',
  imports: [PaginatorComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (references().length === 0) {
      <p class="empty">No hay referencias validadas para esta fecha.</p>
    } @else {
      <div class="table-wrap">
        <table class="table">
          <thead>
            <tr>
              <th>Versión</th>
              <th>Rango</th>
              <th>Sexo</th>
              <th>Edad (días)</th>
              <th>Método</th>
              <th>Vigencia</th>
            </tr>
          </thead>
          <tbody>
            @for (ref of pager.slice(references()); track ref.id) {
              <tr>
                <td>v{{ ref.version }}</td>
                <td>
                  <strong>{{ range(ref) }}</strong>
                </td>
                <td>{{ ref.sex ?? 'Cualquiera' }}</td>
                <td>{{ age(ref) }}</td>
                <td>{{ ref.method ?? '—' }}</td>
                <td>
                  {{ date(ref.startDate) }} – {{ ref.endDate ? date(ref.endDate) : 'sin fin' }}
                </td>
              </tr>
            }
          </tbody>
        </table>
      </div>
      <app-paginator [total]="references().length" [state]="pager" />
    }
  `,
})
export class ReferenceTableComponent {
  protected readonly pager = new PageState();
  readonly references = input.required<readonly ReferenceRange[]>();

  protected readonly date = formatDate;
  protected readonly range = (ref: ReferenceRange) => formatRange(ref.min, ref.max, ref.unit);
  protected readonly age = (ref: ReferenceRange) =>
    ref.minAgeDays === null && ref.maxAgeDays === null
      ? 'Todas'
      : `${ref.minAgeDays ?? 0} – ${ref.maxAgeDays ?? '∞'}`;
}

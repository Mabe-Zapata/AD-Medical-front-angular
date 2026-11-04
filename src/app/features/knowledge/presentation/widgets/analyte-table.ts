import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';

import { ChipComponent } from '../../../../shared/presentation/atoms/chip';
import { Analyte } from '../../domain/entities/knowledge';
import { VALUE_TYPE_LABELS, labelOf } from '../labels';

@Component({
  selector: 'app-analyte-table',
  imports: [RouterLink, ChipComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (analytes().length === 0) {
      <p class="empty">Todavía no hay analitos activos.</p>
    } @else {
      <div class="table-wrap">
        <table class="table">
          <thead>
            <tr>
              <th>Nombre</th>
              <th>Unidad</th>
              <th>Tipo de valor</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            @for (analyte of analytes(); track analyte.id) {
              <tr>
                <td>
                  <strong>{{ analyte.name }}</strong>
                </td>
                <td>{{ analyte.unit ?? '—' }}</td>
                <td>
                  <app-chip>{{ label(analyte.valueType) }}</app-chip>
                </td>
                <td>
                  <a [routerLink]="['/conocimiento/analitos', analyte.id]">Referencias →</a>
                </td>
              </tr>
            }
          </tbody>
        </table>
      </div>
    }
  `,
})
export class AnalyteTableComponent {
  readonly analytes = input.required<readonly Analyte[]>();
  protected readonly label = (code: string) => labelOf(VALUE_TYPE_LABELS, code);
}

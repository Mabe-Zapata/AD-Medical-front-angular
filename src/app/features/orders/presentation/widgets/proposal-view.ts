import { ChangeDetectionStrategy, Component, input } from '@angular/core';

import { BannerComponent } from '../../../../shared/presentation/atoms/banner';
import { ChipComponent } from '../../../../shared/presentation/atoms/chip';
import { Proposal } from '../../domain/entities/orders';
import { FINDING_TYPE_LABELS, PROPOSAL_STATUS_LABELS, label } from '../labels';

/** Presentational: the preliminary proposal of the engine, its findings and the evidence behind them. */
@Component({
  selector: 'app-proposal-view',
  imports: [BannerComponent, ChipComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let p = proposal();
    <div class="stack">
      <div class="row">
        <app-chip [tone]="p.status === 'PENDIENTE' ? 'warning' : 'info'">
          {{ statusLabel(p.status) }}
        </app-chip>
        <span class="muted small">Motor {{ p.engineVersion }}</span>
      </div>
      <app-banner tone="warning">
        Propuesta preliminar generada por reglas validadas. No es un diagnóstico: la decisión es del
        médico.
      </app-banner>
      <p>{{ p.summary }}</p>

      @if (p.medicalConclusion) {
        <div class="conclusion">
          <strong>Conclusión médica</strong>
          <p>{{ p.medicalConclusion }}</p>
        </div>
      }

      @if (p.findings.length === 0) {
        <p class="empty">Ninguna regla se activó con estos resultados.</p>
      } @else {
        <ul class="findings">
          @for (finding of p.findings; track finding.id) {
            <li class="finding">
              <div class="row">
                <app-chip>{{ typeLabel(finding.type) }}</app-chip>
                <span class="mono small">{{ finding.ruleCode }} · v{{ finding.ruleVersion }}</span>
              </div>
              <p>{{ finding.explanation }}</p>
              @if (finding.evidence.length > 0) {
                <p class="muted small">
                  Evidencia:
                  @for (item of finding.evidence; track item.resultId; let last = $last) {
                    {{ item.observedValue ?? '—' }} {{ item.unit ?? '' }}{{ last ? '' : ' · ' }}
                  }
                </p>
              }
            </li>
          }
        </ul>
      }
    </div>
  `,
  styles: `
    .findings {
      list-style: none;
      margin: 0;
      padding: 0;
      display: grid;
      gap: 12px;
    }
    .finding {
      border: 1px solid var(--line);
      border-radius: var(--radius-md);
      padding: 14px 16px;
    }
    .finding p {
      margin: 8px 0 0;
    }
    .conclusion {
      background: var(--orange-tint);
      border-radius: var(--radius-md);
      padding: 12px 16px;
    }
    .conclusion p {
      margin: 6px 0 0;
    }
  `,
})
export class ProposalViewComponent {
  readonly proposal = input.required<Proposal>();

  protected readonly statusLabel = (code: string) => label(PROPOSAL_STATUS_LABELS, code);
  protected readonly typeLabel = (code: string) => label(FINDING_TYPE_LABELS, code);
}

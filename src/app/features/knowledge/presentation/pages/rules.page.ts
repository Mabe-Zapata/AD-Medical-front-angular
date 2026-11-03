import { ChangeDetectionStrategy, Component, inject, signal, viewChild } from '@angular/core';

import { BannerComponent } from '../../../../shared/presentation/atoms/banner';
import { ErrorView, describeError } from '../../../../shared/presentation/error-message';
import { PERMISSIONS } from '../../../auth/domain/policies/staff-access';
import { SessionState } from '../../../auth/presentation/session.state';
import { Analyte, NewRule } from '../../domain/entities/knowledge';
import { CreateRuleDraft, ListAnalytes } from '../../domain/usecases/knowledge-usecases';
import { DraftsState } from '../drafts.state';
import { RuleFormComponent } from '../widgets/rule-form';

/** Container: creates declarative rule drafts. The backend cannot list rules, so none are shown. */
@Component({
  selector: 'app-rules-page',
  imports: [RuleFormComponent, BannerComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="stack">
      @if (!canCreate) {
        <app-banner tone="warning">
          Solo los administradores pueden crear reglas. Un médico puede validarlas en la pestaña
          «Borradores».
        </app-banner>
      } @else {
        <section class="card stack">
          <div>
            <h2>Nueva regla declarativa</h2>
            <p class="muted small">
              Las reglas no ejecutan código: comparan resultados con umbrales o con el rango de
              referencia y generan un hallazgo para que el médico lo revise.
            </p>
          </div>

          @if (notice(); as text) {
            <app-banner tone="success">{{ text }}</app-banner>
          }
          @if (error(); as e) {
            <app-banner tone="danger">
              {{ e.message }}
              @if (e.supportCode) {
                <span class="small">Código de soporte: {{ e.supportCode }}</span>
              }
            </app-banner>
          }

          @if (loading()) {
            <p class="muted"><span class="spinner" aria-hidden="true"></span> Cargando analitos…</p>
          } @else {
            <app-rule-form [analytes]="analytes()" [busy]="saving()" (submitted)="create($event)" />
          }
        </section>
      }
    </div>
  `,
})
export class RulesPage {
  private readonly listAnalytes = inject(ListAnalytes);
  private readonly createRule = inject(CreateRuleDraft);
  private readonly drafts = inject(DraftsState);
  private readonly form = viewChild(RuleFormComponent);

  protected readonly canCreate = inject(SessionState).can(PERMISSIONS.knowledgeAdmin);
  protected readonly analytes = signal<readonly Analyte[]>([]);
  protected readonly loading = signal(true);
  protected readonly saving = signal(false);
  protected readonly notice = signal<string | null>(null);
  protected readonly error = signal<ErrorView | null>(null);

  constructor() {
    void this.loadAnalytes();
  }

  protected async create(rule: NewRule): Promise<void> {
    this.saving.set(true);
    this.notice.set(null);
    this.error.set(null);
    try {
      const id = await this.createRule.execute(rule);
      this.drafts.add({
        kind: 'rule',
        id,
        label: `${rule.code} · ${rule.name}`,
        state: 'BORRADOR',
      });
      this.form()?.reset();
      this.notice.set('Borrador de regla creado. Un médico debe validarlo en «Borradores».');
    } catch (error) {
      this.error.set(
        describeError(error, {
          validation: 'La regla no es válida: revisa los criterios, las unidades y los analitos.',
        }),
      );
    } finally {
      this.saving.set(false);
    }
  }

  private async loadAnalytes(): Promise<void> {
    try {
      this.analytes.set(await this.listAnalytes.execute());
    } catch (error) {
      this.error.set(describeError(error));
    } finally {
      this.loading.set(false);
    }
  }
}

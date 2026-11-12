import { ChangeDetectionStrategy, Component, inject, signal, viewChild } from '@angular/core';

import { BannerComponent } from '../../../../shared/presentation/atoms/banner';
import { ErrorView, describeError } from '../../../../shared/presentation/error-message';
import { PERMISSIONS } from '../../../auth/domain/policies/staff-access';
import { SessionState } from '../../../auth/presentation/session.state';
import { Analyte, NewAnalyte } from '../../domain/entities/knowledge';
import { CreateAnalyte, ListAnalytes } from '../../domain/usecases/knowledge-usecases';
import { AnalyteFormComponent } from '../widgets/analyte-form';
import { AnalyteTableComponent } from '../widgets/analyte-table';

/** Container: lists the active analytes and, for administrators, creates new ones. */
@Component({
  selector: 'app-analytes-page',
  imports: [AnalyteFormComponent, AnalyteTableComponent, BannerComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="stack">
      @if (canCreate) {
        <section class="card stack">
          <h2>Nuevo analito</h2>
          <app-analyte-form [busy]="saving()" (submitted)="create($event)" />
        </section>
      }

      @if (notice(); as text) {
        <app-banner tone="success">{{ text }}</app-banner>
      }
      @if (error(); as e) {
        <app-banner tone="danger">
          {{ e.message }}
        </app-banner>
      }

      <section class="card stack">
        <h2>Analitos activos</h2>
        @if (loading()) {
          <p class="muted"><span class="spinner" aria-hidden="true"></span> Cargando…</p>
        } @else {
          <app-analyte-table [analytes]="analytes()" />
        }
      </section>
    </div>
  `,
})
export class AnalytesPage {
  private readonly listAnalytes = inject(ListAnalytes);
  private readonly createAnalyte = inject(CreateAnalyte);
  private readonly form = viewChild(AnalyteFormComponent);

  protected readonly canCreate = inject(SessionState).can(PERMISSIONS.knowledgeAdmin);
  protected readonly analytes = signal<readonly Analyte[]>([]);
  protected readonly loading = signal(true);
  protected readonly saving = signal(false);
  protected readonly notice = signal<string | null>(null);
  protected readonly error = signal<ErrorView | null>(null);

  constructor() {
    void this.load();
  }

  protected async create(analyte: NewAnalyte): Promise<void> {
    this.saving.set(true);
    this.notice.set(null);
    this.error.set(null);
    try {
      await this.createAnalyte.execute(analyte);
      this.form()?.reset();
      this.notice.set(`Analito «${analyte.name}» creado.`);
      await this.load();
    } catch (error) {
      this.error.set(describeError(error));
    } finally {
      this.saving.set(false);
    }
  }

  private async load(): Promise<void> {
    this.loading.set(true);
    try {
      this.analytes.set(await this.listAnalytes.execute());
    } catch (error) {
      this.error.set(describeError(error));
    } finally {
      this.loading.set(false);
    }
  }
}

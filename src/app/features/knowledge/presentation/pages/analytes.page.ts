import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';

import { BannerComponent } from '../../../../shared/presentation/atoms/banner';
import { ErrorView, describeError } from '../../../../shared/presentation/error-message';
import { ModalComponent } from '../../../../shared/presentation/organisms/modal';
import { PERMISSIONS } from '../../../auth/domain/policies/staff-access';
import { SessionState } from '../../../auth/presentation/session.state';
import { Analyte, NewAnalyte } from '../../domain/entities/knowledge';
import { CreateAnalyte, ListAnalytes } from '../../domain/usecases/knowledge-usecases';
import { AnalyteFormComponent } from '../widgets/analyte-form';
import { AnalyteTableComponent } from '../widgets/analyte-table';

/** Container: lists the active analytes and, for administrators, creates new ones. */
@Component({
  selector: 'app-analytes-page',
  imports: [AnalyteFormComponent, AnalyteTableComponent, BannerComponent, ModalComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="stack">
      @if (notice(); as text) {
        <app-banner tone="success">{{ text }}</app-banner>
      }
      @if (error(); as e) {
        @if (!creating()) {
          <app-banner tone="danger">
            {{ e.message }}
          </app-banner>
        }
      }

      <section class="card stack">
        <div class="row spread">
          <h2>Analitos activos</h2>
          @if (canCreate) {
            <button class="btn btn--primary" type="button" (click)="openForm()">Nuevo analito</button>
          }
        </div>
        @if (loading()) {
          <p class="muted"><span class="spinner" aria-hidden="true"></span> Cargando…</p>
        } @else {
          <app-analyte-table [analytes]="analytes()" />
        }
      </section>

      @if (creating()) {
        <app-modal
          tag="Nuevo analito"
          headline="Agrega un analito al catálogo"
          [bullets]="bullets"
          (closed)="creating.set(false)"
        >
          @if (error(); as e) {
            <app-banner tone="danger">
              {{ e.message }}
            </app-banner>
          }
          <app-analyte-form [busy]="saving()" (submitted)="create($event)" />
        </app-modal>
      }
    </div>
  `,
})
export class AnalytesPage {
  private readonly listAnalytes = inject(ListAnalytes);
  private readonly createAnalyte = inject(CreateAnalyte);

  protected readonly bullets = [
    'Un analito es una medición del laboratorio, por ejemplo glucosa o hemoglobina.',
    'La unidad y el tipo de valor definen cómo se registran sus resultados.',
  ];
  protected readonly creating = signal(false);
  protected readonly canCreate = inject(SessionState).can(PERMISSIONS.knowledgeAdmin);
  protected readonly analytes = signal<readonly Analyte[]>([]);
  protected readonly loading = signal(true);
  protected readonly saving = signal(false);
  protected readonly notice = signal<string | null>(null);
  protected readonly error = signal<ErrorView | null>(null);

  constructor() {
    void this.load();
    // The home page's "Nuevo analito" lands here with the form already open.
    if (this.canCreate && inject(ActivatedRoute).snapshot.queryParamMap.has('nuevo')) this.openForm();
  }

  protected openForm(): void {
    this.error.set(null);
    this.creating.set(true);
  }

  protected async create(analyte: NewAnalyte): Promise<void> {
    this.saving.set(true);
    this.notice.set(null);
    this.error.set(null);
    try {
      await this.createAnalyte.execute(analyte);
      this.creating.set(false);
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

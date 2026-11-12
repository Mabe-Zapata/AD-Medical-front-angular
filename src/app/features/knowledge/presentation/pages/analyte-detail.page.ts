import { ChangeDetectionStrategy, Component, inject, signal, viewChild } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';

import { APP_SETTINGS } from '../../../../core/config/app-settings';
import { toIsoDate } from '../../../../core/domain/dates';
import { BannerComponent } from '../../../../shared/presentation/atoms/banner';
import { ErrorView, describeError } from '../../../../shared/presentation/error-message';
import { formatRange } from '../../../../shared/presentation/format';
import { PERMISSIONS } from '../../../auth/domain/policies/staff-access';
import { SessionState } from '../../../auth/presentation/session.state';
import { Analyte, NewReference, ReferenceRange } from '../../domain/entities/knowledge';
import {
  CreateReferenceDraft,
  ListAnalytes,
  ListReferences,
} from '../../domain/usecases/knowledge-usecases';
import { DraftsState } from '../drafts.state';
import { ReferenceFormComponent } from '../widgets/reference-form';
import { ReferenceTableComponent } from '../widgets/reference-table';

/** Container: validated reference ranges of one analyte on a chosen date, plus draft creation. */
@Component({
  selector: 'app-analyte-detail-page',
  imports: [ReferenceFormComponent, ReferenceTableComponent, BannerComponent, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="stack">
      <a routerLink="/conocimiento/analitos" class="small">← Volver a los analitos</a>

      @if (error(); as e) {
        <app-banner tone="danger">
          {{ e.message }}
        </app-banner>
      }

      @if (analyte(); as a) {
        <section class="card stack">
          <div>
            <h2>{{ a.name }}</h2>
            <p class="muted small">
              Unidad: {{ a.unit ?? '—' }} · Tipo de valor: {{ a.valueType }}
            </p>
          </div>
          <div class="field date">
            <label for="on-date">Referencias validadas vigentes el</label>
            <input
              id="on-date"
              class="input"
              type="date"
              [value]="onDate()"
              (change)="changeDate($any($event.target).value)"
            />
          </div>
          @if (loadingRefs()) {
            <p class="muted"><span class="spinner" aria-hidden="true"></span> Cargando…</p>
          } @else {
            <app-reference-table [references]="references()" />
          }
        </section>

        @if (canCreate) {
          <section class="card stack">
            <h2>Nuevo borrador de referencia</h2>
            @if (notice(); as text) {
              <app-banner tone="success">{{ text }}</app-banner>
            }
            <app-reference-form
              [busy]="saving()"
              [defaultUnit]="a.unit"
              [defaultSourceId]="defaultSourceId"
              (submitted)="createDraft(a, $event)"
            />
          </section>
        }
      } @else if (!loading()) {
        <app-banner tone="warning">No se encontró el analito solicitado.</app-banner>
      }
    </div>
  `,
  styles: `
    .date {
      max-width: 260px;
    }
  `,
})
export class AnalyteDetailPage {
  private readonly analyteId = inject(ActivatedRoute).snapshot.paramMap.get('id') ?? '';
  private readonly listAnalytes = inject(ListAnalytes);
  private readonly listReferences = inject(ListReferences);
  private readonly createReference = inject(CreateReferenceDraft);
  private readonly drafts = inject(DraftsState);
  private readonly form = viewChild(ReferenceFormComponent);

  protected readonly canCreate = inject(SessionState).can(PERMISSIONS.knowledgeAdmin);
  protected readonly defaultSourceId = inject(APP_SETTINGS).defaultSourceId;

  protected readonly analyte = signal<Analyte | null>(null);
  protected readonly references = signal<readonly ReferenceRange[]>([]);
  protected readonly onDate = signal(toIsoDate(new Date()));
  protected readonly loading = signal(true);
  protected readonly loadingRefs = signal(false);
  protected readonly saving = signal(false);
  protected readonly notice = signal<string | null>(null);
  protected readonly error = signal<ErrorView | null>(null);

  constructor() {
    void this.init();
  }

  protected async changeDate(value: string): Promise<void> {
    if (!value) return;
    this.onDate.set(value);
    await this.loadReferences();
  }

  protected async createDraft(analyte: Analyte, reference: NewReference): Promise<void> {
    this.saving.set(true);
    this.notice.set(null);
    this.error.set(null);
    try {
      const id = await this.createReference.execute(analyte.id, reference);
      const range = formatRange(reference.min, reference.max, reference.unit);
      this.drafts.add({
        kind: 'reference',
        id,
        label: `${analyte.name} · ${range}`,
        state: 'BORRADOR',
      });
      this.form()?.reset();
      this.notice.set('Borrador creado. Un médico debe validarlo en la pestaña «Borradores».');
    } catch (error) {
      this.error.set(
        describeError(error, {
          validation: 'La referencia no es válida: revisa el rango, las fechas y la fuente.',
          not_found: 'No se encontró el analito.',
        }),
      );
    } finally {
      this.saving.set(false);
    }
  }

  private async init(): Promise<void> {
    try {
      const analytes = await this.listAnalytes.execute();
      this.analyte.set(analytes.find((a) => a.id === this.analyteId) ?? null);
      if (this.analyte() !== null) await this.loadReferences();
    } catch (error) {
      this.error.set(describeError(error));
    } finally {
      this.loading.set(false);
    }
  }

  private async loadReferences(): Promise<void> {
    this.loadingRefs.set(true);
    this.error.set(null);
    try {
      this.references.set(await this.listReferences.execute(this.analyteId, this.onDate()));
    } catch (error) {
      this.error.set(describeError(error));
    } finally {
      this.loadingRefs.set(false);
    }
  }
}

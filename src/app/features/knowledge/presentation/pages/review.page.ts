import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';

import { BannerComponent } from '../../../../shared/presentation/atoms/banner';
import { ChipComponent } from '../../../../shared/presentation/atoms/chip';
import { ErrorView, describeError } from '../../../../shared/presentation/error-message';
import { PERMISSIONS } from '../../../auth/domain/policies/staff-access';
import { SessionState } from '../../../auth/presentation/session.state';
import { ValidateReference } from '../../domain/usecases/knowledge-usecases';
import { DraftsState } from '../drafts.state';
import { NHANES_PACK, PendingReference } from '../review-pack';
import { PaginatorComponent } from '../../../../shared/presentation/molecules/paginator';
import { PageState } from '../../../../shared/presentation/pagination';

/**
 * Container: shows the reference drafts waiting for a decision and lets a doctor publish each one
 * after an explicit confirmation. Publishing is final: a published range is never edited.
 */
@Component({
  selector: 'app-review-page',
  imports: [PaginatorComponent, BannerComponent, ChipComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="stack">
      @if (!canValidate) {
        <app-banner tone="warning">
          Solo los médicos pueden publicar rangos. Puedes revisar el contenido, pero no validarlo.
        </app-banner>
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
        <div>
          <h2>{{ pack.title }}</h2>
          <p class="muted small">Fuente: {{ pack.source }}</p>
          <p class="muted small">{{ pack.method }}</p>
        </div>
        <app-banner tone="warning">
          Estos rangos están en borrador y no se aplican a ningún resultado hasta que un médico los
          publique. Esta pantalla es una copia para revisar; la base de datos es la fuente de
          verdad.
        </app-banner>
        <ul class="small">
          @for (limit of pack.limits; track limit) {
            <li>{{ limit }}</li>
          }
        </ul>
      </section>

      <section class="card stack">
        <h2>Decisiones que solo puede tomar el clínico</h2>
        <ol class="small">
          @for (decision of pack.decisions; track decision) {
            <li>{{ decision }}</li>
          }
        </ol>
      </section>

      <section class="card stack">
        <h2>Rangos en borrador</h2>
        <div class="table-wrap">
          <table class="table">
            <thead>
              <tr>
                <th>Analito</th>
                <th>Sexo</th>
                <th>Edad</th>
                <th>Muestra</th>
                <th>Rango</th>
                <th>Estado</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              @for (ref of pager.slice(pack.references); track ref.id) {
                <tr>
                  <td>{{ ref.analyte }}</td>
                  <td>{{ ref.sex }}</td>
                  <td>{{ ref.age }}</td>
                  <td>{{ ref.sample }}{{ ref.context ? ' · ' + ref.context : '' }}</td>
                  <td>{{ range(ref) }}</td>
                  <td>
                    <app-chip [tone]="isPublished(ref.id) ? 'success' : 'warning'">
                      {{ isPublished(ref.id) ? 'Validada' : 'Borrador' }}
                    </app-chip>
                  </td>
                  <td>
                    @if (canValidate && !isPublished(ref.id)) {
                      @if (confirming() === ref.id) {
                        <span class="small">¿Publicar? No se puede editar después.</span>
                        <button
                          class="btn btn--small btn--primary"
                          type="button"
                          [disabled]="busyId() === ref.id"
                          (click)="publish(ref)"
                        >
                          {{ busyId() === ref.id ? 'Validando…' : 'Sí, publicar' }}
                        </button>
                        <button class="btn btn--small" type="button" (click)="confirming.set(null)">
                          Cancelar
                        </button>
                      } @else {
                        <button
                          class="btn btn--small btn--primary"
                          type="button"
                          (click)="confirming.set(ref.id)"
                        >
                          Validar
                        </button>
                      }
                    }
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      <app-paginator [total]="pack.references.length" [state]="pager" />
      </section>
    </div>
  `,
})
export class ReviewPage {
  protected readonly pager = new PageState();
  private readonly validateReference = inject(ValidateReference);
  private readonly drafts = inject(DraftsState);

  protected readonly pack = NHANES_PACK;
  protected readonly canValidate = inject(SessionState).can(PERMISSIONS.knowledgeValidate);
  protected readonly confirming = signal<string | null>(null);
  protected readonly busyId = signal<string | null>(null);
  protected readonly published = signal<ReadonlySet<string>>(new Set());
  protected readonly notice = signal<string | null>(null);
  protected readonly error = signal<ErrorView | null>(null);

  protected readonly isPublished = (id: string) => this.published().has(id);
  protected readonly range = (ref: PendingReference) => `${ref.min} – ${ref.max} ${ref.unit}`;

  protected async publish(ref: PendingReference): Promise<void> {
    this.busyId.set(ref.id);
    this.notice.set(null);
    this.error.set(null);
    try {
      await this.validateReference.execute(ref.id);
      this.drafts.markValidated(ref.id);
      this.published.update((set) => new Set(set).add(ref.id));
      this.notice.set(`Rango publicado: ${ref.analyte}, ${ref.sex}, ${ref.age}.`);
    } catch (error) {
      this.error.set(
        describeError(error, {
          conflict: 'No es un borrador, o se solapa con una referencia ya validada.',
          not_found: 'Este borrador no existe en la base de datos conectada.',
        }),
      );
    } finally {
      this.busyId.set(null);
      this.confirming.set(null);
    }
  }
}

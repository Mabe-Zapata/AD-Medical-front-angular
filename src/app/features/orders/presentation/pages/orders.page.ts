import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';

import { isUuid } from '../../../../core/domain/dates';
import { BannerComponent } from '../../../../shared/presentation/atoms/banner';
import { ErrorView, describeError } from '../../../../shared/presentation/error-message';
import { PERMISSIONS } from '../../../auth/domain/policies/staff-access';
import { SessionState } from '../../../auth/presentation/session.state';
import { PRIORITIES, Priority } from '../../domain/entities/orders';
import { CreateOrder } from '../../domain/usecases/orders-usecases';
import { PRIORITY_LABELS } from '../labels';

/** Container: opens an order by its id, or (for ordering doctors) creates one. */
@Component({
  selector: 'app-orders-page',
  imports: [FormsModule, BannerComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="stack">
      <section class="card stack">
        <div>
          <h2>Abrir una orden</h2>
          <p class="muted small">
            El sistema todavía no lista órdenes: ábrela con su identificador. Quien la creó lo
            tiene.
          </p>
        </div>
        <form class="row" (ngSubmit)="open()" novalidate>
          <div class="field grow">
            <label for="order-id">Identificador de la orden</label>
            <input
              id="order-id"
              class="input mono"
              name="orderId"
              [ngModel]="orderId()"
              (ngModelChange)="orderId.set($event); openError.set(false)"
              placeholder="00000000-0000-0000-0000-000000000000"
              autocomplete="off"
            />
            @if (openError()) {
              <span class="field-error">Escribe un identificador válido (formato UUID).</span>
            }
          </div>
          <button class="btn btn--primary align" type="submit">Abrir</button>
        </form>
      </section>

      @if (canCreate) {
        <section class="card stack">
          <div>
            <h2>Crear una orden</h2>
            <p class="muted small">
              Solo el médico que ordena. Usa los identificadores (UUID) del paciente y de las
              pruebas; el sistema todavía no ofrece un catálogo para elegirlos por nombre.
            </p>
          </div>
          @if (error(); as e) {
            <app-banner tone="danger">
              {{ e.message }}
              @if (e.supportCode) {
                <span class="small">Código de soporte: {{ e.supportCode }}</span>
              }
            </app-banner>
          }
          <form class="stack" (ngSubmit)="create()" novalidate>
            <div class="field">
              <label for="patient-id">Identificador del paciente</label>
              <input
                id="patient-id"
                class="input mono"
                name="patientId"
                [ngModel]="patientId()"
                (ngModelChange)="patientId.set($event)"
                autocomplete="off"
              />
            </div>
            <div class="field">
              <label for="test-ids">Identificadores de las pruebas (uno por línea)</label>
              <textarea
                id="test-ids"
                class="input mono"
                rows="3"
                name="testIds"
                [ngModel]="testIds()"
                (ngModelChange)="testIds.set($event)"
              ></textarea>
            </div>
            <div class="grid-2">
              <div class="field">
                <label for="priority">Prioridad</label>
                <select
                  id="priority"
                  class="input"
                  name="priority"
                  [ngModel]="priority()"
                  (ngModelChange)="priority.set($event)"
                >
                  @for (option of priorities; track option) {
                    <option [value]="option">{{ priorityLabels[option] }}</option>
                  }
                </select>
              </div>
              <div class="field">
                <label for="notes">Observaciones (opcional)</label>
                <input
                  id="notes"
                  class="input"
                  name="notes"
                  maxlength="1000"
                  [ngModel]="notes()"
                  (ngModelChange)="notes.set($event)"
                />
              </div>
            </div>
            <div>
              <button class="btn btn--primary" type="submit" [disabled]="saving()">
                @if (saving()) {
                  <span class="spinner" aria-hidden="true"></span> Creando…
                } @else {
                  Crear orden
                }
              </button>
            </div>
          </form>
        </section>
      }
    </div>
  `,
  styles: `
    .grow {
      flex: 1 1 320px;
    }
    .align {
      align-self: flex-end;
    }
  `,
})
export class OrdersPage {
  private readonly router = inject(Router);
  private readonly createOrder = inject(CreateOrder);

  protected readonly canCreate = inject(SessionState).can(PERMISSIONS.ordersCreate);
  protected readonly priorities = PRIORITIES;
  protected readonly priorityLabels = PRIORITY_LABELS;

  protected readonly orderId = signal('');
  protected readonly openError = signal(false);
  protected readonly patientId = signal('');
  protected readonly testIds = signal('');
  protected readonly priority = signal<Priority>('NORMAL');
  protected readonly notes = signal('');
  protected readonly saving = signal(false);
  protected readonly error = signal<ErrorView | null>(null);

  protected async open(): Promise<void> {
    const id = this.orderId().trim();
    if (!isUuid(id)) {
      this.openError.set(true);
      return;
    }
    await this.router.navigate(['/ordenes', id]);
  }

  protected async create(): Promise<void> {
    this.saving.set(true);
    this.error.set(null);
    try {
      const order = await this.createOrder.execute({
        patientId: this.patientId(),
        testTypeIds: this.testIds()
          .split(/[\s,]+/)
          .filter((id) => id.length > 0),
        priority: this.priority(),
        notes: this.notes(),
      });
      await this.router.navigate(['/ordenes', order.id]);
    } catch (error) {
      this.error.set(
        describeError(error, {
          validation: 'Revisa los identificadores: deben ser UUID válidos, uno por línea.',
          forbidden: 'Solo un médico con perfil profesional puede crear órdenes.',
          not_found: 'No encontramos a ese paciente.',
        }),
      );
    } finally {
      this.saving.set(false);
    }
  }
}

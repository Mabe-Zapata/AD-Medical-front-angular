import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

import { ChipComponent } from '../../../../shared/presentation/atoms/chip';
import { Consultorio, Sede } from '../../domain/entities/sedes';

/**
 * One sede as a compact card: its status, its consultorios with a quick toggle, and the actions.
 * Presentational: it shows what it is given and emits intent; the page decides and calls the API.
 */
@Component({
  selector: 'app-sede-card',
  imports: [ChipComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
    :host {
      display: block;
      height: 100%;
    }
    .sede {
      display: flex;
      flex-direction: column;
      gap: 12px;
      height: 100%;
      padding: 18px 20px;
      border-radius: var(--radius-lg, 18px);
      background: var(--surface, #fff);
      box-shadow: var(--shadow-island, 0 10px 30px rgb(15 23 42 / 8%));
    }
    .sede--inactive {
      opacity: 0.78;
    }
    .head {
      display: flex;
      justify-content: space-between;
      gap: 12px;
      align-items: flex-start;
    }
    h3 {
      margin: 0;
      font-size: 17px;
      overflow-wrap: anywhere;
    }
    .address {
      margin: 2px 0 0;
      font-size: 13px;
      color: var(--muted, #475569);
      overflow-wrap: anywhere;
    }
    .offices {
      display: flex;
      flex-direction: column;
      gap: 4px;
      margin: 0;
      padding: 0;
      list-style: none;
    }
    .offices li {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      padding: 6px 8px;
      border-radius: 10px;
      background: var(--surface-subtle, #f8fafc);
      font-size: 14px;
    }
    .office-name {
      min-width: 0;
      overflow-wrap: anywhere;
    }
    .office-name--off {
      color: var(--muted, #475569);
      text-decoration: line-through;
    }
    .empty {
      margin: 0;
      font-size: 13px;
      color: var(--muted, #475569);
    }
    .actions {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      margin-top: auto;
    }
    button:focus-visible {
      outline: 3px solid var(--blue, #2563eb);
      outline-offset: 2px;
    }
  `,
  template: `
    <article class="sede" [class.sede--inactive]="!sede().active" [attr.aria-labelledby]="titleId()">
      <header class="head">
        <div>
          <h3 [id]="titleId()">{{ sede().name }}</h3>
          <p class="address">{{ sede().address ?? 'Sin dirección registrada' }}</p>
        </div>
        <app-chip [tone]="sede().active ? 'success' : 'warning'">
          {{ sede().active ? 'Activa' : 'Inactiva' }}
        </app-chip>
      </header>

      @if (sede().offices.length === 0) {
        <p class="empty">Aún no tiene consultorios. Agrega el primero para poder programar citas.</p>
      } @else {
        <ul class="offices" [attr.aria-label]="'Consultorios de ' + sede().name">
          @for (office of sede().offices; track office.id) {
            <li>
              <span class="office-name" [class.office-name--off]="!office.active">{{ office.name }}</span>
              <button
                type="button"
                class="btn btn--ghost btn--small"
                (click)="toggleOffice.emit(office)"
                [attr.aria-label]="(office.active ? 'Desactivar consultorio ' : 'Activar consultorio ') + office.name"
              >
                {{ office.active ? 'Desactivar' : 'Activar' }}
              </button>
            </li>
          }
        </ul>
      }

      <footer class="actions">
        <button type="button" class="btn btn--primary btn--small" (click)="addOffice.emit()">
          Agregar consultorio
        </button>
        <button type="button" class="btn btn--small" (click)="edit.emit()">Editar</button>
        <button type="button" class="btn btn--ghost btn--small" (click)="toggleActive.emit()">
          {{ sede().active ? 'Desactivar sucursal' : 'Reactivar sucursal' }}
        </button>
      </footer>
    </article>
  `,
})
export class SedeCardComponent {
  readonly sede = input.required<Sede>();

  readonly edit = output<void>();
  readonly addOffice = output<void>();
  readonly toggleActive = output<void>();
  readonly toggleOffice = output<Consultorio>();

  protected titleId(): string {
    return `sede-title-${this.sede().id}`;
  }
}

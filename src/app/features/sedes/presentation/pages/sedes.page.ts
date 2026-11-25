import {
  ChangeDetectionStrategy,
  Component,
  Injector,
  afterNextRender,
  computed,
  inject,
  signal,
} from '@angular/core';

import { AppError } from '../../../../core/domain/app-error';
import { normalizeSearch } from '../../../../core/domain/text';
import { BannerComponent, Tone } from '../../../../shared/presentation/atoms/banner';
import { ChipComponent } from '../../../../shared/presentation/atoms/chip';
import { ErrorView, describeError } from '../../../../shared/presentation/error-message';
import { PaginatorComponent } from '../../../../shared/presentation/molecules/paginator';
import { Crumb } from '../../../../shared/presentation/molecules/breadcrumbs';
import { ModalComponent } from '../../../../shared/presentation/organisms/modal';
import { PageHeaderComponent } from '../../../../shared/presentation/organisms/page-header';
import { PageState } from '../../../../shared/presentation/pagination';
import { Consultorio, Sede } from '../../domain/entities/sedes';
import {
  DUPLICATE_OFFICE_CODE,
  FUTURE_BOOKINGS_CODE,
  INACTIVE_SEDE_CODE,
  OFFICE_NAME_MAX,
  SEDE_ADDRESS_MAX,
  SEDE_NAME_MAX,
  cleanText,
  hasProblems,
  nameProblem,
  sedeDraftProblems,
} from '../../domain/policies/sede-policies';
import {
  AddOffice,
  CreateSedeWithOffices,
  ListSedes,
  UpdateOffice,
  UpdateSede,
} from '../../domain/usecases/sedes-usecases';
import { SedeCardComponent } from '../widgets/sede-card';

type ModalKind = 'create' | 'edit' | 'office';

interface Notice {
  readonly tone: Tone;
  readonly text: string;
}

/** Container: lists the sedes, and creates, edits and toggles them from keyboard-friendly modals. */
@Component({
  selector: 'app-sedes-page',
  imports: [
    BannerComponent,
    ChipComponent,
    ModalComponent,
    PaginatorComponent,
    PageHeaderComponent,
    SedeCardComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '(document:keydown)': 'onShortcut($event)' },
  styles: `
    .toolbar {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
      align-items: center;
      justify-content: space-between;
    }
    .search {
      flex: 1 1 260px;
      max-width: 420px;
    }
    .toggle {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      font-size: 14px;
      cursor: pointer;
    }
    .summary {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
      align-items: center;
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(min(100%, 340px), 1fr));
      gap: 14px;
    }
    .keys {
      font-size: 12px;
      color: var(--muted, #475569);
    }
    kbd {
      padding: 1px 6px;
      border: 1px solid var(--border, #dbe3f0);
      border-radius: 6px;
      background: var(--surface-subtle, #f8fafc);
      font-family: inherit;
      font-size: 12px;
    }
    .form {
      display: grid;
      gap: 12px;
    }
    .grid-2 {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
    }
    @media (max-width: 640px) {
      .grid-2 {
        grid-template-columns: 1fr;
      }
    }
    .pending {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      min-height: 4px;
    }
    .pending button {
      border: 0;
      background: none;
      cursor: pointer;
      font: inherit;
      color: inherit;
      padding: 0 0 0 6px;
    }
    .opt {
      margin-left: 6px;
      color: var(--muted, #475569);
      font-size: 13px;
    }
    .label-hint {
      display: block;
      margin-top: 2px;
      color: var(--muted, #475569);
      font-size: 13px;
    }
    .btn--primary kbd {
      background: rgb(255 255 255 / 18%);
      border-color: rgb(255 255 255 / 40%);
      color: inherit;
    }
    .field-error {
      color: var(--danger, #dc2626);
      font-size: 13px;
      font-weight: 500;
    }
    .actions {
      display: flex;
      gap: 10px;
      flex-wrap: wrap;
      align-items: center;
    }
    .added {
      margin: 0;
      padding: 0;
      list-style: none;
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
    }
    .muted {
      color: var(--muted, #475569);
    }
    .visually-hidden {
      position: absolute;
      width: 1px;
      height: 1px;
      overflow: hidden;
      clip: rect(0 0 0 0);
      white-space: nowrap;
    }
    button:focus-visible,
    input:focus-visible {
      outline: 3px solid var(--blue, #2563eb);
      outline-offset: 2px;
    }
  `,
  template: `
    <div class="stack">
      <app-page-header area="Sucursales" title="Sucursales y consultorios" [crumbs]="crumbs">
        <p lede class="muted">
          Crea sucursales con sus consultorios. Un consultorio inactivo deja de ofrecerse para agendar.
        </p>
      </app-page-header>

      @if (notice(); as n) {
        <app-banner [tone]="n.tone">{{ n.text }}</app-banner>
      }

      <section class="card stack">
        <div class="toolbar">
          <div class="summary" aria-live="polite">
            <app-chip tone="info">{{ sedes().length }} sucursales</app-chip>
            <app-chip tone="info">{{ officeCount() }} consultorios</app-chip>
          </div>
          <div class="actions">
            <label class="toggle">
              <input type="checkbox" [checked]="showInactive()" (change)="toggleInactive($event)" />
              Mostrar inactivas
            </label>
            <button type="button" class="btn btn--primary" (click)="openCreate()">
              Nueva sucursal <kbd aria-hidden="true">N</kbd>
            </button>
          </div>
        </div>

        <div class="toolbar">
          <div class="search">
            <label for="sede-search" class="visually-hidden">Buscar sucursal o consultorio</label>
            <input
              id="sede-search"
              class="input"
              type="search"
              placeholder="Buscar por sucursal, dirección o consultorio"
              autocomplete="off"
              [value]="query()"
              (input)="onQuery($event)"
            />
          </div>
          <p class="keys">Atajos: <kbd>N</kbd> nueva sucursal · <kbd>/</kbd> buscar · <kbd>Esc</kbd> cerrar</p>
        </div>

        @if (listing() === 'loading') {
          <p class="muted"><span class="spinner" aria-hidden="true"></span> Cargando sucursales…</p>
        } @else if (listing() === 'failed') {
          <app-banner tone="danger">No pudimos cargar las sucursales.</app-banner>
          <div><button class="btn btn--small" type="button" (click)="reload()">Reintentar</button></div>
        } @else if (sedes().length === 0) {
          <p class="empty">
            Todavía no hay sucursales. Crea la primera con sus consultorios en un solo paso.
          </p>
          <div><button class="btn btn--primary" type="button" (click)="openCreate()">Crear la primera sucursal</button></div>
        } @else if (filtered().length === 0) {
          <p class="empty">Ninguna sucursal coincide con la búsqueda. Prueba otro nombre o limpia el campo.</p>
        } @else {
          <div class="grid">
            @for (sede of pager.slice(filtered()); track sede.id) {
              <app-sede-card
                [sede]="sede"
                (edit)="openEdit(sede)"
                (addOffice)="openOffice(sede)"
                (toggleActive)="toggleSede(sede)"
                (toggleOffice)="toggleOffice(sede, $event)"
              />
            }
          </div>
          <app-paginator [total]="filtered().length" [state]="pager" />
        }
      </section>

      @if (modal() === 'create') {
        <app-modal
          tag="Nueva sucursal"
          [headline]="retryTarget() ? 'Faltan consultorios por crear' : 'Crea una sucursal con sus consultorios'"
          [bullets]="createBullets"
          (closed)="closeModal()"
        >
          @if (createError(); as e) {
            <app-banner tone="danger">{{ e.message }}</app-banner>
          }
          <form class="form" (ngSubmit)="submitCreate()" (keydown)="onFormKeydown($event)" novalidate>
            @if (retryTarget(); as target) {
              <p class="muted">
                La sucursal <strong>{{ target.name }}</strong> ya quedó creada. Reintenta solo los consultorios que faltan.
              </p>
            } @else {
              <div class="grid-2">
                <div class="field">
                  <label for="sede-name"><strong>Nombre</strong> <span aria-hidden="true">*</span></label>
                  <input
                    id="sede-name"
                    class="input"
                    name="name"
                    maxlength="150"
                    autocomplete="off"
                    placeholder="ej. Sede Norte"
                    [value]="name()"
                    (input)="name.set($any($event.target).value)"
                    (keydown.enter)="onEnterMoveToOffice($event)"
                  />
                  @if (nameError(); as err) {
                    <span class="field-error">{{ err }}</span>
                  }
                </div>
                <div class="field">
                  <label for="sede-address"><strong>Dirección</strong><span class="opt">(opcional)</span></label>
                  <input
                    id="sede-address"
                    class="input"
                    name="address"
                    maxlength="300"
                    autocomplete="off"
                    placeholder="ej. Av. del Parque 480"
                    [value]="address()"
                    (input)="address.set($any($event.target).value)"
                    (keydown.enter)="onEnterMoveToOffice($event)"
                  />
                  @if (addressError(); as err) {
                    <span class="field-error">{{ err }}</span>
                  }
                </div>
              </div>
            }

            <div class="field">
              <label for="office-input">
                <strong>Consultorios</strong>
                <span class="label-hint">Escribe uno y presiona Enter para agregarlo. Retroceso quita el último.</span>
              </label>
              <div class="pending" aria-label="Consultorios por crear">
                @for (office of pending(); track office) {
                  <app-chip tone="info">
                    {{ office }}
                    <button type="button" [attr.aria-label]="'Quitar ' + office" (click)="removePending(office)">×</button>
                  </app-chip>
                }
              </div>
              @if (!retryTarget()) {
                <input
                  id="office-input"
                  class="input"
                  maxlength="80"
                  autocomplete="off"
                  placeholder="ej. Consultorio 1"
                  [value]="officeDraft()"
                  (input)="officeDraft.set($any($event.target).value)"
                  (keydown)="onOfficeKeydown($event)"
                />
                @if (officeError(); as err) {
                  <span class="field-error">{{ err }}</span>
                }
              }
            </div>

            <div class="actions">
              <button class="btn btn--primary" type="submit" [disabled]="saving()">
                @if (saving()) {
                  <span class="spinner" aria-hidden="true"></span> Guardando…
                } @else if (retryTarget()) {
                  Reintentar consultorios ({{ pending().length }})
                } @else {
                  Crear sucursal y {{ pending().length }} consultorio{{ pending().length === 1 ? '' : 's' }}
                }
              </button>
              <button class="btn btn--ghost" type="button" (click)="closeModal()" [disabled]="saving()">
                Cancelar
              </button>
              <span class="keys">Ctrl + Enter guarda desde cualquier campo</span>
            </div>
          </form>
        </app-modal>
      }

      @if (modal() === 'edit' && target(); as sede) {
        <app-modal tag="Editar sucursal" [headline]="sede.name" (closed)="closeModal()">
          @if (editError(); as e) {
            <app-banner tone="danger">{{ e.message }}</app-banner>
          }
          <form class="form" (ngSubmit)="submitEdit()" (keydown)="onFormKeydown($event)" novalidate>
            <div class="grid-2">
              <div class="field">
                <label for="edit-name"><strong>Nombre</strong> <span aria-hidden="true">*</span></label>
                <input id="edit-name" class="input" name="editName" maxlength="150" autocomplete="off"
                  [value]="editName()" (input)="editName.set($any($event.target).value)" />
                @if (editNameError(); as err) {
                  <span class="field-error">{{ err }}</span>
                }
              </div>
              <div class="field">
                <label for="edit-address"><strong>Dirección</strong></label>
                <input id="edit-address" class="input" name="editAddress" maxlength="300" autocomplete="off"
                  [value]="editAddress()" (input)="editAddress.set($any($event.target).value)" />
              </div>
            </div>
            <label class="toggle">
              <input type="checkbox" name="editActive" [checked]="editActive()" (change)="editActive.set($any($event.target).checked)" />
              Sucursal activa
            </label>
            <p class="muted small">
              Una sucursal inactiva no ofrece citas. No puedes desactivarla mientras tenga citas futuras.
            </p>
            <div class="actions">
              <button class="btn btn--primary" type="submit" [disabled]="saving()">
                @if (saving()) { <span class="spinner" aria-hidden="true"></span> Guardando… } @else { Guardar cambios }
              </button>
              <button class="btn btn--ghost" type="button" (click)="closeModal()" [disabled]="saving()">Cancelar</button>
            </div>
          </form>
        </app-modal>
      }

      @if (modal() === 'office' && target(); as sede) {
        <app-modal tag="Agregar consultorio" [headline]="'En ' + sede.name" (closed)="closeModal()">
          @if (officeNotice(); as e) {
            <app-banner [tone]="e.tone">{{ e.text }}</app-banner>
          }
          <form class="form" (ngSubmit)="submitOffice()" novalidate>
            <div class="field">
              <label for="office-name"><strong>Nombre del consultorio</strong> <span aria-hidden="true">*</span></label>
              <input id="office-name" class="input" name="officeName" maxlength="80" autocomplete="off"
                placeholder="ej. Consultorio 3" [value]="officeName()"
                (input)="officeName.set($any($event.target).value)" />
              @if (officeNameError(); as err) {
                <span class="field-error">{{ err }}</span>
              }
            </div>
            @if (sede.offices.length > 0) {
              <p class="muted small">Ya tiene: {{ sede.offices.map(officeLabel).join(', ') }}</p>
            }
            <div class="actions">
              <button class="btn btn--primary" type="submit" [disabled]="saving()">
                @if (saving()) { <span class="spinner" aria-hidden="true"></span> Agregando… } @else { Agregar y seguir }
              </button>
              <button class="btn btn--ghost" type="button" (click)="closeModal()" [disabled]="saving()">Listo</button>
            </div>
          </form>
        </app-modal>
      }
    </div>
  `,
})
export class SedesPage {
  protected readonly crumbs: readonly Crumb[] = [
    { label: 'Inicio', link: '/inicio' },
    { label: 'Sucursales' },
  ];
  protected readonly pager = new PageState();
  protected readonly createBullets = [
    'Una sucursal nueva está activa y sin consultorios hasta que agregues el primero.',
    'Si un consultorio no se puede crear, la sucursal se conserva y puedes reintentar solo ese.',
  ];

  private readonly injector = inject(Injector);
  private readonly listSedes = inject(ListSedes);
  private readonly createSede = inject(CreateSedeWithOffices);
  private readonly updateSede = inject(UpdateSede);
  private readonly addOffice = inject(AddOffice);
  private readonly updateOffice = inject(UpdateOffice);

  protected readonly sedes = signal<readonly Sede[]>([]);
  protected readonly listing = signal<'loading' | 'ready' | 'failed'>('loading');
  protected readonly query = signal('');
  protected readonly showInactive = signal(true);
  protected readonly notice = signal<Notice | null>(null);
  protected readonly saving = signal(false);

  /** The open modal, and the sede it is about (edit and office modals). */
  protected readonly modal = signal<ModalKind | null>(null);
  protected readonly target = signal<Sede | null>(null);
  private returnFocus: HTMLElement | null = null;

  // create
  protected readonly name = signal('');
  protected readonly address = signal('');
  protected readonly officeDraft = signal('');
  protected readonly pending = signal<readonly string[]>([]);
  protected readonly submitted = signal(false);
  protected readonly createError = signal<ErrorView | null>(null);
  /** Set when the sede exists but some consultorios failed: the modal then only retries them. */
  protected readonly retryTarget = signal<{ id: string; name: string } | null>(null);

  // edit
  protected readonly editName = signal('');
  protected readonly editAddress = signal('');
  protected readonly editActive = signal(true);
  protected readonly editError = signal<ErrorView | null>(null);

  // office
  protected readonly officeName = signal('');
  protected readonly officeNotice = signal<{ tone: Tone; text: string } | null>(null);

  protected readonly filtered = computed(() => {
    const q = normalizeSearch(this.query());
    const showInactive = this.showInactive();
    return this.sedes().filter((sede) => {
      if (!showInactive && !sede.active) return false;
      if (q.length === 0) return true;
      return [sede.name, sede.address ?? '', ...sede.offices.map((o) => o.name)].some((text) =>
        normalizeSearch(text).includes(q),
      );
    });
  });

  protected readonly officeCount = computed(() =>
    this.sedes().reduce((sum, sede) => sum + sede.offices.length, 0),
  );

  constructor() {
    void this.load();
  }

  // ---------- keyboard ----------

  /** Global shortcuts: N opens a new sede, / focuses the search. Ignored while typing or in a modal. */
  protected onShortcut(event: KeyboardEvent): void {
    if (this.modal() !== null || isTyping(event.target)) return;
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    if (event.key === 'n' || event.key === 'N') {
      event.preventDefault();
      this.openCreate();
    } else if (event.key === '/') {
      event.preventDefault();
      document.getElementById('sede-search')?.focus();
    }
  }

  /** Ctrl+Enter submits the open form from any field. */
  protected onFormKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
      event.preventDefault();
      if (this.modal() === 'create') void this.submitCreate();
      else if (this.modal() === 'edit') void this.submitEdit();
      else if (this.modal() === 'office') void this.submitOffice();
    }
  }

  /** Enter in the name or address moves to the consultorio field instead of submitting early. */
  protected onEnterMoveToOffice(event: Event): void {
    event.preventDefault();
    document.getElementById('office-input')?.focus();
  }

  /** Enter adds the typed consultorio and stays in the field; Backspace on an empty field removes the last one. */
  protected onOfficeKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter') {
      event.preventDefault();
      this.addPending();
    } else if (event.key === 'Backspace' && this.officeDraft() === '') {
      const last = this.pending().at(-1);
      if (last !== undefined) {
        event.preventDefault();
        this.removePending(last);
      }
    }
  }

  // ---------- filter ----------

  protected onQuery(event: Event): void {
    this.query.set((event.target as HTMLInputElement).value);
    this.pager.page.set(0);
  }

  protected toggleInactive(event: Event): void {
    this.showInactive.set((event.target as HTMLInputElement).checked);
    this.pager.page.set(0);
  }

  // ---------- modals ----------

  protected openCreate(): void {
    this.open('create', null);
    this.name.set('');
    this.address.set('');
    this.officeDraft.set('');
    this.pending.set([]);
    this.submitted.set(false);
    this.createError.set(null);
    this.retryTarget.set(null);
    this.focusSoon('sede-name');
  }

  protected openEdit(sede: Sede): void {
    this.open('edit', sede);
    this.editName.set(sede.name);
    this.editAddress.set(sede.address ?? '');
    this.editActive.set(sede.active);
    this.editError.set(null);
    this.focusSoon('edit-name');
  }

  protected openOffice(sede: Sede): void {
    this.open('office', sede);
    this.officeName.set('');
    this.officeNotice.set(null);
    this.focusSoon('office-name');
  }

  protected closeModal(): void {
    if (this.saving()) return;
    this.modal.set(null);
    this.target.set(null);
    this.returnFocus?.focus();
    this.returnFocus = null;
  }

  private open(kind: ModalKind, target: Sede | null): void {
    this.returnFocus = document.activeElement as HTMLElement | null;
    this.target.set(target);
    this.modal.set(kind);
  }

  private focusSoon(id: string): void {
    afterNextRender(() => document.getElementById(id)?.focus(), { injector: this.injector });
  }

  // ---------- create ----------

  protected nameError(): string | null {
    if (!this.submitted()) return null;
    return this.problemText(nameProblem(this.name(), SEDE_NAME_MAX), 'nombre');
  }

  protected addressError(): string | null {
    if (!this.submitted()) return null;
    return this.problemText(sedeDraftProblems({ name: '', address: this.address() }).address, 'dirección');
  }

  protected officeError(): string | null {
    const draft = this.officeDraft();
    if (draft.trim().length === 0) return null;
    const problem = nameProblem(draft, OFFICE_NAME_MAX);
    return problem ? this.problemText(problem, 'consultorio') : null;
  }

  protected addPending(): void {
    const name = cleanText(this.officeDraft());
    if (name.length === 0) return;
    if (nameProblem(name, OFFICE_NAME_MAX) !== null) return; // officeError explains it
    if (this.pending().some((p) => p.toLowerCase() === name.toLowerCase())) {
      this.officeDraft.set('');
      this.createError.set({ message: 'Ese consultorio ya está en la lista.' });
      return;
    }
    this.createError.set(null);
    this.pending.update((list) => [...list, name]);
    this.officeDraft.set('');
  }

  protected removePending(office: string): void {
    this.pending.update((list) => list.filter((p) => p !== office));
    this.focusSoon('office-input');
  }

  protected async submitCreate(): Promise<void> {
    if (this.saving()) return;
    if (this.retryTarget()) {
      await this.retryFailedOffices();
      return;
    }
    // A consultorio still typed but not added counts too: add it instead of losing it.
    if (cleanText(this.officeDraft()).length > 0) this.addPending();
    this.submitted.set(true);
    const draft = { name: this.name(), address: this.address(), offices: this.pending() };
    if (hasProblems(sedeDraftProblems(draft))) {
      this.createError.set({ message: 'Revisa el nombre y la dirección antes de guardar.' });
      return;
    }
    this.saving.set(true);
    this.createError.set(null);
    try {
      const result = await this.createSede.execute(draft);
      await this.load();
      if (result.failedOffices.length === 0) {
        this.finish(`Sucursal «${cleanText(draft.name)}» creada con ${draft.offices.length} consultorio(s).`);
      } else {
        this.pending.set(result.failedOffices);
        this.retryTarget.set({ id: result.sedeId, name: cleanText(draft.name) });
        this.createError.set({
          message: `La sucursal se creó, pero no pudimos crear ${result.failedOffices.length} consultorio(s). Reintenta solo esos.`,
        });
      }
    } catch (error) {
      this.createError.set(this.sedeError(error));
    } finally {
      this.saving.set(false);
    }
  }

  private async retryFailedOffices(): Promise<void> {
    const target = this.retryTarget();
    if (!target) return;
    this.saving.set(true);
    this.createError.set(null);
    const stillFailing: string[] = [];
    for (const office of this.pending()) {
      try {
        await this.addOffice.execute(target.id, office);
      } catch {
        stillFailing.push(office);
      }
    }
    await this.load();
    this.saving.set(false);
    if (stillFailing.length === 0) {
      this.finish(`Consultorios de «${target.name}» creados.`);
    } else {
      this.pending.set(stillFailing);
      this.createError.set({
        message: `Todavía no pudimos crear: ${stillFailing.join(', ')}. Reintenta cuando puedas.`,
      });
    }
  }

  // ---------- edit ----------

  protected editNameError(): string | null {
    return this.problemText(nameProblem(this.editName(), SEDE_NAME_MAX), 'nombre');
  }

  protected async submitEdit(): Promise<void> {
    const sede = this.target();
    if (!sede || this.saving()) return;
    const changes = {
      ...(cleanText(this.editName()) !== sede.name ? { name: cleanText(this.editName()) } : {}),
      ...((cleanText(this.editAddress()) || null) !== sede.address
        ? { address: cleanText(this.editAddress()) || null }
        : {}),
      ...(this.editActive() !== sede.active ? { active: this.editActive() } : {}),
    };
    if (Object.keys(changes).length === 0) {
      this.closeModal();
      return;
    }
    if (nameProblem(this.editName(), SEDE_NAME_MAX) !== null) {
      this.editError.set({ message: 'Escribe un nombre de hasta 150 caracteres.' });
      return;
    }
    this.saving.set(true);
    this.editError.set(null);
    try {
      await this.updateSede.execute(sede.id, changes);
      await this.load();
      this.finish(`Sucursal «${cleanText(this.editName())}» actualizada.`);
    } catch (error) {
      this.editError.set(this.sedeError(error));
    } finally {
      this.saving.set(false);
    }
  }

  // ---------- office ----------

  protected officeNameError(): string | null {
    const value = this.officeName();
    if (value.trim().length === 0) return null;
    const problem = nameProblem(value, OFFICE_NAME_MAX);
    return problem ? this.problemText(problem, 'consultorio') : null;
  }

  protected officeLabel(office: Consultorio): string {
    return office.active ? office.name : `${office.name} (inactivo)`;
  }

  protected async submitOffice(): Promise<void> {
    const sede = this.target();
    if (!sede || this.saving()) return;
    const name = cleanText(this.officeName());
    if (name.length === 0 || nameProblem(name, OFFICE_NAME_MAX) !== null) {
      this.officeNotice.set({ tone: 'danger', text: 'Escribe el nombre del consultorio.' });
      return;
    }
    this.saving.set(true);
    this.officeNotice.set(null);
    try {
      await this.addOffice.execute(sede.id, name);
      await this.load();
      this.officeNotice.set({ tone: 'success', text: `Consultorio «${name}» agregado.` });
      this.officeName.set('');
      this.target.set(this.sedes().find((s) => s.id === sede.id) ?? sede);
      this.focusSoon('office-name');
    } catch (error) {
      this.officeNotice.set({ tone: 'danger', text: this.sedeError(error).message });
    } finally {
      this.saving.set(false);
    }
  }

  // ---------- quick toggles on the card ----------

  protected async toggleSede(sede: Sede): Promise<void> {
    this.notice.set(null);
    try {
      await this.updateSede.execute(sede.id, { active: !sede.active });
      await this.load();
      this.notice.set({
        tone: 'success',
        text: sede.active ? `«${sede.name}» quedó inactiva.` : `«${sede.name}» quedó activa.`,
      });
    } catch (error) {
      this.notice.set({ tone: 'danger', text: this.sedeError(error).message });
    }
  }

  protected async toggleOffice(sede: Sede, office: Consultorio): Promise<void> {
    this.notice.set(null);
    try {
      await this.updateOffice.execute(office.id, { active: !office.active });
      await this.load();
      this.notice.set({
        tone: 'success',
        text: office.active
          ? `Consultorio «${office.name}» de ${sede.name} desactivado.`
          : `Consultorio «${office.name}» de ${sede.name} activado.`,
      });
    } catch (error) {
      this.notice.set({ tone: 'danger', text: this.sedeError(error).message });
    }
  }

  // ---------- data ----------

  protected reload(): void {
    this.listing.set('loading');
    void this.load();
  }

  private async load(): Promise<void> {
    try {
      this.sedes.set(await this.listSedes.execute());
      this.listing.set('ready');
    } catch {
      this.listing.set('failed');
    }
  }

  private finish(text: string): void {
    this.notice.set({ tone: 'success', text });
    this.modal.set(null);
    this.target.set(null);
    this.returnFocus?.focus();
    this.returnFocus = null;
  }

  // ---------- messages ----------

  /** Turns a failure into copy. Business codes from the backend get a precise sentence. */
  private sedeError(error: unknown): ErrorView {
    if (error instanceof AppError) {
      if (error.code === FUTURE_BOOKINGS_CODE) {
        return {
          message:
            'Tiene citas programadas en alguno de sus consultorios. Podrás desactivarla cuando no queden citas futuras.',
        };
      }
      if (error.code === DUPLICATE_OFFICE_CODE) {
        return { message: 'Ya existe un consultorio con ese nombre en esta sucursal.' };
      }
      if (error.code === INACTIVE_SEDE_CODE) {
        return { message: 'Activa la sucursal antes de crear o reactivar consultorios en ella.' };
      }
    }
    return describeError(error, {
      forbidden: 'Tu cuenta no puede administrar sucursales.',
    });
  }

  private problemText(problem: string | null, field: string): string | null {
    if (problem === null) return null;
    if (problem === 'required') return `Escribe el ${field}.`;
    if (problem === 'controlCharacters') return `El ${field} no puede tener saltos de línea ni caracteres de control.`;
    if (problem === 'tooLong') {
      const max = field === 'dirección' ? SEDE_ADDRESS_MAX : field === 'consultorio' ? OFFICE_NAME_MAX : SEDE_NAME_MAX;
      return `El ${field} es demasiado largo (máximo ${max} caracteres).`;
    }
    return null;
  }
}

/** True when the key press belongs to a text field, so shortcuts must not fire. */
function isTyping(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName);
}

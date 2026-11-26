import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';

import { AppError } from '../../../../core/domain/app-error';
import { BannerComponent, Tone } from '../../../../shared/presentation/atoms/banner';
import { ChipComponent } from '../../../../shared/presentation/atoms/chip';
import { describeError, ErrorView } from '../../../../shared/presentation/error-message';
import { PaginatorComponent } from '../../../../shared/presentation/molecules/paginator';
import { ModalComponent } from '../../../../shared/presentation/organisms/modal';
import { PageHeaderComponent } from '../../../../shared/presentation/organisms/page-header';
import { PageState } from '../../../../shared/presentation/pagination';
import {
  CatalogItem,
  ClinicalHistory,
  DateRange,
  EntryDraft,
  EntryKind,
  EventPage,
  HistoryEntry,
  PatientOption,
  VitalMeasures,
  VitalSigns,
} from '../../domain/entities/historia';
import { localIsoDay, nextStates, validateRange } from '../../domain/policies/historia-policies';
import {
  ChangeEntryState,
  CorrectVitals,
  CreateEntry,
  ListHistoryPatients,
  ReadEvents,
  ReadHistory,
  RecordVitals,
  SearchCatalog,
  VerifyEntry,
} from '../../domain/usecases/historia-usecases';
import { ACTION_LABEL, ENTITY_LABEL, KIND_LABEL, KIND_PLURAL, problemsSentence } from '../labels';
import { EntryCardComponent } from '../widgets/entry-card';
import { EntryFormComponent } from '../widgets/entry-form';
import { StateFormComponent } from '../widgets/state-form';
import { VitalsFormComponent } from '../widgets/vitals-form';

type Tab = 'allergy' | 'antecedent' | 'medication' | 'problem' | 'vaccine' | 'vitals' | 'events';
type Modal =
  | { readonly kind: 'create'; readonly entryKind: EntryKind }
  | { readonly kind: 'state'; readonly entryKind: EntryKind; readonly entry: HistoryEntry }
  | { readonly kind: 'vitals' }
  | { readonly kind: 'correct'; readonly vitals: VitalSigns };

const TABS: readonly { readonly id: Tab; readonly label: string }[] = [
  { id: 'allergy', label: 'Alergias' },
  { id: 'antecedent', label: 'Antecedentes' },
  { id: 'medication', label: 'Medicación' },
  { id: 'problem', label: 'Problemas' },
  { id: 'vaccine', label: 'Vacunas' },
  { id: 'vitals', label: 'Signos vitales' },
  { id: 'events', label: 'Bitácora' },
];

/** Container: the treating doctor's view of one patient's clinical history. */
@Component({
  selector: 'app-historia-page',
  imports: [
    BannerComponent,
    ChipComponent,
    EntryCardComponent,
    EntryFormComponent,
    ModalComponent,
    PaginatorComponent,
    PageHeaderComponent,
    StateFormComponent,
    VitalsFormComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
    /* Filters: one row of three fields (the patient takes the most room), then the period as a segmented control. */
    .toolbar {
      display: grid;
      grid-template-columns: minmax(0, 1.6fr) minmax(0, 1fr) minmax(0, 1fr);
      gap: 14px 16px;
      align-items: end;
    }
    .field {
      display: grid;
      gap: 6px;
      min-width: 0;
    }
    .field > strong {
      font-size: 13px;
      font-weight: 700;
      color: var(--ink, #1e2432);
    }
    .periods {
      grid-column: 1 / -1;
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 10px;
    }
    .periods-label {
      font-size: 13px;
      font-weight: 700;
      color: var(--ink, #1e2432);
    }
    .segmented {
      display: inline-flex;
      flex-wrap: wrap;
      gap: 4px;
      padding: 4px;
      background: #fff;
      border: 1px solid var(--blue-soft, #d6e2f5);
      border-radius: 999px;
    }
    .segmented button {
      border: 0;
      background: none;
      padding: 8px 14px;
      border-radius: 999px;
      font: inherit;
      font-size: 13px;
      font-weight: 600;
      color: var(--muted, #475569);
      cursor: pointer;
    }
    .segmented button:hover {
      color: var(--blue-deep, #12376f);
    }
    .segmented button:focus-visible {
      outline: 3px solid rgb(29 86 166 / 30%);
      outline-offset: 2px;
    }
    @media (max-width: 720px) {
      .toolbar {
        grid-template-columns: 1fr;
      }
    }
    /* Kind tabs: the same white pill as the main navigation, so the screens read as one product. */
    .tabs {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      padding: 4px;
      background: var(--blue-tint, #eef3fb);
      border-radius: 999px;
      align-self: flex-start;
    }
    .tab {
      border: 0;
      background: none;
      padding: 9px 16px;
      border-radius: 999px;
      font: inherit;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      color: #334155;
    }
    .tab:focus-visible {
      outline: 3px solid rgb(29 86 166 / 30%);
      outline-offset: 2px;
    }
    .tab[aria-selected='true'] {
      background: #fff;
      color: var(--orange, #c2410c);
      box-shadow: 0 6px 16px rgb(18 55 111 / 10%);
    }
    .list {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(min(100%, 320px), 1fr));
      gap: 12px;
    }
    .muted {
      color: var(--muted, #475569);
    }
    .notice-row {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      align-items: center;
    }
    .events {
      display: grid;
      gap: 8px;
      margin: 0;
      padding: 0;
      list-style: none;
    }
    .events li {
      padding: 10px 12px;
      border-radius: 12px;
      background: var(--surface-subtle, #f8fafc);
      font-size: 14px;
    }
    button:focus-visible,
    input:focus-visible,
    select:focus-visible {
      outline: 3px solid var(--blue, #2563eb);
      outline-offset: 2px;
    }
  `,
  template: `
    <div class="stack">
      <app-page-header area="Historia clínica" title="Historia clínica" [crumbs]="crumbs">
        <p lede class="muted">
          Lo que el paciente declara se confirma aquí. Cada cambio queda en la bitácora.
        </p>
      </app-page-header>

      @if (notice(); as n) {
        <app-banner [tone]="n.tone">{{ n.text }}</app-banner>
      }

      <section class="card stack">
        <div class="toolbar">
          <label class="field">
            <strong>Paciente</strong>
            <select class="input" name="patient" [value]="patientId()" (change)="choosePatient(value($event))">
              <option value="">Elige un paciente</option>
              @for (patient of patients(); track patient.id) {
                <option [value]="patient.id">{{ patient.name }}</option>
              }
            </select>
          </label>
          <label class="field">
            <strong>Desde</strong>
            <input class="input" name="from" type="date" [min]="minDay" [max]="maxDay" [value]="range().from ?? ''" (change)="setRange('from', value($event))" />
          </label>
          <label class="field">
            <strong>Hasta</strong>
            <input class="input" name="to" type="date" [min]="minDay" [max]="maxDay" [value]="range().to ?? ''" (change)="setRange('to', value($event))" />
          </label>
          <div class="periods">
            <span class="periods-label" id="periods-label">Periodo</span>
            <div class="segmented" role="group" aria-labelledby="periods-label">
              <button type="button" (click)="presetRange(30)">Último mes</button>
              <button type="button" (click)="presetRange(365)">Último año</button>
              <button type="button" (click)="presetRange(null)">Todo</button>
            </div>
          </div>
        </div>
        @if (rangeProblem(); as text) {
          <app-banner tone="danger">{{ text }}</app-banner>
        }

        @if (!patientId()) {
          <p class="empty">Elige un paciente para ver su historia. Solo aparecen los pacientes que atiendes.</p>
        } @else if (loading()) {
          <p class="muted"><span class="spinner" aria-hidden="true"></span> Cargando la historia…</p>
        } @else if (loadFailed()) {
          <app-banner tone="danger">No pudimos cargar la historia de este paciente.</app-banner>
          <div><button type="button" class="btn btn--small" (click)="reload()">Reintentar</button></div>
        } @else if (history(); as view) {
          <div class="tabs" role="tablist" aria-label="Secciones de la historia">
            @for (tab of tabs; track tab.id) {
              <button
                type="button"
                role="tab"
                class="tab"
                [attr.aria-selected]="activeTab() === tab.id"
                (click)="selectTab(tab.id)"
              >{{ tab.label }}</button>
            }
          </div>

          @switch (activeTab()) {
            @case ('vitals') {
              <div class="notice-row">
                <h2>Signos vitales</h2>
                <button type="button" class="btn btn--primary btn--small" (click)="openVitals()">Registrar signos</button>
              </div>
              @if (view.vitals.length === 0) {
                <p class="empty">Aún no hay signos vitales en este rango de fechas.</p>
              } @else {
                <div class="list">
                  @for (vitals of pager.slice(view.vitals); track vitals.id) {
                    <article class="card stack">
                      <h3>{{ vitals.recordedAt?.slice(0, 10) }}</h3>
                      <p class="muted">{{ describeVitals(vitals) }}</p>
                      @if (vitals.correctsId) {
                        <app-chip tone="info">Es una corrección</app-chip>
                        <p class="muted">Motivo: {{ vitals.reason }}</p>
                      }
                      <div><button type="button" class="btn btn--small btn--ghost" (click)="openCorrection(vitals)">Corregir</button></div>
                    </article>
                  }
                </div>
                <app-paginator [total]="view.vitals.length" [state]="pager" />
              }
            }
            @case ('events') {
              @if (events(); as page) {
                @if (page.items.length === 0) {
                  <p class="empty">No hay movimientos en la bitácora para este filtro.</p>
                } @else {
                  <ul class="events">
                    @for (event of page.items; track event.id) {
                      <li>
                        <strong>{{ actionLabel(event.action) }}</strong>
                        · {{ entityLabel(event.entity) }}
                        · {{ event.at.slice(0, 16).replace('T', ' ') }}
                        @if (event.reason) { <div class="muted">Motivo: {{ event.reason }}</div> }
                        @if (page.includesActor && event.actorId) { <div class="muted">Registrado por un profesional</div> }
                      </li>
                    }
                  </ul>
                  <app-paginator [total]="page.total" [state]="pager" />
                }
              } @else {
                <p class="muted">Cargando la bitácora…</p>
              }
            }
            @default {
              @let entries = entriesOf(view, activeTab());
              <div class="notice-row">
                <h2>{{ kindPlural(activeTab()) }}</h2>
                <button type="button" class="btn btn--primary btn--small" (click)="openCreate(activeKind())">
                  Registrar {{ kindLabel(activeKind()).toLowerCase() }}
                </button>
              </div>
              @if (entries.length === 0) {
                <p class="empty">No hay {{ kindPlural(activeTab()).toLowerCase() }} en este rango de fechas.</p>
              } @else {
                <div class="list">
                  @for (entry of pager.slice(entries); track entry.id) {
                    <app-entry-card
                      [entry]="entry"
                      (verify)="verify(entry)"
                      (changeState)="openState(activeKind(), entry)"
                    />
                  }
                </div>
                <app-paginator [total]="entries.length" [state]="pager" />
              }
            }
          }
        }
      </section>

      @if (modal(); as m) {
        <app-modal
          [tag]="modalTag(m)"
          [headline]="modalHeadline(m)"
          (closed)="closeModal()"
        >
          @switch (m.kind) {
            @case ('create') {
              <app-entry-form
                [kind]="m.entryKind"
                [allergens]="allergens()"
                [vaccines]="vaccines()"
                [cie11Options]="cie11()"
                [today]="today()"
                [busy]="busy()"
                [serverError]="formError()"
                (submitDraft)="create($event)"
                (cancel)="closeModal()"
              />
            }
            @case ('state') {
              <app-state-form
                [targets]="targetsOf(m.entryKind, m.entry)"
                [busy]="busy()"
                [serverError]="formError()"
                (submitChange)="changeState(m.entryKind, m.entry, $event.target, $event.reason)"
                (cancel)="closeModal()"
              />
            }
            @case ('vitals') {
              <app-vitals-form
                mode="record"
                [busy]="busy()"
                [serverError]="formError()"
                (submitRecord)="recordVitals($event.appointmentId, $event.measures)"
                (cancel)="closeModal()"
              />
            }
            @case ('correct') {
              <app-vitals-form
                mode="correct"
                [initial]="vitalsMeasures(m.vitals)"
                [busy]="busy()"
                [serverError]="formError()"
                (submitCorrection)="correctVitals(m.vitals, $event.measures, $event.reason)"
                (cancel)="closeModal()"
              />
            }
          }
        </app-modal>
      }
    </div>
  `,
})
export class HistoriaPageComponent {
  protected readonly crumbs = [{ label: 'Inicio', link: '/inicio' }, { label: 'Historia clínica' }];
  protected readonly tabs = TABS;
  protected readonly minDay = '2020-01-01';
  protected readonly maxDay = localIsoDay(new Date());
  protected readonly pager = new PageState();

  private readonly listPatients = inject(ListHistoryPatients);
  private readonly readHistory = inject(ReadHistory);
  private readonly readEvents = inject(ReadEvents);
  private readonly createEntry = inject(CreateEntry);
  private readonly verifyEntry = inject(VerifyEntry);
  private readonly changeEntryState = inject(ChangeEntryState);
  private readonly recordVitals_ = inject(RecordVitals);
  private readonly correctVitals_ = inject(CorrectVitals);
  private readonly searchCatalog = inject(SearchCatalog);

  protected readonly patients = signal<readonly PatientOption[]>([]);
  protected readonly patientId = signal('');
  protected readonly range = signal<DateRange>({ from: null, to: null });
  protected readonly history = signal<ClinicalHistory | null>(null);
  protected readonly events = signal<EventPage | null>(null);
  protected readonly loading = signal(false);
  protected readonly loadFailed = signal(false);
  protected readonly activeTab = signal<Tab>('allergy');
  protected readonly modal = signal<Modal | null>(null);
  protected readonly busy = signal(false);
  protected readonly formError = signal<string | null>(null);
  protected readonly notice = signal<{ tone: Tone; text: string } | null>(null);
  protected readonly allergens = signal<readonly CatalogItem[]>([]);
  protected readonly vaccines = signal<readonly CatalogItem[]>([]);
  protected readonly cie11 = signal<readonly CatalogItem[]>([]);

  protected readonly today = computed(() => localIsoDay(new Date()));
  protected readonly rangeProblem = computed(() => {
    const problems = validateRange(this.range(), this.today());
    return problems.length > 0 ? problemsSentence(problems) : null;
  });

  constructor() {
    void this.loadPatients();
    void this.loadCatalogs();
  }

  protected value(event: Event): string {
    return (event.target as HTMLSelectElement | HTMLInputElement).value;
  }

  protected activeKind(): EntryKind {
    switch (this.activeTab()) {
      case 'antecedent':
        return 'antecedent';
      case 'medication':
        return 'medication';
      case 'problem':
        return 'problem';
      case 'vaccine':
        return 'vaccine';
      default:
        return 'allergy';
    }
  }

  protected entriesOf(view: ClinicalHistory, tab: Tab): readonly HistoryEntry[] {
    switch (tab) {
      case 'antecedent':
        return view.antecedents;
      case 'medication':
        return view.medications;
      case 'problem':
        return view.problems;
      case 'vaccine':
        return view.vaccines;
      default:
        return view.allergies;
    }
  }

  protected kindLabel(kind: EntryKind): string {
    return KIND_LABEL[kind];
  }

  protected kindPlural(tab: Tab): string {
    const kind = tab === 'vitals' || tab === 'events' ? 'allergy' : this.activeKindFor(tab);
    return KIND_PLURAL[kind];
  }

  protected actionLabel(action: string): string {
    return ACTION_LABEL[action] ?? action;
  }

  protected entityLabel(entity: string): string {
    return ENTITY_LABEL[entity] ?? entity;
  }

  protected describeVitals(vitals: VitalSigns): string {
    const parts: string[] = [];
    if (vitals.weightKg !== null) parts.push(`Peso ${vitals.weightKg} kg`);
    if (vitals.systolic !== null && vitals.diastolic !== null) parts.push(`PA ${vitals.systolic}/${vitals.diastolic}`);
    if (vitals.heartRate !== null) parts.push(`FC ${vitals.heartRate}`);
    if (vitals.temperatureC !== null) parts.push(`Temp ${vitals.temperatureC} °C`);
    if (vitals.oxygen !== null) parts.push(`SpO₂ ${vitals.oxygen}%`);
    return parts.join(' · ') || 'Sin medidas';
  }

  protected vitalsMeasures(vitals: VitalSigns): Partial<VitalMeasures> {
    return {
      weightKg: vitals.weightKg,
      heightCm: vitals.heightCm,
      systolic: vitals.systolic,
      diastolic: vitals.diastolic,
      heartRate: vitals.heartRate,
      temperatureC: vitals.temperatureC,
      oxygen: vitals.oxygen,
    };
  }

  protected targetsOf(kind: EntryKind, entry: HistoryEntry): readonly string[] {
    return nextStates(kind, entry.state);
  }

  protected modalTag(m: Modal): string {
    switch (m.kind) {
      case 'create':
        return 'Registrar';
      case 'state':
        return 'Cambiar estado';
      case 'vitals':
        return 'Signos vitales';
      case 'correct':
        return 'Corrección';
    }
  }

  protected modalHeadline(m: Modal): string {
    switch (m.kind) {
      case 'create':
        return `Nueva ${KIND_LABEL[m.entryKind].toLowerCase()}`;
      case 'state':
        return 'Cambiar el estado';
      case 'vitals':
        return 'Registrar signos vitales';
      case 'correct':
        return 'Corregir signos vitales';
    }
  }

  protected choosePatient(id: string): void {
    this.patientId.set(id);
    this.history.set(null);
    this.events.set(null);
    this.notice.set(null);
    if (id) void this.load();
  }

  protected setRange(side: 'from' | 'to', text: string): void {
    const day = text ? (text < this.minDay ? this.minDay : text > this.maxDay ? this.maxDay : text) : null;
    this.range.update((range) => ({ ...range, [side]: day }));
    void this.load();
  }

  protected presetRange(days: number | null): void {
    if (days === null) {
      this.range.set({ from: null, to: null });
    } else {
      const from = new Date(Date.now() - days * 86_400_000);
      this.range.set({ from: localIsoDay(from), to: localIsoDay(new Date()) });
    }
    void this.load();
  }

  protected selectTab(tab: Tab): void {
    this.activeTab.set(tab);
    this.pager.page.set(0);
    if (tab === 'events') void this.loadEvents();
  }

  protected reload(): void {
    void this.load();
  }

  protected openCreate(kind: EntryKind): void {
    this.formError.set(null);
    this.modal.set({ kind: 'create', entryKind: kind });
  }

  protected openState(kind: EntryKind, entry: HistoryEntry): void {
    this.formError.set(null);
    this.modal.set({ kind: 'state', entryKind: kind, entry });
  }

  protected openVitals(): void {
    this.formError.set(null);
    this.modal.set({ kind: 'vitals' });
  }

  protected openCorrection(vitals: VitalSigns): void {
    this.formError.set(null);
    this.modal.set({ kind: 'correct', vitals });
  }

  protected closeModal(): void {
    if (this.busy()) return;
    this.modal.set(null);
    this.formError.set(null);
  }

  protected async create(draft: EntryDraft): Promise<void> {
    await this.run(
      async () => {
        const entry = await this.createEntry.execute(this.patientId(), draft);
        return `${KIND_LABEL[draftKind(draft)]} registrada${entry.verified ? ' y confirmada' : ''}.`;
      },
      () => this.load(),
    );
  }

  protected async verify(entry: HistoryEntry): Promise<void> {
    const kind = kindOf(entry);
    this.notice.set(null);
    try {
      await this.verifyEntry.execute(this.patientId(), kind, entry.id);
      this.notice.set({ tone: 'success', text: 'Confirmada por el médico.' });
      await this.load();
    } catch (error) {
      this.notice.set({ tone: 'danger', text: this.errorText(error) });
    }
  }

  protected async changeState(kind: EntryKind, entry: HistoryEntry, target: string, reason: string): Promise<void> {
    await this.run(
      async () => {
        await this.changeEntryState.execute(this.patientId(), kind, entry.id, {
          expected: entry.state ?? '',
          target,
          reason,
        });
        return 'Estado cambiado. Queda registrado en la bitácora.';
      },
      () => this.load(),
    );
  }

  protected async recordVitals(appointmentId: string, measures: VitalMeasures): Promise<void> {
    await this.run(
      async () => {
        await this.recordVitals_.execute(appointmentId, measures);
        return 'Signos vitales registrados.';
      },
      () => this.load(),
    );
  }

  protected async correctVitals(vitals: VitalSigns, measures: VitalMeasures, reason: string): Promise<void> {
    await this.run(
      async () => {
        await this.correctVitals_.execute(vitals.id, measures, reason);
        return 'Corrección guardada. La medida original se conserva.';
      },
      () => this.load(),
    );
  }

  /** Runs a write: one busy flag, one message on success, and the refusal shown inside the form. */
  private async run(write: () => Promise<string>, reload: () => Promise<void>): Promise<void> {
    if (this.busy()) return;
    this.busy.set(true);
    this.formError.set(null);
    try {
      const text = await write();
      this.modal.set(null);
      this.notice.set({ tone: 'success', text });
      await reload();
    } catch (error) {
      this.formError.set(this.errorText(error));
    } finally {
      this.busy.set(false);
    }
  }

  private async loadPatients(): Promise<void> {
    try {
      this.patients.set(await this.listPatients.execute());
    } catch (error) {
      this.notice.set({ tone: 'danger', text: this.errorText(error) });
    }
  }

  private async loadCatalogs(): Promise<void> {
    try {
      const [allergens, vaccines, cie11] = await Promise.all([
        this.searchCatalog.execute('sustancias-alergia', null),
        this.searchCatalog.execute('vacunas', null),
        this.searchCatalog.execute('cie11', null),
      ]);
      this.allergens.set(allergens);
      this.vaccines.set(vaccines);
      this.cie11.set(cie11);
    } catch {
      // The forms still work: a missing catalog only leaves its list empty, and the refusal says why.
    }
  }

  private async load(): Promise<void> {
    if (!this.patientId() || validateRange(this.range(), this.today()).length > 0) return;
    this.loading.set(true);
    this.loadFailed.set(false);
    try {
      this.history.set(await this.readHistory.execute(this.patientId(), this.range()));
      if (this.activeTab() === 'events') await this.loadEvents();
    } catch (error) {
      this.loadFailed.set(true);
      this.history.set(null);
      this.notice.set({ tone: 'danger', text: this.errorText(error) });
    } finally {
      this.loading.set(false);
    }
  }

  private async loadEvents(): Promise<void> {
    try {
      this.events.set(await this.readEvents.execute(this.patientId(), { ...this.range(), limit: 5 }));
    } catch (error) {
      this.notice.set({ tone: 'danger', text: this.errorText(error) });
    }
  }

  private activeKindFor(tab: Tab): EntryKind {
    switch (tab) {
      case 'antecedent':
        return 'antecedent';
      case 'medication':
        return 'medication';
      case 'problem':
        return 'problem';
      case 'vaccine':
        return 'vaccine';
      default:
        return 'allergy';
    }
  }

  private errorText(error: unknown): string {
    if (error instanceof AppError && error.kind === 'conflict') {
      return 'Alguien cambió esta entrada mientras la mirabas. Vuelve a cargar e inténtalo otra vez.';
    }
    if (error instanceof AppError && error.kind === 'validation') {
      const fields = /^Invalid fields: (.+)$/.exec(error.message)?.[1] ?? '';
      return problemsSentence(fields.split(', ').map((field) => field.trim()));
    }
    const view: ErrorView = describeError(error, {
      forbidden: 'Tu cuenta no puede ver ni cambiar esta historia.',
    });
    return view.message;
  }
}

function draftKind(draft: EntryDraft): EntryKind {
  return draft.kind === 'allergy'
    ? 'allergy'
    : draft.kind === 'antecedent'
      ? 'antecedent'
      : draft.kind === 'medication'
        ? 'medication'
        : draft.kind === 'problem'
          ? 'problem'
          : 'vaccine';
}

function kindOf(entry: HistoryEntry): EntryKind {
  return entry.details.kind;
}

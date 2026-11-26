import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';

import { AppError, ErrorKind } from '../../../../core/domain/app-error';
import { BannerComponent } from '../../../../shared/presentation/atoms/banner';
import { Crumb } from '../../../../shared/presentation/molecules/breadcrumbs';
import { PageHeaderComponent } from '../../../../shared/presentation/organisms/page-header';
import { ChipComponent } from '../../../../shared/presentation/atoms/chip';
import { ModalComponent } from '../../../../shared/presentation/organisms/modal';
import { ErrorView, describeError } from '../../../../shared/presentation/error-message';
import { confirmFailureMessage } from '../confirm-failure';
import { PERMISSIONS } from '../../../auth/domain/policies/staff-access';
import { SessionState } from '../../../auth/presentation/session.state';
import { ListAnalytes } from '../../../knowledge/domain/usecases/knowledge-usecases';
import {
  LabOrder,
  LabResult,
  OrderDocument,
  OrderTest,
  PatientOption,
  Proposal,
  READINGS,
  Reading,
  ResultReview,
  TestAnalyte,
  TestTypeOption,
  WorklistOrder,
} from '../../domain/entities/orders';
import {
  ConfirmOrder,
  DecideProposal,
  DownloadDocument,
  EvaluateOrder,
  GetOrder,
  GetProposal,
  ListOrderDocuments,
  ListOrderResults,
  ListPatients,
  ListTestAnalytes,
  ListTestTypes,
  ListWorklist,
  RecordResults,
  ReviewOrder,
  ReviewResults,
  UploadReport,
} from '../../domain/usecases/orders-usecases';
import { ORDER_STATUS_LABELS, PRIORITY_LABELS, TEST_STATUS_LABELS, label } from '../labels';
import { DecisionFormComponent, DecisionSubmission } from '../widgets/decision-form';
import { ReviewsState } from '../reviews.state';
import { ProposalViewComponent } from '../widgets/proposal-view';
import {
  AnalyteOption,
  ResultsFormComponent,
  ResultsFormDraft,
  ResultsSubmission,
} from '../widgets/results-form';
import {
  ResultsDraft,
  clearResultsDraft,
  readResultsDraft,
  writeResultsDraft,
} from '../results-draft';
import { DialogAction, DialogComponent } from '../../../../shared/presentation/organisms/dialog';
import { ReviewFormComponent, ReviewSubmission } from '../widgets/review-form';
import { ShadowPanelComponent } from './shadow-panel';
import { PaginatorComponent } from '../../../../shared/presentation/molecules/paginator';
import { PageState } from '../../../../shared/presentation/pagination';

type Overrides = Partial<Record<ErrorKind, string>>;

const RESULTS_ERRORS: Overrides = {
  conflict: 'Esta prueba ya tiene resultados registrados.',
  not_found: 'No encontramos la orden o la prueba indicada.',
  forbidden: 'No tienes permiso para registrar resultados.',
  validation: 'Revisa los valores: algún resultado no es válido.',
};
const UPLOAD_ERRORS: Overrides = {
  validation: 'El informe debe ser un PDF válido de hasta 10 MB.',
  not_found: 'No encontramos la orden.',
  forbidden: 'No tienes permiso para subir informes.',
};
const EVALUATE_ERRORS: Overrides = {
  conflict: 'La orden todavía no tiene todos sus resultados, o ya fue evaluada.',
  forbidden: 'Solo el médico que ordenó puede generar la propuesta.',
};
const DECISION_ERRORS: Overrides = {
  conflict: 'Esta propuesta ya tiene una decisión.',
  validation: 'Escribe el texto que pide la decisión elegida.',
  forbidden: 'Solo el médico que ordenó puede decidir sobre la propuesta.',
};
const REVIEW_ERRORS: Overrides = {
  conflict: 'Esta orden ya fue revisada: el sistema admite una sola revisión.',
  forbidden: 'Solo el médico que ordenó puede revisar la orden.',
  validation: 'Escribe la conclusión de la revisión.',
};
const REVIEW_RESULTS_ERRORS: Overrides = {
  conflict: 'La orden ya está confirmada: las interpretaciones ya no se pueden cambiar.',
  not_found: 'No encontramos ese resultado en la orden.',
  validation: 'Cada interpretación cambiada necesita un motivo.',
  forbidden: 'No tienes permiso para revisar resultados.',
};
const DOWNLOAD_ERRORS: Overrides = {
  forbidden: 'No tienes permiso para descargar este documento.',
  not_found: 'No encontramos el documento para descargar.',
};

/** A decision the person must make before the page moves on. */
interface OrderDialog {
  readonly kind: 'unsaved' | 'sent' | 'info' | 'confirm';
  readonly title: string;
  readonly message: string;
  readonly actions: readonly DialogAction[];
  /** The value Escape sends: the one that keeps the person where they are. */
  readonly dismiss: string;
}

/**
 * Container: one order and what each role can do with it. The backend lets only the ordering doctor
 * (and the patient) read an order, so laboratory staff may find it closed and enter results blind,
 * with the test identifier the doctor gave them.
 */
@Component({
  selector: 'app-order-detail-page',
  imports: [
    DialogComponent,
    PageHeaderComponent,
    PaginatorComponent,
    ModalComponent,
    RouterLink,
    BannerComponent,
    ChipComponent,
    ResultsFormComponent,
    ProposalViewComponent,
    DecisionFormComponent,
    ReviewFormComponent,
    ShadowPanelComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
    .flow-head {
      display: grid;
      gap: 4px;
    }
    .flow-head h2 {
      margin: 0;
    }
    .step {
      display: grid;
      grid-template-columns: auto 1fr auto;
      gap: 14px;
      align-items: start;
      padding-top: 16px;
      border-top: 1px solid var(--border, #dbe3f0);
    }
    .step h3 {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 8px;
      margin: 0;
    }
    .step-no {
      display: grid;
      place-items: center;
      width: 28px;
      height: 28px;
      border-radius: 999px;
      background: var(--blue-deep, #1e3a8a);
      color: #fff;
      font-weight: 700;
    }
    .step-body {
      min-width: 0;
    }
    .docs {
      display: grid;
      gap: 6px;
      margin: 0;
      padding: 0;
      list-style: none;
    }
    .docs li {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 12px;
      padding: 8px 12px;
      border: 1px solid var(--border, #dbe3f0);
      border-radius: 10px;
    }
    .doc-info {
      display: flex;
      flex-direction: column;
      gap: 2px;
      min-width: 0;
    }
    .tag {
      padding: 2px 10px;
      border-radius: 999px;
      background: var(--blue-tint, #eef3fb);
      color: var(--blue-text, #1d4f91);
      font-size: 0.75rem;
      font-weight: 700;
    }
    @media (max-width: 720px) {
      .step {
        grid-template-columns: auto 1fr;
      }
      .step > button {
        grid-column: 2;
      }
    }
`,
  template: `
    <div class="stack">
      <app-page-header area="Órdenes y resultados" title="Detalle de la orden" [crumbs]="crumbs()">
        <div actions>
          <a routerLink="/ordenes" class="btn btn--small">← Regresar a resultados</a>
        </div>
      </app-page-header>

      @if (notice(); as text) {
        <app-banner tone="success">{{ text }}</app-banner>
      }
      @if (error(); as e) {
        @if (modal() === null) {
          <app-banner tone="danger">
            {{ e.message }}
          </app-banner>
        }
      }

      <section class="card stack">
        <div class="row spread">
          <div>
            <h2>Orden</h2>
            <p class="mono small">{{ orderId }}</p>
          </div>
          @if (order(); as o) {
            <div class="row">
              <app-chip [tone]="o.status === 'COMPLETADA' ? 'success' : 'info'">
                {{ orderStatus(o.status) }}
              </app-chip>
              <app-chip [tone]="o.priority === 'URGENTE' ? 'warning' : 'info'">
                {{ priority(o.priority) }}
              </app-chip>
            </div>
          }
        </div>

        @if (loading()) {
          <p class="muted"><span class="spinner" aria-hidden="true"></span> Cargando…</p>
        } @else if (order(); as o) {
          <p class="muted small">
            <strong>Paciente:</strong> {{ patientName(o.patientId) }}
            @if (o.notes) {
              · {{ o.notes }}
            }
          </p>
          <div class="table-wrap">
            <table class="table">
              <thead>
                <tr>
                  <th>Prueba</th>
                  <th>Identificador de la prueba</th>
                  <th>Estado</th>
                </tr>
              </thead>
              <tbody>
                @for (test of testsPager.slice(o.tests); track test.detailId) {
                  <tr>
                    <td>
                      <strong>{{ testTypeName(test.testTypeId) }}</strong>
                    </td>
                    <td class="mono small">{{ test.detailId }}</td>
                    <td>{{ testStatus(test.status) }}</td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
              <app-paginator [total]="o.tests.length" [state]="testsPager" />
        } @else if (restricted()) {
          <app-banner tone="warning">
            El laboratorio no abre la orden completa: registra los resultados desde la cola de
            trabajo. Aquí puedes registrar los resultados de la prueba y subir el informe.
          </app-banner>
          @if (queueItem()?.patientName; as name) {
            <p class="small"><strong>Paciente:</strong> {{ name }}</p>
          }
        }
      </section>

      @if (canRecord && restricted() && results().length > 0) {
        <section class="card stack" aria-labelledby="review-heading">
          <h2 id="review-heading">Revisión de interpretaciones</h2>
          <p class="muted small">
            Medilo clasificó cada resultado frente a sus valores de referencia. Revisa cada lectura: si
            no es la adecuada, cámbiala e indica el motivo. Antes de confirmar, todos los resultados
            deben estar revisados.
          </p>
          <div class="table-wrap">
            <table class="table">
              <thead>
                <tr>
                  <th>Analito</th>
                  <th>Valor</th>
                  <th>Referencia</th>
                  <th>Sistema</th>
                  <th>Tu lectura</th>
                  <th>Motivo</th>
                </tr>
              </thead>
              <tbody>
                @for (result of results(); track result.id) {
                  <tr>
                    <td>{{ result.analyteName }}</td>
                    <td>{{ result.numericValue ?? result.textValue ?? '—' }} {{ result.unit ?? '' }}</td>
                    <td>{{ referenceText(result) }}</td>
                    <td>
                      {{ result.systemInterpretation ? readingLabels[result.systemInterpretation] : 'Sin clasificar' }}
                      @if (!result.reviewed) {
                        <app-chip>Pendiente</app-chip>
                      }
                    </td>
                    <td>
                      <select
                        class="input"
                        [attr.aria-label]="'Tu lectura de ' + result.analyteName"
                        [value]="readingFor(result.id)"
                        (change)="setReading(result.id, $event)"
                      >
                        @for (reading of readings; track reading) {
                          <option [value]="reading">{{ readingLabels[reading] }}</option>
                        }
                      </select>
                    </td>
                    <td>
                      <input
                        class="input"
                        type="text"
                        maxlength="1000"
                        [attr.aria-label]="'Motivo de ' + result.analyteName"
                        [value]="reasonFor(result.id)"
                        (input)="setReason(result.id, $event)"
                        [disabled]="readingFor(result.id) === (result.systemInterpretation ?? 'NO_EVALUABLE')"
                        placeholder="Obligatorio si cambias la lectura"
                      />
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
          @if (pendingReviews() > 0) {
            <p class="small">Faltan {{ pendingReviews() }} resultado(s) por revisar.</p>
          }
          <div>
            <button
              class="btn btn--primary"
              type="button"
              [disabled]="busy() === 'review' || !reviewsReady()"
              (click)="saveReview()"
            >
              Guardar revisión
            </button>
          </div>
        </section>
      }

      @if (order()) {
        <section class="card stack">
          <h2>Resultados</h2>
          @if (results().length === 0) {
            <p class="empty">Todavía no hay resultados registrados.</p>
          } @else {
            <div class="table-wrap">
              <table class="table">
                <thead>
                  <tr>
                    <th>Analito</th>
                    <th>Valor</th>
                    <th>Unidad</th>
                  </tr>
                </thead>
                <tbody>
                  @for (result of resultsPager.slice(results()); track result.id) {
                    <tr>
                      <td>{{ result.analyteName }}</td>
                      <td>{{ result.numericValue ?? result.textValue ?? '—' }}</td>
                      <td>{{ result.unit ?? '—' }}</td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
              <app-paginator [total]="results().length" [state]="resultsPager" />
          }
        </section>
      }

      @if (!canRecord && !restricted() && documents().length > 0) {
        <section class="card stack">
          <h2>Informes adjuntos</h2>
          <ul class="docs">
            @for (doc of documents(); track doc.id) {
              <li>
                <div class="doc-info">
                  <span>{{ doc.name }}</span>
                  <span class="muted small">{{ sizeOf(doc.sizeBytes) }}</span>
                </div>
                <button
                  type="button"
                  class="btn btn--small"
                  [disabled]="busy() === 'download-' + doc.id"
                  (click)="onDownload(doc)"
                >
                  {{ busy() === 'download-' + doc.id ? 'Descargando...' : 'Descargar' }}
                </button>
              </li>
            }
          </ul>
        </section>
      }

      @if (canRecord && (order() || restricted())) {
        <section class="card stack results-flow">
          <header class="flow-head">
            <h2>Resultados</h2>
            <p class="muted small">
              Registrar resultados es obligatorio. Al confirmar, Medilo genera el informe PDF; subir uno propio es
              opcional.
            </p>
          </header>

          <div class="step">
            <span class="step-no" aria-hidden="true">1</span>
            <div class="step-body">
              <h3>Registrar resultados</h3>
              <p class="muted small">Cada prueba se registra una sola vez y no se reescribe.</p>
            </div>
            @if (!readyToConfirm()) {
            <button class="btn btn--primary" type="button" (click)="openResults()">
              Registrar resultados
            </button>
            }
          </div>

          <div class="step">
            <span class="step-no" aria-hidden="true">2</span>
            <div class="step-body stack">
              <h3>Informe en PDF <span class="tag">Opcional</span></h3>
              <p class="muted small">
                Medilo genera el informe de resultados al confirmar la orden. Si quieres, sube además uno propio:
                PDF de hasta 10 MB, se guarda en privado y lo ven el paciente y su médico.
              </p>
              @if (documents().length > 0) {
                <ul class="docs">
                  @for (doc of documents(); track doc.id) {
                    <li>
                      <div class="doc-info">
                        <span>{{ doc.name }}</span>
                        <span class="muted small">{{ sizeOf(doc.sizeBytes) }}</span>
                      </div>
                      <button
                        type="button"
                        class="btn btn--small"
                        [disabled]="busy() === 'download-' + doc.id"
                        (click)="onDownload(doc)"
                      >
                        {{ busy() === 'download-' + doc.id ? 'Descargando...' : 'Descargar' }}
                      </button>
                    </li>
                  }
                </ul>
              } @else {
                <p class="muted small">
                  Todavía no subiste un informe propio. Al confirmar, Medilo genera el de resultados.
                </p>
              }
              <div class="row">
                <input
                  id="report-file"
                  class="input"
                  type="file"
                  accept="application/pdf,.pdf"
                  aria-label="Archivo PDF del informe"
                  (change)="pickFile($event)"
                />
                <button
                  class="btn btn--primary"
                  type="button"
                  [disabled]="!file() || busy() === 'upload'"
                  (click)="upload()"
                >
                  @if (busy() === 'upload') {
                    <span class="spinner" aria-hidden="true"></span> Subiendo…
                  } @else {
                    Subir informe
                  }
                </button>
              </div>
            </div>
          </div>
          @if (readyToConfirm()) {
            <div class="step">
              <span class="step-no" aria-hidden="true">3</span>
              <div class="step-body">
                <h3>Confirmar la orden</h3>
                <p class="muted small">
                  Cierra la orden y genera el informe de resultados, con o sin informe propio. Después no podrás
                  cambiar resultados ni subir informes.
                </p>
              </div>
              <button class="btn btn--primary" type="button" (click)="askConfirm()">Confirmar orden</button>
            </div>
          }
        </section>
        @if (modal() === 'results') {
          <app-modal
            tag="Resultados"
            headline="Registra los resultados de la prueba"
            [bullets]="resultsBullets"
            (closed)="requestCloseResults()"
          >
            @if (error(); as e) {
              <app-banner tone="danger">{{ e.message }}</app-banner>
            }
            <app-results-form
              [tests]="pendingTests()"
              [analytes]="analyteOptions()"
              [testAnalytes]="testAnalytes()"
              (testChanged)="loadTestAnalytes($event)"
              [busy]="busy() === 'results'"
              [initialDetailId]="initialDetail"
              [draft]="draft()"
              (state)="formState.set($event)"
              (back)="requestCloseResults()"
              (submitted)="saveResults($event)"
            />
          </app-modal>
        }

        @if (dialog(); as d) {
          <app-dialog
            [title]="d.title"
            [message]="d.message"
            [actions]="d.actions"
            [dismissValue]="d.dismiss"
            (chosen)="onDialog($event)"
          />
        }

      }

      @if (order() && canSeeProposal) {
        <section class="card stack">
          <h2>Propuesta clínica</h2>
          @if (proposal(); as p) {
            <app-proposal-view [proposal]="p" />
            @if (canDecide && p.status === 'PENDIENTE') {
              <h3>Decisión médica</h3>
              <div>
                <button class="btn btn--primary" type="button" (click)="openModal('decision')">
                  Registrar decisión
                </button>
              </div>
              @if (modal() === 'decision') {
                <app-modal
                  tag="Decisión médica"
                  headline="Registra tu decisión sobre la propuesta"
                  [bullets]="decisionBullets"
                  (closed)="closeModal()"
                >
                  @if (error(); as e) {
                    <app-banner tone="danger">{{ e.message }}</app-banner>
                  }
                  <app-decision-form [busy]="busy() === 'decision'" (submitted)="decide(p, $event)" />
                </app-modal>
              }
            }
          } @else {
            <p class="muted small">
              Cuando todos los resultados existen, el motor genera una propuesta preliminar con las
              reglas validadas. No es un diagnóstico.
            </p>
            <div>
              <button
                class="btn btn--primary"
                type="button"
                [disabled]="busy() === 'evaluate'"
                (click)="evaluate()"
              >
                @if (busy() === 'evaluate') {
                  <span class="spinner" aria-hidden="true"></span> Generando…
                } @else {
                  Generar propuesta preliminar
                }
              </button>
            </div>
          }
        </section>
      }

      @if (order() && canSeeProposal) {
        <app-shadow-panel [orderId]="orderId" [canRecord]="canDecide" />
      }

      @if (order(); as o) {
        @if (canDecide) {
          <section class="card stack">
            <div class="row spread">
              <h2>Revisión médica de la orden</h2>
              @if (reviewed() || alreadyReviewed()) {
                <app-chip tone="success">Revisada</app-chip>
              }
            </div>
            @if (reviewed(); as r) {
              <div class="registered">
                <p><strong>Conclusión</strong></p>
                <p class="text">{{ r.conclusion }}</p>
                @if (r.recommendations) {
                  <p><strong>Recomendaciones</strong></p>
                  <p class="text">{{ r.recommendations }}</p>
                }
                <p class="muted small">
                  Registrada el {{ r.registeredAt.toLocaleString('es-EC') }}.
                </p>
              </div>
              <app-banner tone="info">
                Esta orden ya tiene su revisión. El sistema admite una sola revisión por orden, así
                que no se puede agregar otra.
              </app-banner>
            } @else if (alreadyReviewed()) {
              <app-banner tone="info">
                Esta orden ya fue revisada. El sistema admite una sola revisión por orden y no
                permite volver a leer su texto.
              </app-banner>
            } @else if (o.status === 'COMPLETADA') {
              <div>
                <button class="btn btn--primary" type="button" (click)="openModal('review')">
                  Registrar revisión
                </button>
              </div>
              @if (modal() === 'review') {
                <app-modal
                  tag="Revisión médica"
                  headline="Registra la revisión de la orden"
                  [bullets]="reviewBullets"
                  (closed)="closeModal()"
                >
                  @if (error(); as e) {
                    <app-banner tone="danger">{{ e.message }}</app-banner>
                  }
                  <app-review-form [busy]="busy() === 'review'" (submitted)="review($event)" />
                </app-modal>
              }
            } @else {
              <p class="muted small">
                Se habilita cuando todas las pruebas de la orden tienen sus resultados.
              </p>
            }
          </section>
        }
      }
    </div>
  `,
})
export class OrderDetailPage {
  protected readonly testsPager = new PageState();
  protected readonly crumbs = computed<readonly Crumb[]>(() => [
    { label: 'Inicio', link: '/inicio' },
    { label: 'Órdenes y resultados', link: '/ordenes' },
    { label: `Orden ${this.orderId.slice(0, 8).toUpperCase()}` },
  ]);
  protected readonly resultsPager = new PageState();
  private readonly route = inject(ActivatedRoute);
  protected readonly orderId = this.route.snapshot.paramMap.get('id') ?? '';
  /** Set when the laboratory opened the order from its worklist, on the test that is pending. */
  protected readonly initialDetail = this.route.snapshot.queryParamMap.get('detalle') ?? '';

  private readonly getOrder = inject(GetOrder);
  private readonly listResults = inject(ListOrderResults);
  private readonly listPatients = inject(ListPatients);
  private readonly listTestTypes = inject(ListTestTypes);
  protected readonly patients = signal<readonly PatientOption[]>([]);
  protected readonly testTypes = signal<readonly TestTypeOption[]>([]);
  private readonly recordResults = inject(RecordResults);
  private readonly uploadReport = inject(UploadReport);
  private readonly listDocuments = inject(ListOrderDocuments);
  private readonly downloadDocument = inject(DownloadDocument);
  protected readonly documents = signal<readonly OrderDocument[]>([]);
  private readonly evaluateOrder = inject(EvaluateOrder);
  private readonly getProposal = inject(GetProposal);
  private readonly decideProposal = inject(DecideProposal);
  private readonly reviewOrder = inject(ReviewOrder);
  private readonly listAnalytes = inject(ListAnalytes);
  private readonly listWorklist = inject(ListWorklist);
  private readonly confirmOrder = inject(ConfirmOrder);
  private readonly reviewResults = inject(ReviewResults);
  /** The laboratory's queue says every test has results: the order is ready to be closed. */
  protected readonly readyToConfirm = computed(
    () =>
      this.restricted() &&
      this.queueItem()?.status === 'COMPLETADA' &&
      this.pendingReviews() === 0,
  );
  /** Results the laboratory has not read yet. The order cannot be confirmed while any remains. */
  protected readonly pendingReviews = computed(() => this.results().filter((r) => !r.reviewed).length);
  protected readonly readings = READINGS;
  protected readonly readingLabels: Record<Reading, string> = {
    BAJO: 'Bajo',
    DENTRO_REFERENCIA: 'Dentro de rango',
    ALTO: 'Alto',
    NO_EVALUABLE: 'No evaluable',
  };
  /** The laboratory's working reading and reason for each result, before they are saved. */
  protected readonly readingDraft = signal<Record<string, { reading: Reading; reason: string }>>({});
  /** Results whose reading is new or changed from the effective one: these are sent on save. */
  protected readonly reviewsToSend = computed(() =>
    this.results().filter(
      (r) => !r.reviewed || this.readingFor(r.id) !== (r.interpretation ?? 'NO_EVALUABLE'),
    ),
  );
  /** Every reading that differs from the system's has its reason written. */
  protected readonly reviewsReady = computed(() => {
    const pending = this.reviewsToSend();
    return (
      pending.length > 0 &&
      pending.every(
        (r) =>
          this.readingFor(r.id) === (r.systemInterpretation ?? 'NO_EVALUABLE') ||
          this.reasonFor(r.id).trim().length > 0,
      )
    );
  });
  private readonly listTestAnalytes = inject(ListTestAnalytes);
  private readonly router = inject(Router);
  private readonly reviews = inject(ReviewsState);

  private readonly session = inject(SessionState);
  protected readonly canRecord = this.session.can(PERMISSIONS.resultsRecord);
  protected readonly canSeeProposal = this.session.can(PERMISSIONS.resultsReadWithAccess);
  protected readonly canDecide = this.session.can(PERMISSIONS.reviewsRecord);

  protected readonly order = signal<LabOrder | null>(null);
  protected readonly results = signal<readonly LabResult[]>([]);
  protected readonly proposal = signal<Proposal | null>(null);
  protected readonly analytes = signal<readonly AnalyteOption[]>([]);
  protected readonly restricted = signal(false);
  /** What the open results form holds, reported by the form on every change. */
  protected readonly formState = signal<{ dirty: boolean; draft: ResultsFormDraft } | null>(null);
  protected readonly draft = signal<ResultsDraft | null>(null);
  protected readonly dialog = signal<OrderDialog | null>(null);
  /** The laboratory's queue entry for this order: its tests carry names, the order itself is closed. */
  protected readonly queueItem = signal<WorklistOrder | null>(null);
  /** The analytes of the test being recorded, mandatory ones first. */
  protected readonly testAnalytes = signal<readonly TestAnalyte[]>([]);
  /** The API said this order already has its review (written elsewhere): the text cannot be read back. */
  protected readonly alreadyReviewed = signal(false);
  protected readonly reviewed = computed(() => this.reviews.of(this.orderId));
  protected readonly loading = signal(true);
  protected readonly busy = signal<string | null>(null);
  protected readonly file = signal<File | null>(null);
  protected readonly notice = signal<string | null>(null);
  protected readonly error = signal<ErrorView | null>(null);
  protected readonly modal = signal<'results' | 'decision' | 'review' | null>(null);
  protected readonly resultsBullets = [
    'Los resultados de una prueba se registran una sola vez y no se reescriben.',
    'Revisa cada valor y su unidad antes de guardar.',
  ];
  protected readonly decisionBullets = [
    'La propuesta es preliminar: no es un diagnóstico.',
    'Un rechazo necesita el motivo por escrito.',
  ];
  protected readonly reviewBullets = [
    'El sistema admite una sola revisión por orden.',
    'Escribe la conclusión y, si hace falta, las recomendaciones.',
  ];

  /** Tests still waiting for results: the only ones a laboratory can fill in. */
  protected readonly pendingTests = computed<readonly OrderTest[]>(
    () =>
      this.order()?.tests.filter((t) => t.status === 'PENDIENTE') ??
      this.queueItem()?.tests.filter((t) => t.status === 'PENDIENTE') ??
      [],
  );

  /** Only the analytes of the chosen test: the backend rejects any other one in its results. */
  protected readonly analyteOptions = computed<readonly AnalyteOption[]>(() =>
    this.testAnalytes().map((a) => ({
      id: a.id,
      name: a.name,
      unit: a.unit,
      valueType: a.valueType,
    })),
  );

  protected readonly orderStatus = (code: string) => label(ORDER_STATUS_LABELS, code);
  protected readonly testStatus = (code: string) => label(TEST_STATUS_LABELS, code);
  protected readonly priority = (code: string) => label(PRIORITY_LABELS, code);

  constructor() {
    void this.load();
  }

  protected openModal(name: 'results' | 'decision' | 'review'): void {
    this.error.set(null);
    this.modal.set(name);
  }

  protected closeModal(): void {
    this.modal.set(null);
    this.formState.set(null);
  }

  /** Opens the results form, with the draft saved in this browser for this order if there is one. */
  protected askConfirm(): void {
    const withoutReport = this.documents().length === 0;
    this.dialog.set({
      kind: 'confirm',
      title: 'Confirmar la orden',
      message: withoutReport
        ? 'Medilo generará el informe de resultados al confirmar. Puedes subir antes un informe propio, o confirmar sin él. Al confirmar, la orden queda cerrada: no podrás cambiar resultados ni subir informes.'
        : 'Al confirmar, la orden queda cerrada y Medilo genera el informe de resultados junto al que subiste. Después no podrás cambiar resultados ni subir informes.',
      actions: withoutReport
        ? [
            { label: 'Subir informe', value: 'upload', tone: 'ghost' },
            { label: 'Confirmar sin informe', value: 'confirm', tone: 'primary' },
            { label: 'Volver', value: 'cancel', tone: 'ghost' },
          ]
        : [
            { label: 'Confirmar orden', value: 'confirm', tone: 'primary' },
            { label: 'Volver', value: 'cancel', tone: 'ghost' },
          ],
      dismiss: 'cancel',
    });
  }

  protected openResults(): void {
    this.draft.set(readResultsDraft(this.orderId));
    // Opened from the queue the test is already chosen, so the form never emits testChanged:
    // load its analytes here, or the rows stay empty.
    const test = [...(this.order()?.tests ?? []), ...(this.queueItem()?.tests ?? [])].find(
      (t) => t.detailId === this.initialDetail,
    );
    if (test) void this.loadTestAnalytes(test.testTypeId);
    this.openModal('results');
  }

  /** Leaving with typed values asks first: a draft in this browser, or discard, or keep editing. */
  protected requestCloseResults(): void {
    // A decision is already on screen (Escape reaches both the modal and the dialog): keep it.
    if (this.dialog()) return;
    if (!this.formState()?.dirty) {
      this.closeModal();
      return;
    }
    this.dialog.set({
      kind: 'unsaved',
      title: 'Tienes cambios sin guardar',
      message:
        '¿Quieres guardarlos como borrador en este navegador o regresar sin guardar los cambios?',
      actions: [
        { label: 'Guardar borrador', value: 'draft', tone: 'primary' },
        { label: 'Regresar sin guardar', value: 'discard', tone: 'danger' },
        { label: 'Seguir editando', value: 'stay', tone: 'ghost' },
      ],
      dismiss: 'stay',
    });
  }

  protected onDialog(value: string): void {
    const kind = this.dialog()?.kind;
    this.dialog.set(null);
    if (kind === 'unsaved') {
      if (value === 'draft') this.saveDraft();
      else if (value === 'discard') this.closeModal();
      return;
    }
    if (kind === 'sent') void this.leaveAfterSent();
    if (kind === 'confirm' && value === 'confirm') void this.confirm();
    if (kind === 'confirm' && value === 'upload') document.getElementById('report-file')?.focus();
  }

  private saveDraft(): void {
    const state = this.formState();
    const saved = state !== null && writeResultsDraft({ orderId: this.orderId, ...state.draft });
    this.closeModal();
    if (!saved) {
      this.dialog.set({
        kind: 'info',
        title: 'No pudimos guardar el borrador',
        message:
          'Este navegador no permite guardar borradores ahora. Registra los resultados antes de salir.',
        actions: [{ label: 'Entendido', value: 'ok', tone: 'primary' }],
        dismiss: 'ok',
      });
    }
  }

  /** Closes the order and returns to the queue, which no longer lists it. */
  private async confirm(): Promise<void> {
    try {
      await this.confirmOrder.execute(this.orderId);
      await this.router.navigate(['/ordenes'], { queryParams: { confirmada: '1' } });
    } catch (error) {
      this.error.set({ message: confirmFailureMessage(error) });
    }
  }

  private async leaveAfterSent(): Promise<void> {
    // The laboratory goes back to its queue, where the next pending order is one click away.
    if (this.restricted()) await this.router.navigate(['/ordenes'], { queryParams: { guardado: '1' } });
  }

  protected readingFor(resultId: string): Reading {
    return this.readingDraft()[resultId]?.reading ?? 'NO_EVALUABLE';
  }

  protected reasonFor(resultId: string): string {
    return this.readingDraft()[resultId]?.reason ?? '';
  }

  protected setReading(resultId: string, event: Event): void {
    const reading = (event.target as HTMLSelectElement).value as Reading;
    this.readingDraft.update((draft) => ({
      ...draft,
      [resultId]: { reading, reason: draft[resultId]?.reason ?? '' },
    }));
  }

  protected setReason(resultId: string, event: Event): void {
    const reason = (event.target as HTMLInputElement).value;
    this.readingDraft.update((draft) => ({
      ...draft,
      [resultId]: { reading: draft[resultId]?.reading ?? 'NO_EVALUABLE', reason },
    }));
  }

  protected referenceText(result: LabResult): string {
    if (result.referenceMin === null && result.referenceMax === null) return '—';
    return `${result.referenceMin ?? '…'} – ${result.referenceMax ?? '…'}`;
  }

  protected async saveReview(): Promise<void> {
    const reviews: ResultReview[] = this.reviewsToSend().map((result) => {
      const reading = this.readingFor(result.id);
      const corrected = reading !== (result.systemInterpretation ?? 'NO_EVALUABLE');
      return {
        resultId: result.id,
        reading,
        corrected,
        reason: corrected ? this.reasonFor(result.id).trim() : null,
      };
    });
    await this.run(
      'review',
      async () => {
        await this.reviewResults.execute(this.orderId, reviews);
        await this.loadResultsForReview();
        this.notice.set('Revisión guardada.');
      },
      REVIEW_RESULTS_ERRORS,
    );
  }

  /** The laboratory reads the results it registered, with the system's reading beside its own. */
  private async loadResultsForReview(): Promise<void> {
    const list = await this.listResults.execute(this.orderId);
    this.results.set(list);
    this.readingDraft.set(
      Object.fromEntries(
        list.map((r) => [
          r.id,
          { reading: r.interpretation ?? 'NO_EVALUABLE', reason: r.correctionReason ?? '' },
        ]),
      ),
    );
  }

  protected async saveResults({ detailId, results }: ResultsSubmission): Promise<void> {
    await this.run(
      'results',
      async () => {
        await this.recordResults.execute(this.orderId, detailId, results);
        this.notice.set('Resultados registrados.');
      },
      RESULTS_ERRORS,
    );
    if (this.error()) return;
    clearResultsDraft(this.orderId);
    this.draft.set(null);
    this.dialog.set({
      kind: 'sent',
      title: 'Resultado enviado',
      message: 'Los resultados de la prueba quedaron registrados.',
      actions: [{ label: 'Entendido', value: 'ok', tone: 'primary' }],
      dismiss: 'ok',
    });
  }

  protected async loadTestAnalytes(testTypeId: string): Promise<void> {
    try {
      this.testAnalytes.set(await this.listTestAnalytes.execute(testTypeId));
    } catch {
      // Without the list the form still works with every analyte, just without the prefill.
      this.testAnalytes.set([]);
    }
  }

  protected pickFile(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.file.set(input.files?.item(0) ?? null);
  }

  protected patientName(patientId: string): string {
    const found = this.patients().find((p) => p.id === patientId);
    return found ? found.name : patientId;
  }

  protected testTypeName(testTypeId: string): string {
    const found = this.testTypes().find((t) => t.id === testTypeId);
    return found
      ? found.code
        ? `${found.name} (${found.code})`
        : found.name
      : `${testTypeId.slice(0, 8)}…`;
  }

  protected sizeOf(bytes: number): string {
    if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  }

  protected async upload(): Promise<void> {
    const file = this.file();
    if (!file) return;
    await this.run(
      'upload',
      async () => {
        const report = await this.uploadReport.execute(this.orderId, file);
        this.file.set(null);
        this.documents.set(await this.listDocuments.execute(this.orderId));
        this.notice.set(`Informe «${report.fileName}» guardado.`);
      },
      UPLOAD_ERRORS,
    );
  }

  protected async onDownload(doc: OrderDocument): Promise<void> {
    this.busy.set(`download-${doc.id}`);
    this.error.set(null);
    try {
      const blob = await this.downloadDocument.execute(doc.id);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = doc.name || 'informe.pdf';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      this.error.set(describeError(error, DOWNLOAD_ERRORS));
    } finally {
      this.busy.set(null);
    }
  }

  protected async evaluate(): Promise<void> {
    await this.run(
      'evaluate',
      async () => {
        this.proposal.set(await this.evaluateOrder.execute(this.orderId));
        this.notice.set('Propuesta preliminar generada. Revísala y registra tu decisión.');
      },
      EVALUATE_ERRORS,
    );
  }

  protected async decide(
    proposal: Proposal,
    { decision, text }: DecisionSubmission,
  ): Promise<void> {
    await this.run(
      'decision',
      async () => {
        await this.decideProposal.execute(proposal.id, decision, text);
        this.notice.set('Decisión registrada.');
      },
      DECISION_ERRORS,
    );
  }

  protected async review({ conclusion, recommendations }: ReviewSubmission): Promise<void> {
    await this.run(
      'review',
      async () => {
        await this.reviewOrder.execute(this.orderId, conclusion, recommendations);
        this.reviews.add(this.orderId, {
          conclusion: conclusion.trim(),
          recommendations: recommendations.trim() || null,
          registeredAt: new Date(),
        });
        this.notice.set('Revisión registrada.');
      },
      REVIEW_ERRORS,
      // 409 on a complete order means someone already reviewed it: close the form instead of retrying.
      (error) => {
        if (error instanceof AppError && error.kind === 'conflict') {
          this.alreadyReviewed.set(true);
          this.modal.set(null);
        }
      },
    );
  }

  /** Runs one action, then reloads what it may have changed. Every failure becomes Spanish copy. */
  private async run(
    name: string,
    action: () => Promise<void>,
    overrides: Overrides,
    onError?: (error: unknown) => void,
  ): Promise<void> {
    this.busy.set(name);
    this.notice.set(null);
    this.error.set(null);
    try {
      await action();
      this.modal.set(null);
      await this.refresh();
    } catch (error) {
      this.error.set(describeError(error, overrides));
      onError?.(error);
    } finally {
      this.busy.set(null);
    }
  }

  private async load(): Promise<void> {
    try {
      await this.refresh();
      await this.loadDocuments();
      if (!this.restricted()) {
        const [patients, testTypes] = await Promise.all([
          this.listPatients.execute().catch(() => []),
          this.listTestTypes.execute().catch(() => []),
        ]);
        this.patients.set(patients);
        this.testTypes.set(testTypes);
      }
      if (this.restricted()) await this.loadQueueItem();
      if (this.restricted() && this.canRecord) await this.loadResultsForReview();
      if (this.canRecord) {
        const analytes = await this.listAnalytes.execute().catch(() => []);
        this.analytes.set(analytes);
      }
    } catch (error) {
      this.error.set(
        describeError(error, {
          forbidden: 'No encontramos esa orden, o no tienes acceso a ella.',
          not_found: 'No encontramos esa orden.',
          validation: 'El identificador de la orden no es válido.',
        }),
      );
    } finally {
      this.loading.set(false);
    }
  }

  /** The laboratory cannot read the order, so its test names come from the queue. */
  /** Only who may read the order gets its reports; for anyone else the list simply stays empty. */
  private async loadDocuments(): Promise<void> {
    this.documents.set(await this.listDocuments.execute(this.orderId).catch(() => []));
  }

  private async loadQueueItem(): Promise<void> {
    const items = await this.listWorklist.execute().catch(() => []);
    this.queueItem.set(items.find((item) => item.id === this.orderId) ?? null);
  }

  /** Reads the order, its results and (for the ordering doctor) its proposal. */
  private async refresh(): Promise<void> {
    try {
      this.order.set(await this.getOrder.execute(this.orderId));
      this.restricted.set(false);
    } catch (error) {
      // Laboratory staff cannot read the order they fill in: not an error, a different way to work.
      if (error instanceof AppError && error.kind === 'forbidden' && this.canRecord) {
        this.order.set(null);
        this.restricted.set(true);
        return;
      }
      throw error;
    }
    this.results.set(await this.listResults.execute(this.orderId));
    this.proposal.set(this.canSeeProposal ? await this.getProposal.execute(this.orderId) : null);
  }
}

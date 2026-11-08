import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';

import { AppError, ErrorKind } from '../../../../core/domain/app-error';
import { BannerComponent } from '../../../../shared/presentation/atoms/banner';
import { ChipComponent } from '../../../../shared/presentation/atoms/chip';
import { ErrorView, describeError } from '../../../../shared/presentation/error-message';
import { PERMISSIONS } from '../../../auth/domain/policies/staff-access';
import { SessionState } from '../../../auth/presentation/session.state';
import { ListAnalytes } from '../../../knowledge/domain/usecases/knowledge-usecases';
import { LabOrder, LabResult, Proposal } from '../../domain/entities/orders';
import {
  DecideProposal,
  EvaluateOrder,
  GetOrder,
  GetProposal,
  ListOrderResults,
  RecordResults,
  ReviewOrder,
  UploadReport,
} from '../../domain/usecases/orders-usecases';
import { ORDER_STATUS_LABELS, PRIORITY_LABELS, TEST_STATUS_LABELS, label } from '../labels';
import { DecisionFormComponent, DecisionSubmission } from '../widgets/decision-form';
import { ReviewsState } from '../reviews.state';
import { ProposalViewComponent } from '../widgets/proposal-view';
import { AnalyteOption, ResultsFormComponent, ResultsSubmission } from '../widgets/results-form';
import { ReviewFormComponent, ReviewSubmission } from '../widgets/review-form';

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

/**
 * Container: one order and what each role can do with it. The backend lets only the ordering doctor
 * (and the patient) read an order, so laboratory staff may find it closed and enter results blind,
 * with the test identifier the doctor gave them.
 */
@Component({
  selector: 'app-order-detail-page',
  imports: [
    RouterLink,
    BannerComponent,
    ChipComponent,
    ResultsFormComponent,
    ProposalViewComponent,
    DecisionFormComponent,
    ReviewFormComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="stack">
      <a routerLink="/ordenes" class="small">← Volver a las órdenes</a>

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
            Paciente: <span class="mono">{{ o.patientId }}</span>
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
                @for (test of o.tests; track test.detailId) {
                  <tr>
                    <td class="mono">{{ test.testTypeId.slice(0, 8) }}…</td>
                    <td class="mono">{{ test.detailId }}</td>
                    <td>{{ testStatus(test.status) }}</td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        } @else if (restricted()) {
          <app-banner tone="warning">
            El contenido de esta orden solo lo ve el médico que la creó. Si tienes el identificador
            de la prueba, puedes registrar sus resultados y subir el informe.
          </app-banner>
        }
      </section>

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
                  @for (result of results(); track result.id) {
                    <tr>
                      <td>{{ result.analyteName }}</td>
                      <td>{{ result.numericValue ?? result.textValue ?? '—' }}</td>
                      <td>{{ result.unit ?? '—' }}</td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          }
        </section>
      }

      @if (canRecord && (order() || restricted())) {
        <section class="card stack">
          <div>
            <h2>Registrar resultados</h2>
            <p class="muted small">
              Los resultados de una prueba se registran una sola vez y no se reescriben.
            </p>
          </div>
          <app-results-form
            [tests]="pendingTests()"
            [analytes]="analytes()"
            [busy]="busy() === 'results'"
            (submitted)="saveResults($event)"
          />
        </section>

        <section class="card stack">
          <div>
            <h2>Informe en PDF</h2>
            <p class="muted small">PDF de hasta 10 MB. Se guarda en privado.</p>
          </div>
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
        </section>
      }

      @if (order() && canSeeProposal) {
        <section class="card stack">
          <h2>Propuesta clínica</h2>
          @if (proposal(); as p) {
            <app-proposal-view [proposal]="p" />
            @if (canDecide && p.status === 'PENDIENTE') {
              <h3>Decisión médica</h3>
              <app-decision-form [busy]="busy() === 'decision'" (submitted)="decide(p, $event)" />
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
              <app-review-form [busy]="busy() === 'review'" (submitted)="review($event)" />
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
  protected readonly orderId = inject(ActivatedRoute).snapshot.paramMap.get('id') ?? '';

  private readonly getOrder = inject(GetOrder);
  private readonly listResults = inject(ListOrderResults);
  private readonly recordResults = inject(RecordResults);
  private readonly uploadReport = inject(UploadReport);
  private readonly evaluateOrder = inject(EvaluateOrder);
  private readonly getProposal = inject(GetProposal);
  private readonly decideProposal = inject(DecideProposal);
  private readonly reviewOrder = inject(ReviewOrder);
  private readonly listAnalytes = inject(ListAnalytes);
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
  /** The API said this order already has its review (written elsewhere): the text cannot be read back. */
  protected readonly alreadyReviewed = signal(false);
  protected readonly reviewed = computed(() => this.reviews.of(this.orderId));
  protected readonly loading = signal(true);
  protected readonly busy = signal<string | null>(null);
  protected readonly file = signal<File | null>(null);
  protected readonly notice = signal<string | null>(null);
  protected readonly error = signal<ErrorView | null>(null);

  /** Tests still waiting for results: the only ones a laboratory can fill in. */
  protected readonly pendingTests = computed(
    () => this.order()?.tests.filter((t) => t.status === 'PENDIENTE') ?? [],
  );

  protected readonly orderStatus = (code: string) => label(ORDER_STATUS_LABELS, code);
  protected readonly testStatus = (code: string) => label(TEST_STATUS_LABELS, code);
  protected readonly priority = (code: string) => label(PRIORITY_LABELS, code);

  constructor() {
    void this.load();
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
  }

  protected pickFile(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.file.set(input.files?.item(0) ?? null);
  }

  protected async upload(): Promise<void> {
    const file = this.file();
    if (!file) return;
    await this.run(
      'upload',
      async () => {
        const report = await this.uploadReport.execute(this.orderId, file);
        this.file.set(null);
        this.notice.set(`Informe «${report.fileName}» guardado.`);
      },
      UPLOAD_ERRORS,
    );
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
        if (error instanceof AppError && error.kind === 'conflict') this.alreadyReviewed.set(true);
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

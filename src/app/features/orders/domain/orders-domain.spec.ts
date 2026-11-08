import { AppError } from '../../../core/domain/app-error';
import { LabOrder, NewResult } from './entities/orders';
import {
  MAX_REPORT_BYTES,
  decisionProblems,
  orderProblems,
  reportProblems,
  resultProblems,
  reviewProblems,
} from './policies/orders-policies';
import { OrdersRepository } from './ports/orders.repository';
import {
  CreateOrder,
  DecideProposal,
  GetOrder,
  RecordResults,
  ReviewOrder,
  UploadReport,
} from './usecases/orders-usecases';

const ID = '3b9f2a52-1c61-4f0e-9d0a-6a1c1c2f7e11';
const OTHER = '8d3c7a11-92b4-4d0b-8e56-0f5d9a3b6c22';

const numeric: NewResult = {
  analyteId: ID,
  analyteName: 'Hemoglobina',
  unit: 'g/dL',
  numericValue: 13.5,
  textValue: null,
};

/** Counts calls; a plain class, because vitest flags the rejected promises of mocks as unhandled. */
class FakeRepository extends OrdersRepository {
  calls: string[] = [];
  private readonly order: LabOrder = {
    id: ID,
    patientId: OTHER,
    priority: 'NORMAL',
    status: 'SOLICITADA',
    notes: null,
    tests: [],
  };
  async createOrder() {
    this.calls.push('createOrder');
    return this.order;
  }
  async getOrder() {
    this.calls.push('getOrder');
    return this.order;
  }
  async listResults() {
    this.calls.push('listResults');
    return [];
  }
  async recordResults() {
    this.calls.push('recordResults');
    return this.order;
  }
  async uploadReport() {
    this.calls.push('uploadReport');
    return { id: ID, fileName: 'x.pdf', sizeBytes: 1 };
  }
  async evaluate(): Promise<never> {
    throw new Error('not used');
  }
  async getProposal() {
    return null;
  }
  async decide() {
    this.calls.push('decide');
  }
  async reviewOrder() {
    this.calls.push('reviewOrder');
  }
}

describe('orders policies', () => {
  it('accepts a numeric and a text result', () => {
    expect(
      resultProblems([numeric, { ...numeric, numericValue: null, textValue: 'Negativo' }]),
    ).toEqual([]);
  });

  it('refuses no results, a missing analyte or a missing value', () => {
    expect(resultProblems([])).toHaveLength(1);
    expect(resultProblems([{ ...numeric, analyteName: ' ' }])).toHaveLength(1);
    expect(resultProblems([{ ...numeric, numericValue: null }])).toHaveLength(1);
    expect(resultProblems([{ ...numeric, numericValue: Number.NaN }])).toHaveLength(1);
  });

  it('only accepts a PDF that is not empty and within 10 MB', () => {
    const pdf = { name: 'informe.pdf', type: 'application/pdf', size: 1000 };
    expect(reportProblems(pdf)).toEqual([]);
    expect(
      reportProblems({ ...pdf, name: 'a.exe', type: 'application/x-msdownload' }),
    ).toHaveLength(1);
    expect(reportProblems({ ...pdf, size: 0 })).toHaveLength(1);
    expect(reportProblems({ ...pdf, size: MAX_REPORT_BYTES + 1 })).toHaveLength(1);
  });

  it('asks for text only when the decision needs it', () => {
    expect(decisionProblems('ACEPTAR', '')).toEqual([]);
    expect(decisionProblems('CORREGIR', '  ')).toHaveLength(1);
    expect(decisionProblems('RECHAZAR', '')).toHaveLength(1);
    expect(decisionProblems('CORREGIR', 'Valor confirmado en el equipo.')).toEqual([]);
  });

  it('requires a conclusion for the review', () => {
    expect(reviewProblems('', '')).toHaveLength(1);
    expect(reviewProblems('Resultados coherentes.', '')).toEqual([]);
  });

  it('checks the ids and the amount of tests of a new order', () => {
    expect(orderProblems(ID, [OTHER], '')).toEqual([]);
    expect(orderProblems('no-es-uuid', [OTHER], '')).toHaveLength(1);
    expect(orderProblems(ID, [], '')).toHaveLength(1);
    expect(orderProblems(ID, ['x'], '')).toHaveLength(1);
  });
});

describe('orders use cases', () => {
  it('refuse bad input before reaching the repository', async () => {
    const repository = new FakeRepository();

    expect(() => new GetOrder(repository).execute('nope')).toThrow(AppError);
    expect(() => new RecordResults(repository).execute(ID, OTHER, [])).toThrow(AppError);
    expect(() => new DecideProposal(repository).execute(ID, 'CORREGIR', '')).toThrow(AppError);
    expect(() => new ReviewOrder(repository).execute(ID, '  ', '')).toThrow(AppError);
    expect(() =>
      new UploadReport(repository).execute(ID, new File(['x'], 'a.txt', { type: 'text/plain' })),
    ).toThrow(AppError);
    expect(repository.calls).toEqual([]);
  });

  it('send a valid request trimmed', async () => {
    const repository = new FakeRepository();

    await new GetOrder(repository).execute(`  ${ID} `);
    await new RecordResults(repository).execute(ID, OTHER, [numeric]);
    await new DecideProposal(repository).execute(ID, 'ACEPTAR', '');
    await new ReviewOrder(repository).execute(ID, 'Todo en orden.', '');
    await new CreateOrder(repository).execute({
      patientId: ID,
      testTypeIds: [OTHER],
      priority: 'NORMAL',
      notes: null,
    });

    expect(repository.calls).toEqual([
      'getOrder',
      'recordResults',
      'decide',
      'reviewOrder',
      'createOrder',
    ]);
  });
});

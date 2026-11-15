import { clearResultsDraft, readResultsDraft, writeResultsDraft } from './results-draft';

const ORDER = '3b9f2a52-1c61-4f0e-9d0a-6a1c1c2f7e11';

describe('results draft', () => {
  afterEach(() => sessionStorage.clear());

  it('keeps the draft of one order and gives it back as it was written', () => {
    const draft = { orderId: ORDER, detailId: 'd1', rows: [{ analyteId: 'a1', value: '13,5', unit: 'g/dL' }] };

    expect(writeResultsDraft(draft)).toBe(true);
    expect(readResultsDraft(ORDER)).toEqual(draft);
    expect(readResultsDraft('otra-orden')).toBeNull();
  });

  it('is removed once the results are sent', () => {
    writeResultsDraft({ orderId: ORDER, detailId: 'd1', rows: [] });

    clearResultsDraft(ORDER);

    expect(readResultsDraft(ORDER)).toBeNull();
  });

  it('is never a reason to fail when the browser refuses storage', () => {
    const storage = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota');
    });
    const read = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });

    expect(writeResultsDraft({ orderId: ORDER, detailId: 'd1', rows: [] })).toBe(false);
    expect(readResultsDraft(ORDER)).toBeNull();
    storage.mockRestore();
    read.mockRestore();
  });
});

import { afterEach, describe, expect, it, vi } from 'vitest';
import { randomInt } from 'node:crypto';
import { sampleAvailableNumbers } from '../src/modules/raffles/raffleNumbers';

vi.mock('node:crypto', async (importOriginal) => ({
  ...await importOriginal<typeof import('node:crypto')>(), randomInt: vi.fn(),
}));
afterEach(() => { vi.resetAllMocks(); });
const chooseLast = () => vi.mocked(randomInt).mockImplementation(((max: number) => max - 1) as typeof randomInt);

describe('Emissão aleatória de bilhetes', () => {
  it('usa os índices do gerador criptográfico em vez de emitir uma sequência', () => {
    chooseLast();
    expect(sampleAvailableNumbers(10, [], 3)).toEqual([9, 0, 1]);
    expect(randomInt).toHaveBeenNthCalledWith(1, 10);
    expect(randomInt).toHaveBeenNthCalledWith(2, 9);
    expect(randomInt).toHaveBeenNthCalledWith(3, 8);
  });
  it('exclui todos os números vendidos, incluindo os sequenciais antigos', () => {
    chooseLast();
    const sold = [0, 1, 2, 5, 9];
    const result = sampleAvailableNumbers(10, sold, 4);
    expect(new Set(result).size).toBe(4);
    expect(result.every((n) => !sold.includes(n) && n >= 0 && n < 10)).toBe(true);
    expect(sold).toEqual([0, 1, 2, 5, 9]);
  });
  it('encontra o último número disponível sem tentativas repetidas', () => {
    chooseLast();
    expect(sampleAvailableNumbers(10, [0, 1, 2, 3, 4, 5, 6, 8, 9], 1)).toEqual([7]);
    expect(randomInt).toHaveBeenCalledTimes(1);
  });
  it('permite vender toda a faixa restante sem duplicar números', () => {
    chooseLast();
    expect(sampleAvailableNumbers(10, [0, 3, 9], 7).sort((a, b) => a - b)).toEqual([1, 2, 4, 5, 6, 7, 8]);
  });
  it('inclui os limites zero e último número e respeita o limite de 100 mil', () => {
    vi.mocked(randomInt).mockImplementation(() => 0);
    const result = sampleAvailableNumbers(100000, [], 1000);
    expect(result).toHaveLength(1000);
    expect(new Set(result).size).toBe(1000);
    expect(result[0]).toBe(0);
    chooseLast();
    expect(sampleAvailableNumbers(100000, [], 1)).toEqual([99999]);
  });
  it.each([
    [10, [0, 1, 2], 8], [10, [], 0], [10, [], 1.5], [0, [], 1],
    [100001, [], 1], [10, [-1], 1], [10, [10], 1], [10, [1.5], 1],
  ] as [number, number[], number][])('rejeita faixa ou quantidade inválida (%j, %j, %j)', (total, sold, quantity) => {
    expect(() => sampleAvailableNumbers(total, sold, quantity)).toThrow(RangeError);
    expect(randomInt).not.toHaveBeenCalled();
  });
});

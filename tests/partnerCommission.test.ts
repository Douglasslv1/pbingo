import { describe, expect, it } from 'vitest';
import { commissionCents } from '../src/modules/partners/commission.util';
describe('Comissões em centavos', () => {
  it.each([[5000, 500, 250], [4500, 500, 225], [199, 500, 9], [1, 1, 0], [0, 500, 0], [999999999, 10000, 999999999]])(
    'valor %i e percentual %i geram %i centavos', (value, rate, expected) => expect(commissionCents(value, rate)).toBe(expected),
  );
  it('reverte proporcionalmente usando o total acumulado devolvido, sem acumular arredondamentos', () => {
    const original = commissionCents(199, 500);
    const firstReversal = original - commissionCents(99, 500);
    const fullReversal = original - commissionCents(0, 500);
    expect(firstReversal).toBe(5); expect(fullReversal).toBe(9);
  });
  it.each([[-1, 500], [1.5, 500], [1000000000, 500], [100, -1], [100, 10001], [100, 1.5]])('recusa valor ou percentual inválido %i/%i', (value, rate) => {
    expect(() => commissionCents(value, rate)).toThrow(RangeError);
  });
});

/** Basis points: 500 = 5%. Keep each commission in whole cents, rounded down once. */
export function commissionCents(paidCents: number, rateBps: number): number {
  if (!Number.isSafeInteger(paidCents) || paidCents < 0 || paidCents > 999999999
    || !Number.isInteger(rateBps) || rateBps < 0 || rateBps > 10000) throw new RangeError('Valor ou percentual inválido');
  return Math.floor(paidCents * rateBps / 10000);
}

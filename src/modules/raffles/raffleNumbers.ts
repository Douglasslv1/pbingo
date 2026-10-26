import { randomInt } from 'node:crypto';

/** Uniform sampling without replacement; bounded even when almost every number is sold. */
export function sampleAvailableNumbers(totalTickets: number, usedNumbers: readonly number[], quantity: number): number[] {
  if (!Number.isInteger(totalTickets) || totalTickets < 1 || totalTickets > 100000
    || !Number.isInteger(quantity) || quantity < 1
    || usedNumbers.some((number) => !Number.isInteger(number) || number < 0 || number >= totalTickets)) {
    throw new RangeError('Faixa ou quantidade de bilhetes inválida');
  }
  const used = new Set(usedNumbers);
  if (quantity > totalTickets - used.size) throw new RangeError('Quantidade de bilhetes indisponível');
  const available = Array.from({ length: totalTickets }, (_, number) => number).filter((number) => !used.has(number));
  // Partial Fisher–Yates with cryptographic, unbiased integer draws.
  for (let i = 0; i < quantity; i++) {
    const index = i + randomInt(available.length - i);
    [available[i], available[index]] = [available[index], available[i]];
  }
  return available.slice(0, quantity);
}

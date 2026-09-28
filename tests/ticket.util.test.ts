import { describe, expect, it } from 'vitest';
import {
  flattenMatrixNumbers,
  generateBingoMatrix,
  isMatrixComplete,
} from '../src/modules/rounds/ticket.util';

const COLUMN_RANGES: Array<[number, number]> = [
  [1, 15],
  [16, 30],
  [31, 45],
  [46, 60],
  [61, 75],
];

describe('ticket.util', () => {
  it('gera uma matriz 5x5 com espaco livre no centro e numeros unicos dentro do range de cada coluna', () => {
    const matrix = generateBingoMatrix();

    expect(matrix).toHaveLength(5);
    matrix.forEach((row) => expect(row).toHaveLength(5));
    expect(matrix[2][2]).toBeNull();

    for (let col = 0; col < 5; col += 1) {
      const columnValues = matrix
        .map((row) => row[col])
        .filter((value): value is number => value !== null);

      expect(new Set(columnValues).size).toBe(columnValues.length);

      const [min, max] = COLUMN_RANGES[col];
      columnValues.forEach((value) => {
        expect(value).toBeGreaterThanOrEqual(min);
        expect(value).toBeLessThanOrEqual(max);
      });
    }
  });

  it('flattenMatrixNumbers retorna as 24 casas numeradas, ignorando o espaco livre', () => {
    const matrix = generateBingoMatrix();
    expect(flattenMatrixNumbers(matrix)).toHaveLength(24);
  });

  it('isMatrixComplete so retorna true quando todos os numeros da cartela foram sorteados', () => {
    const matrix = generateBingoMatrix();
    const numbers = flattenMatrixNumbers(matrix);

    expect(isMatrixComplete(matrix, numbers.slice(0, numbers.length - 1))).toBe(false);
    expect(isMatrixComplete(matrix, numbers)).toBe(true);
  });
});

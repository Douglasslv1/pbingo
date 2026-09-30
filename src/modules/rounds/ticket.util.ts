import { randomInt } from 'crypto';

const COLUMN_RANGES: Array<[number, number]> = [
  [1, 15],
  [16, 30],
  [31, 45],
  [46, 60],
  [61, 75],
];

const GRID_SIZE = 5;
const CENTER_ROW = 2;
const CENTER_COL = 2;

export type BingoMatrix = (number | null)[][];

function pickUniqueRandom(min: number, max: number, count: number): number[] {
  const pool: number[] = [];
  for (let n = min; n <= max; n += 1) {
    pool.push(n);
  }
  for (let i = pool.length - 1; i > 0; i -= 1) {
    const j = randomInt(i + 1);
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, count);
}

export function generateBingoMatrix(): BingoMatrix {
  const columns = COLUMN_RANGES.map(([min, max]) => pickUniqueRandom(min, max, GRID_SIZE));

  const matrix: BingoMatrix = [];
  for (let row = 0; row < GRID_SIZE; row += 1) {
    const rowValues: (number | null)[] = [];
    for (let col = 0; col < GRID_SIZE; col += 1) {
      const isFreeSpace = row === CENTER_ROW && col === CENTER_COL;
      rowValues.push(isFreeSpace ? null : columns[col][row]);
    }
    matrix.push(rowValues);
  }
  return matrix;
}

export function flattenMatrixNumbers(matrix: BingoMatrix): number[] {
  return matrix.flat().filter((value): value is number => value !== null);
}

export function isMatrixComplete(matrix: BingoMatrix, drawnNumbers: number[]): boolean {
  const drawnSet = new Set(drawnNumbers);
  return flattenMatrixNumbers(matrix).every((number) => drawnSet.has(number));
}

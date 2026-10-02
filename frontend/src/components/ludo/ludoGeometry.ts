/**
 * Geometria do tabuleiro de Ludo (grade 15x15), espelhando as regras do servidor:
 * progresso -1 = base, 0..50 = volta, 51..55 = reta final, 56 = centro. Pontos em unidades de
 * casa (y, x), com o centro de cada casa em .5.
 */
export type Point = [number, number];

export const SIZE = 15;
export const BASE = -1;
export const LAST_TRACK = 50;
export const FINISH = 56;
const TRACK_LENGTH = 52;
const COLOR_OFFSET = 13;

export const COLOR_NAMES = ['vermelho', 'verde', 'amarelo', 'azul'];

const cell = (row: number, col: number): Point => [row + 0.5, col + 0.5];
/** Gira 90 graus no sentido anti-horario. */
const turnLeft = ([y, x]: Point): Point => [SIZE - x, y];
const turnLeftTimes = (point: Point, times: number): Point =>
  Array.from({ length: times }).reduce<Point>((p) => turnLeft(p), point);

/**
 * Primeiro quarto da volta, da casa de saida da cor 0 (canto superior direito) ate a saida da cor 1;
 * os outros quartos sao o mesmo trecho girado. As pecas andam no sentido anti-horario.
 */
const QUARTER: Point[] = [
  ...[13, 12, 11, 10, 9].map((col) => cell(6, col)),
  ...[5, 4, 3, 2, 1, 0].map((row) => cell(row, 8)),
  cell(0, 7),
  cell(0, 6),
];
const TRACK: Point[] = [0, 1, 2, 3].flatMap((quarter) => QUARTER.map((point) => turnLeftTimes(point, quarter)));
const HOME_COLUMN: Point[] = [13, 12, 11, 10, 9].map((col) => cell(7, col));
const BASE_SLOTS: Point[] = [
  [2, 11],
  [2, 13],
  [4, 11],
  [4, 13],
];
/** Area da base da cor 0 (canto superior direito): linha, coluna e lado. */
export const BASE_AREA = { y: 0, x: 9, size: 6 };
/** Onde a peca da cor 0 fica ao chegar ao centro (no triangulo da sua cor). */
const FINISH_POINT: Point = [7.5, 8.4];

/** Ponto de uma peca no tabuleiro sem girar (cor 0 no canto superior direito). */
function rawPoint(color: number, progress: number, piece: number): Point {
  if (progress === BASE) return turnLeftTimes(BASE_SLOTS[piece], color);
  if (progress <= LAST_TRACK) return TRACK[(color * COLOR_OFFSET + progress) % TRACK_LENGTH];
  if (progress < FINISH) return turnLeftTimes(HOME_COLUMN[progress - LAST_TRACK - 1], color);
  return turnLeftTimes(FINISH_POINT, color);
}

/** Quantas voltas girar para a cor de quem olha ficar embaixo, a direita (posicao da cor 3). */
export const viewTurns = (myColor: number) => (3 - myColor + 4) % 4;

/** Ponto de uma casa da volta (0..51), ja girado. */
export const squarePoint = (square: number, turns: number): Point => turnLeftTimes(TRACK[square], turns);

export function pointOf(color: number, progress: number, piece: number, turns: number): Point {
  return turnLeftTimes(rawPoint(color, progress, piece), turns);
}

/** Pontos percorridos por uma peca de `from` ate `to`, casa a casa (saindo da base vai direto a saida). */
export function pathOf(color: number, from: number, to: number, piece: number, turns: number): Point[] {
  const steps = from === BASE ? [BASE, 0] : Array.from({ length: to - from + 1 }, (_, i) => from + i);
  return steps.map((progress) => pointOf(color, progress, piece, turns));
}

/** Casas do desenho do tabuleiro, ja giradas. */
export function boardCells(turns: number) {
  const at = (point: Point, times: number) => turnLeftTimes(point, times + turns);
  return {
    track: TRACK.map((point, index) => ({
      point: turnLeftTimes(point, turns),
      // Saida de cada cor pintada com a cor; estrelas (casas seguras) 8 casas depois
      color: index % COLOR_OFFSET === 0 ? index / COLOR_OFFSET : null,
      safe: index % COLOR_OFFSET === 0 || index % COLOR_OFFSET === 8,
    })),
    homes: [0, 1, 2, 3].flatMap((color) => HOME_COLUMN.map((point) => ({ point: at(point, color), color }))),
    bases: [0, 1, 2, 3].map((color) => ({
      color,
      // Canto superior esquerdo da area girada: gira o centro e volta meia area
      center: at([BASE_AREA.y + BASE_AREA.size / 2, BASE_AREA.x + BASE_AREA.size / 2], color),
      slots: BASE_SLOTS.map((point) => at(point, color)),
    })),
    // Triangulo de cada cor no centro: aponta para a reta final da cor
    finishes: [0, 1, 2, 3].map((color) => ({
      color,
      points: ([[6, 9], [9, 9], [7.5, 7.5]] as Point[]).map((point) => at(point, color)),
    })),
  };
}

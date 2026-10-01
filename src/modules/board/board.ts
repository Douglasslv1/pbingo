/** Base comum dos jogos de tabuleiro 8x8 (damas e xadrez). Casa 0 = canto superior esquerdo (a8). */
export type Color = 'w' | 'b';

export const other = (color: Color): Color => (color === 'w' ? 'b' : 'w');
export const rowOf = (square: number) => square >> 3;
export const colOf = (square: number) => square & 7;
export const inside = (row: number, col: number) => row >= 0 && row < 8 && col >= 0 && col < 8;
export const squareAt = (row: number, col: number) => row * 8 + col;

/** Nome da casa no tabuleiro, visto pelas brancas (ex.: 52 = "e2"). */
export const squareName = (square: number) => `${'abcdefgh'[colOf(square)]}${8 - rowOf(square)}`;

export const DIAGONALS: ReadonlyArray<readonly [number, number]> = [
  [-1, -1],
  [-1, 1],
  [1, -1],
  [1, 1],
];

/** Lugar na mesa de cada cor: as brancas sao sorteadas no inicio da partida. */
export const seatOfColor = (whiteSeat: number, color: Color) => (color === 'w' ? whiteSeat : 1 - whiteSeat);
export const colorOfSeat = (whiteSeat: number, seat: number): Color => (seat === whiteSeat ? 'w' : 'b');

/** Desistencia e tempo esgotado encerram qualquer jogo de tabuleiro com vitoria do adversario. */
export type EndAction = { type: 'RESIGN' } | { type: 'TIMEOUT' };

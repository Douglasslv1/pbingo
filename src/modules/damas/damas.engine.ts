import { randomInt } from 'crypto';
import { Color, colOf, DIAGONALS, EndAction, inside, other, rowOf, squareAt } from '../board/board';
import { GameRuleError } from '../tables/tables.types';

/**
 * Damas brasileiras: tabuleiro 8x8, 12 pedras para cada lado nas casas escuras, brancas comecam.
 * Pedra: anda 1 casa na diagonal para frente e captura para frente e para tras.
 * Dama: anda e captura a qualquer distancia na diagonal ("dama voadora").
 * Captura obrigatoria, e entre as capturas possiveis vale a de MAIS pecas (lei da maioria).
 */
export type DamasPiece = 'w' | 'W' | 'b' | 'B';

export type DamasAction = { type: 'MOVE'; path: number[] } | EndAction;

export interface DamasResult {
  winner: Color | null;
  reason: 'NO_MOVES' | 'RESIGN' | 'TIMEOUT' | 'DRAW_KINGS';
}

export interface DamasState {
  board: Array<DamasPiece | null>;
  turn: Color;
  whiteSeat: number;
  /** Lances seguidos so de damas, sem captura: com 20 de cada lado (40), empate. */
  quietKingPlies: number;
  moveCount: number;
  lastMove: number[] | null;
  status: 'PLAYING' | 'FINISHED';
  result: DamasResult | null;
}

export class DamasRuleError extends GameRuleError {}

export const DRAW_QUIET_KING_PLIES = 40;

const colorOf = (piece: DamasPiece): Color => (piece.toLowerCase() as Color);
const isKing = (piece: DamasPiece) => piece === 'W' || piece === 'B';
/** Linha para onde as pedras avancam: brancas sobem (linha diminui), pretas descem. */
const forward = (color: Color) => (color === 'w' ? -1 : 1);
const promotionRow = (color: Color) => (color === 'w' ? 0 : 7);

export function initialBoard(): Array<DamasPiece | null> {
  return Array.from({ length: 64 }, (_, square) => {
    const row = rowOf(square);
    if ((row + colOf(square)) % 2 === 0) return null;
    if (row <= 2) return 'b';
    if (row >= 5) return 'w';
    return null;
  });
}

export function dealGame(random = randomInt): DamasState {
  return {
    board: initialBoard(),
    turn: 'w',
    whiteSeat: random(2),
    quietKingPlies: 0,
    moveCount: 0,
    lastMove: null,
    status: 'PLAYING',
    result: null,
  };
}

/**
 * Todas as sequencias de captura a partir de uma casa. As pecas capturadas so saem no fim do lance
 * (nao podem ser puladas duas vezes e continuam bloqueando o caminho). Uma pedra que passa pela ultima
 * linha no meio da captura continua pedra.
 */
function capturePaths(board: Array<DamasPiece | null>, from: number): number[][] {
  const piece = board[from]!;
  const color = colorOf(piece);
  const paths: number[][] = [];
  const empty = (square: number) => square === from || board[square] === null;

  function search(at: number, captured: Set<number>, path: number[]) {
    let extended = false;
    for (const [dr, dc] of DIAGONALS) {
      let row = rowOf(at) + dr;
      let col = colOf(at) + dc;
      // A dama pode percorrer casas vazias ate encontrar a peca a capturar
      if (isKing(piece)) {
        while (inside(row, col) && empty(squareAt(row, col))) {
          row += dr;
          col += dc;
        }
      }
      if (!inside(row, col)) continue;
      const target = squareAt(row, col);
      const victim = board[target];
      if (target === from || !victim || colorOf(victim) === color || captured.has(target)) continue;

      let landRow = row + dr;
      let landCol = col + dc;
      while (inside(landRow, landCol) && empty(squareAt(landRow, landCol))) {
        const landing = squareAt(landRow, landCol);
        extended = true;
        search(landing, new Set(captured).add(target), [...path, landing]);
        if (!isKing(piece)) break;
        landRow += dr;
        landCol += dc;
      }
    }
    if (!extended && path.length > 1) paths.push(path);
  }

  search(from, new Set(), [from]);
  return paths;
}

function simpleMoves(board: Array<DamasPiece | null>, from: number): number[][] {
  const piece = board[from]!;
  const moves: number[][] = [];
  for (const [dr, dc] of DIAGONALS) {
    if (!isKing(piece) && dr !== forward(colorOf(piece))) continue;
    let row = rowOf(from) + dr;
    let col = colOf(from) + dc;
    while (inside(row, col) && board[squareAt(row, col)] === null) {
      moves.push([from, squareAt(row, col)]);
      if (!isKing(piece)) break;
      row += dr;
      col += dc;
    }
  }
  return moves;
}

/** Pecas capturadas por um lance: a peca adversaria entre cada par de casas do caminho. */
function capturedBy(board: Array<DamasPiece | null>, path: number[]): number[] {
  return path.slice(1).flatMap((to, index) => {
    const from = path[index];
    const dr = Math.sign(rowOf(to) - rowOf(from));
    const dc = Math.sign(colOf(to) - colOf(from));
    const found: number[] = [];
    for (let row = rowOf(from) + dr, col = colOf(from) + dc; squareAt(row, col) !== to; row += dr, col += dc) {
      if (board[squareAt(row, col)] !== null) found.push(squareAt(row, col));
    }
    return found;
  });
}

/** Lances permitidos ao lado da vez: com captura possivel, so as de mais pecas. */
export function legalPaths(state: DamasState): number[][] {
  if (state.status !== 'PLAYING') return [];
  const mine = state.board.flatMap((piece, square) => (piece && colorOf(piece) === state.turn ? [square] : []));
  const captures = mine.flatMap((square) => capturePaths(state.board, square));
  if (captures.length === 0) return mine.flatMap((square) => simpleMoves(state.board, square));
  const most = Math.max(...captures.map((path) => path.length));
  return captures.filter((path) => path.length === most);
}

const samePath = (a: number[], b: number[]) => a.length === b.length && a.every((square, i) => square === b[i]);

function finish(state: DamasState, result: DamasResult): DamasState {
  return { ...state, status: 'FINISHED', result };
}

export function applyAction(state: DamasState, color: Color, action: DamasAction): DamasState {
  if (state.status !== 'PLAYING') throw new DamasRuleError('A partida já terminou');
  const counted = { ...state, moveCount: state.moveCount + 1 };

  if (action.type === 'RESIGN' || action.type === 'TIMEOUT') {
    return finish(counted, { winner: other(color), reason: action.type });
  }
  if (color !== state.turn) throw new DamasRuleError('Não é a sua vez');
  if (!legalPaths(state).some((path) => samePath(path, action.path))) {
    throw new DamasRuleError('Lance inválido');
  }

  const path = action.path;
  const board = [...state.board];
  const piece = board[path[0]]!;
  const captured = capturedBy(state.board, path);
  captured.forEach((square) => (board[square] = null));
  board[path[0]] = null;
  const to = path[path.length - 1];
  board[to] = !isKing(piece) && rowOf(to) === promotionRow(color) ? (piece.toUpperCase() as DamasPiece) : piece;

  const quietKingPlies = captured.length === 0 && isKing(piece) ? state.quietKingPlies + 1 : 0;
  const next: DamasState = { ...counted, board, turn: other(color), quietKingPlies, lastMove: path };

  if (legalPaths(next).length === 0) return finish(next, { winner: color, reason: 'NO_MOVES' });
  if (quietKingPlies >= DRAW_QUIET_KING_PLIES) return finish(next, { winner: null, reason: 'DRAW_KINGS' });
  return next;
}

export const capturesIn = (state: DamasState, path: number[]) => capturedBy(state.board, path).length;

import { randomInt } from 'crypto';
import { Color, colOf, DIAGONALS, EndAction, inside, other, rowOf, squareAt } from '../board/board';
import { GameRuleError } from '../tables/tables.types';

/** Pecas brancas em maiuscula, pretas em minuscula (como na notacao FEN). */
export type XadrezPiece = 'K' | 'Q' | 'R' | 'B' | 'N' | 'P' | 'k' | 'q' | 'r' | 'b' | 'n' | 'p';
export type Promotion = 'Q' | 'R' | 'B' | 'N';

export interface XadrezMove {
  from: number;
  to: number;
  promotion?: Promotion;
}

export type XadrezAction = ({ type: 'MOVE' } & XadrezMove) | EndAction;

export interface XadrezResult {
  winner: Color | null;
  reason: 'CHECKMATE' | 'RESIGN' | 'TIMEOUT' | 'STALEMATE' | 'FIFTY_MOVES' | 'REPETITION' | 'MATERIAL';
}

export interface XadrezState {
  board: Array<XadrezPiece | null>;
  turn: Color;
  /** Roques ainda possiveis: K/Q das brancas, k/q das pretas. */
  castling: string;
  /** Casa por onde um peao acabou de passar com o avanco duplo (alvo do en passant). */
  enPassant: number | null;
  /** Lances (de cada lado) sem captura nem movimento de peao: com 100, empate pela regra dos 50 lances. */
  halfmove: number;
  /** Posicoes ja ocorridas, para o empate por repeticao (3 vezes). */
  positions: string[];
  whiteSeat: number;
  moveCount: number;
  lastMove: XadrezMove | null;
  status: 'PLAYING' | 'FINISHED';
  result: XadrezResult | null;
}

export class XadrezRuleError extends GameRuleError {}

const ORTHOGONALS: ReadonlyArray<readonly [number, number]> = [
  [-1, 0],
  [1, 0],
  [0, -1],
  [0, 1],
];
const KNIGHT: ReadonlyArray<readonly [number, number]> = [
  [-2, -1],
  [-2, 1],
  [-1, -2],
  [-1, 2],
  [1, -2],
  [1, 2],
  [2, -1],
  [2, 1],
];
const KING = [...DIAGONALS, ...ORTHOGONALS];

export const colorOf = (piece: XadrezPiece): Color => (piece === piece.toUpperCase() ? 'w' : 'b');
const kind = (piece: XadrezPiece) => piece.toUpperCase();
const ofColor = (color: Color, piece: string) => (color === 'w' ? piece : piece.toLowerCase()) as XadrezPiece;

const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

/** Posicao a partir da notacao FEN (usada no inicio e nos testes). */
export function fromFen(fen: string, whiteSeat = 0): XadrezState {
  const [placement, turn, castling, ep, halfmove] = fen.split(' ');
  const board: Array<XadrezPiece | null> = [];
  for (const char of placement.replace(/\//g, '')) {
    if (/\d/.test(char)) board.push(...Array(Number(char)).fill(null));
    else board.push(char as XadrezPiece);
  }
  const enPassant = ep === '-' ? null : (8 - Number(ep[1])) * 8 + 'abcdefgh'.indexOf(ep[0]);
  const state: XadrezState = {
    board,
    turn: turn as Color,
    castling: castling === '-' ? '' : castling,
    enPassant,
    halfmove: Number(halfmove ?? 0),
    positions: [],
    whiteSeat,
    moveCount: 0,
    lastMove: null,
    status: 'PLAYING',
    result: null,
  };
  return { ...state, positions: [positionKey(state)] };
}

export const dealGame = (random = randomInt) => fromFen(START, random(2));

function positionKey(state: Pick<XadrezState, 'board' | 'turn' | 'castling' | 'enPassant'>): string {
  return `${state.board.map((piece) => piece ?? '.').join('')} ${state.turn} ${state.castling} ${state.enPassant ?? '-'}`;
}

/** A casa e atacada por alguma peca da cor `by`? */
export function isAttacked(board: Array<XadrezPiece | null>, square: number, by: Color): boolean {
  const row = rowOf(square);
  const col = colOf(square);
  const at = (r: number, c: number) => (inside(r, c) ? board[squareAt(r, c)] : null);

  // Peao branco ataca para cima: fica uma linha abaixo da casa atacada
  const pawnRow = by === 'w' ? row + 1 : row - 1;
  if ([-1, 1].some((dc) => at(pawnRow, col + dc) === ofColor(by, 'P'))) return true;
  if (KNIGHT.some(([dr, dc]) => at(row + dr, col + dc) === ofColor(by, 'N'))) return true;
  if (KING.some(([dr, dc]) => at(row + dr, col + dc) === ofColor(by, 'K'))) return true;

  const slides = (dirs: typeof DIAGONALS, pieces: string[]) =>
    dirs.some(([dr, dc]) => {
      for (let r = row + dr, c = col + dc; inside(r, c); r += dr, c += dc) {
        const piece = board[squareAt(r, c)];
        if (piece) return colorOf(piece) === by && pieces.includes(kind(piece));
      }
      return false;
    });
  return slides(DIAGONALS, ['B', 'Q']) || slides(ORTHOGONALS, ['R', 'Q']);
}

const kingSquare = (board: Array<XadrezPiece | null>, color: Color) => board.indexOf(ofColor(color, 'K'));
export const inCheck = (state: Pick<XadrezState, 'board'>, color: Color) =>
  isAttacked(state.board, kingSquare(state.board, color), other(color));

/** Lances sem olhar se deixam o proprio rei em xeque. */
function pseudoMoves(state: XadrezState): XadrezMove[] {
  const { board, turn } = state;
  const moves: XadrezMove[] = [];
  const enemy = (square: number) => board[square] !== null && colorOf(board[square]!) !== turn;
  const add = (from: number, to: number) => {
    const lastRow = turn === 'w' ? 0 : 7;
    if (kind(board[from]!) === 'P' && rowOf(to) === lastRow) {
      (['Q', 'R', 'B', 'N'] as Promotion[]).forEach((promotion) => moves.push({ from, to, promotion }));
    } else moves.push({ from, to });
  };

  board.forEach((piece, from) => {
    if (!piece || colorOf(piece) !== turn) return;
    const row = rowOf(from);
    const col = colOf(from);
    const steps = (dirs: typeof DIAGONALS, slide: boolean) =>
      dirs.forEach(([dr, dc]) => {
        for (let r = row + dr, c = col + dc; inside(r, c); r += dr, c += dc) {
          const to = squareAt(r, c);
          if (board[to] === null) add(from, to);
          else {
            if (enemy(to)) add(from, to);
            break;
          }
          if (!slide) break;
        }
      });

    switch (kind(piece)) {
      case 'P': {
        const dir = turn === 'w' ? -1 : 1;
        const one = squareAt(row + dir, col);
        if (inside(row + dir, col) && board[one] === null) {
          add(from, one);
          const startRow = turn === 'w' ? 6 : 1;
          const two = squareAt(row + 2 * dir, col);
          if (row === startRow && board[two] === null) add(from, two);
        }
        [-1, 1].forEach((dc) => {
          if (!inside(row + dir, col + dc)) return;
          const to = squareAt(row + dir, col + dc);
          if (enemy(to) || to === state.enPassant) add(from, to);
        });
        break;
      }
      case 'N':
        steps(KNIGHT, false);
        break;
      case 'B':
        steps(DIAGONALS, true);
        break;
      case 'R':
        steps(ORTHOGONALS, true);
        break;
      case 'Q':
        steps(KING, true);
        break;
      case 'K': {
        steps(KING, false);
        // Roque: direito ainda valido, casas entre rei e torre vazias e o rei nao passa por casa atacada
        const homeRow = turn === 'w' ? 7 : 0;
        const sides = [
          { flag: ofColor(turn, 'K'), empty: [5, 6], path: [4, 5, 6] },
          { flag: ofColor(turn, 'Q'), empty: [1, 2, 3], path: [4, 3, 2] },
        ];
        if (from === squareAt(homeRow, 4)) {
          for (const side of sides) {
            if (!state.castling.includes(side.flag)) continue;
            if (side.empty.some((c) => board[squareAt(homeRow, c)] !== null)) continue;
            if (side.path.some((c) => isAttacked(board, squareAt(homeRow, c), other(turn)))) continue;
            moves.push({ from, to: squareAt(homeRow, side.path[2]) });
          }
        }
        break;
      }
    }
  });
  return moves;
}

/** Executa o lance no tabuleiro (roque, en passant e promocao), sem checar o fim da partida. */
function makeMove(state: XadrezState, move: XadrezMove): XadrezState {
  const board = [...state.board];
  const piece = board[move.from]!;
  const captured = board[move.to];
  const homeRow = state.turn === 'w' ? 7 : 0;

  board[move.to] = move.promotion ? ofColor(state.turn, move.promotion) : piece;
  board[move.from] = null;

  if (kind(piece) === 'P' && move.to === state.enPassant) {
    board[move.to + (state.turn === 'w' ? 8 : -8)] = null;
  }
  if (kind(piece) === 'K' && Math.abs(move.to - move.from) === 2) {
    const kingside = move.to > move.from;
    const rookFrom = squareAt(homeRow, kingside ? 7 : 0);
    board[squareAt(homeRow, kingside ? 5 : 3)] = board[rookFrom];
    board[rookFrom] = null;
  }

  // Rei ou torre que saem (ou torre capturada no canto) perdem o direito ao roque
  const lost: Record<number, string> = { 60: 'KQ', 63: 'K', 56: 'Q', 4: 'kq', 7: 'k', 0: 'q' };
  const castling = [...state.castling].filter((flag) => !`${lost[move.from] ?? ''}${lost[move.to] ?? ''}`.includes(flag)).join('');

  const doublePush = kind(piece) === 'P' && Math.abs(move.to - move.from) === 16;
  return {
    ...state,
    board,
    turn: other(state.turn),
    castling,
    enPassant: doublePush ? (move.from + move.to) / 2 : null,
    halfmove: kind(piece) === 'P' || captured ? 0 : state.halfmove + 1,
    lastMove: move,
  };
}

/** Lances permitidos ao lado da vez (os que nao deixam o proprio rei em xeque). */
export function legalMoves(state: XadrezState): XadrezMove[] {
  if (state.status !== 'PLAYING') return [];
  return pseudoMoves(state).filter((move) => !inCheck(makeMove(state, move), state.turn));
}

/** Material insuficiente para dar mate: so reis, ou reis com um unico bispo ou cavalo. */
function insufficientMaterial(board: Array<XadrezPiece | null>): boolean {
  const others = board.flatMap((piece, square) => (piece && kind(piece) !== 'K' ? [{ piece, square }] : []));
  if (others.length === 0) return true;
  if (others.length === 1) return ['B', 'N'].includes(kind(others[0].piece));
  // Bispos dos dois lados em casas da mesma cor
  return (
    others.length === 2 &&
    others.every(({ piece }) => kind(piece) === 'B') &&
    colorOf(others[0].piece) !== colorOf(others[1].piece) &&
    (rowOf(others[0].square) + colOf(others[0].square)) % 2 === (rowOf(others[1].square) + colOf(others[1].square)) % 2
  );
}

function finish(state: XadrezState, result: XadrezResult): XadrezState {
  return { ...state, status: 'FINISHED', result };
}

export function applyAction(state: XadrezState, color: Color, action: XadrezAction): XadrezState {
  if (state.status !== 'PLAYING') throw new XadrezRuleError('A partida já terminou');
  const counted = { ...state, moveCount: state.moveCount + 1 };

  if (action.type === 'RESIGN' || action.type === 'TIMEOUT') {
    return finish(counted, { winner: other(color), reason: action.type });
  }
  if (color !== state.turn) throw new XadrezRuleError('Não é a sua vez');
  const legal = legalMoves(state).some(
    (move) => move.from === action.from && move.to === action.to && move.promotion === action.promotion,
  );
  if (!legal) throw new XadrezRuleError('Lance inválido');

  const moved = makeMove(counted, { from: action.from, to: action.to, promotion: action.promotion });
  const key = positionKey(moved);
  const next = { ...moved, positions: [...moved.positions, key] };

  if (legalMoves(next).length === 0) {
    return finish(next, inCheck(next, next.turn) ? { winner: color, reason: 'CHECKMATE' } : { winner: null, reason: 'STALEMATE' });
  }
  if (insufficientMaterial(next.board)) return finish(next, { winner: null, reason: 'MATERIAL' });
  if (next.halfmove >= 100) return finish(next, { winner: null, reason: 'FIFTY_MOVES' });
  if (next.positions.filter((position) => position === key).length >= 3) {
    return finish(next, { winner: null, reason: 'REPETITION' });
  }
  return next;
}

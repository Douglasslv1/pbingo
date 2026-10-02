import { createHash, createHmac, randomBytes } from 'crypto';
import { GameRuleError } from '../tables/tables.types';

/**
 * Ludo: cada jogador tem 4 pecas que saem da base com um 6, dao a volta no tabuleiro (52 casas)
 * e sobem pela reta final da sua cor ate o centro. Vence quem levar as 4 pecas ao centro.
 *
 * Progresso de uma peca (contado a partir da casa de saida da sua cor):
 *   -1 = base, 0..50 = volta no tabuleiro, 51..55 = reta final, 56 = centro (chegou).
 */
export const TRACK_LENGTH = 52;
export const PIECES = 4;
export const BASE = -1;
export const LAST_TRACK = 50;
export const FINISH = 56;
/** Casas de saida de cada cor ficam a 13 casas umas das outras. */
export const COLOR_OFFSET = 13;
/** Tres 6 seguidos perdem a vez. */
export const MAX_SIXES = 3;

/** Cores pela ordem do tabuleiro. Mano a mano: cores opostas (0 e 2). */
export type LudoColor = 0 | 1 | 2 | 3;

export type LudoAction = { type: 'ROLL' } | { type: 'MOVE'; piece: number };

export interface LudoMove {
  seat: number;
  piece: number;
  from: number;
  to: number;
  /** Pecas adversarias mandadas de volta a base. */
  captured: Array<{ seat: number; piece: number; from: number }>;
}

export interface LudoState {
  mode: 'CLASSICO';
  /** Cor de cada lugar da mesa. */
  colors: LudoColor[];
  /** Progresso das 4 pecas de cada lugar. */
  pieces: number[][];
  turn: number;
  phase: 'ROLL' | 'MOVE';
  /** Dado a ser usado no movimento (fase MOVE). */
  dice: number | null;
  /** 6 seguidos nesta vez. */
  sixes: number;
  /** Dados ja rolados na partida: o proximo sai da semente com este numero. */
  rolls: number;
  /** Semente secreta dos dados; o hash dela e publico desde o inicio e ela e revelada no fim. */
  seed: string;
  moveCount: number;
  lastRoll: { seat: number; value: number } | null;
  lastMove: LudoMove | null;
  status: 'PLAYING' | 'FINISHED';
  result: { winner: number } | null;
}

export class LudoRuleError extends GameRuleError {}

const SAFE_OFFSETS = [0, 8];

/** Casa do tabuleiro (0..51) de uma peca na volta, ou null fora dela. */
export function squareOf(color: LudoColor, progress: number): number | null {
  if (progress < 0 || progress > LAST_TRACK) return null;
  return (color * COLOR_OFFSET + progress) % TRACK_LENGTH;
}

/** Casas seguras: a saida de cada cor e a estrela 8 casas depois dela. */
export const isSafeSquare = (square: number) => SAFE_OFFSETS.includes(square % COLOR_OFFSET);

export const commitmentOf = (seed: string) => createHash('sha256').update(seed).digest('hex');

/**
 * Dado numero `index` da partida, derivado da semente: o resultado e fixado no inicio (o hash da
 * semente e mostrado aos jogadores) e qualquer um confere todos os dados quando ela e revelada.
 * Descarta os valores que deixariam o dado viciado (rejeicao), sem nunca usar Math.random.
 */
export function dieAt(seed: string, index: number): number {
  for (let attempt = 0; ; attempt++) {
    const value = createHmac('sha256', seed).update(`${index}:${attempt}`).digest().readUInt32BE(0);
    const limit = Math.floor(0x1_0000_0000 / 6) * 6;
    if (value < limit) return (value % 6) + 1;
  }
}

export function dealGame(seats: number, seed = randomBytes(32).toString('hex')): LudoState {
  if (seats !== 2 && seats !== 4) throw new LudoRuleError('O Ludo é jogado por 2 ou 4 jogadores');
  return {
    mode: 'CLASSICO',
    colors: seats === 2 ? [0, 2] : [0, 1, 2, 3],
    pieces: Array.from({ length: seats }, () => Array(PIECES).fill(BASE)),
    turn: 0,
    phase: 'ROLL',
    dice: null,
    sixes: 0,
    rolls: 0,
    seed,
    moveCount: 0,
    lastRoll: null,
    lastMove: null,
    status: 'PLAYING',
    result: null,
  };
}

function targetOf(progress: number, dice: number): number | null {
  if (progress === BASE) return dice === 6 ? 0 : null;
  if (progress === FINISH) return null;
  // Para chegar ao centro e preciso o numero exato
  return progress + dice <= FINISH ? progress + dice : null;
}

/** Pecas que o jogador da vez pode mover com o dado atual. */
export function legalPieces(state: LudoState): number[] {
  if (state.status !== 'PLAYING' || state.phase !== 'MOVE' || state.dice === null) return [];
  const dice = state.dice;
  return state.pieces[state.turn].flatMap((progress, piece) => (targetOf(progress, dice) === null ? [] : [piece]));
}

/** Pecas na mesma posicao sao equivalentes: so ha escolha se as posicoes de partida forem diferentes. */
export function hasSingleChoice(state: LudoState): boolean {
  const mine = state.pieces[state.turn];
  return new Set(legalPieces(state).map((piece) => mine[piece])).size === 1;
}

/** Pecas de outros lugares capturadas ao parar numa casa: so as sozinhas e fora das casas seguras. */
function capturesAt(state: LudoState, seat: number, square: number) {
  if (isSafeSquare(square)) return [];
  return state.pieces.flatMap((progresses, other) => {
    if (other === seat) return [];
    const here = progresses.flatMap((progress, piece) => (squareOf(state.colors[other], progress) === square ? [piece] : []));
    // Duas pecas da mesma cor juntas se protegem
    return here.length === 1 ? [{ seat: other, piece: here[0], from: progresses[here[0]] }] : [];
  });
}

const nextTurn = (state: LudoState): LudoState => ({
  ...state,
  turn: (state.turn + 1) % state.pieces.length,
  phase: 'ROLL',
  dice: null,
  sixes: 0,
});

function roll(state: LudoState, seat: number): LudoState {
  if (state.phase !== 'ROLL') throw new LudoRuleError('Escolha a peça para mover');
  const value = dieAt(state.seed, state.rolls);
  const sixes = value === 6 ? state.sixes + 1 : 0;
  const rolled: LudoState = { ...state, rolls: state.rolls + 1, lastRoll: { seat, value }, sixes, dice: value, phase: 'MOVE' };
  if (sixes === MAX_SIXES || legalPieces(rolled).length === 0) return nextTurn(rolled);
  return rolled;
}

function move(state: LudoState, seat: number, piece: number): LudoState {
  if (state.phase !== 'MOVE') throw new LudoRuleError('Jogue o dado primeiro');
  if (!legalPieces(state).includes(piece)) throw new LudoRuleError('Esta peça não pode andar com este dado');

  const from = state.pieces[seat][piece];
  const to = targetOf(from, state.dice!)!;
  const square = squareOf(state.colors[seat], to);
  const captured = square === null ? [] : capturesAt(state, seat, square);
  const pieces = state.pieces.map((progresses) => [...progresses]);
  pieces[seat][piece] = to;
  captured.forEach((capture) => (pieces[capture.seat][capture.piece] = BASE));

  const moved: LudoState = { ...state, pieces, lastMove: { seat, piece, from, to, captured } };
  if (pieces[seat].every((progress) => progress === FINISH)) {
    return { ...moved, status: 'FINISHED', result: { winner: seat }, phase: 'ROLL', dice: null };
  }
  // Tirar 6, capturar ou chegar ao centro da direito a jogar de novo
  if (state.dice === 6 || captured.length > 0 || to === FINISH) {
    return { ...moved, phase: 'ROLL', dice: null, sixes: captured.length > 0 || to === FINISH ? 0 : state.sixes };
  }
  return nextTurn(moved);
}

export function applyAction(state: LudoState, seat: number, action: LudoAction): LudoState {
  if (state.status !== 'PLAYING') throw new LudoRuleError('A partida já terminou');
  if (seat !== state.turn) throw new LudoRuleError('Não é a sua vez');
  const next = action.type === 'ROLL' ? roll(state, seat) : move(state, seat, action.piece);
  return { ...next, moveCount: state.moveCount + 1 };
}

/** Jogada do sistema (tempo esgotado ou jogador ausente): rola o dado ou move a peca mais adiantada. */
export function autoAction(state: LudoState): LudoAction {
  if (state.phase === 'ROLL') return { type: 'ROLL' };
  const mine = state.pieces[state.turn];
  const [best] = legalPieces(state).sort((a, b) => mine[b] - mine[a]);
  return { type: 'MOVE', piece: best };
}

export function viewFor(state: LudoState, seat: number) {
  const finished = state.status === 'FINISHED';
  return {
    mode: state.mode,
    colors: state.colors,
    pieces: state.pieces,
    turn: state.turn,
    phase: state.phase,
    dice: state.dice,
    rolls: state.rolls,
    lastRoll: state.lastRoll,
    lastMove: state.lastMove,
    moveCount: state.moveCount,
    legalPieces: !finished && state.turn === seat ? legalPieces(state) : [],
    commitment: commitmentOf(state.seed),
    // A semente so e revelada no fim, para ninguem prever os dados
    seed: finished ? state.seed : null,
    status: state.status,
    result: state.result,
  };
}

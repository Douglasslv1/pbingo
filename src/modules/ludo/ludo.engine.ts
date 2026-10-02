import { createHash, createHmac, randomBytes } from 'crypto';
import { GameRuleError } from '../tables/tables.types';
import { ABILITIES, AbilityId, abilityOptions, AbilityTarget, retreat, useAbility } from './ludo.abilities';
import { LUDO_CONFIG, LUDO_MODES, LudoMode } from './ludo.config';

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

export type LudoAction =
  | { type: 'ROLL' }
  | { type: 'MOVE'; piece: number }
  /** Sem peca que possa andar, mas com habilidade possivel, a vez so passa quando o jogador decide. */
  | { type: 'PASS' }
  | ({ type: 'ABILITY'; ability: AbilityId } & AbilityTarget);

/** Efeitos que ficam nas pecas: escudo (ate a proxima vez do dono) e fuga (ate ser usada). */
export interface LudoEffect {
  type: 'SHIELD' | 'ESCAPE';
  seat: number;
  piece: number;
}

export interface LudoMove {
  seat: number;
  piece: number;
  from: number;
  to: number;
  /** Pecas adversarias mandadas de volta a base. */
  captured: Array<{ seat: number; piece: number; from: number }>;
  /** Pecas que seriam capturadas, mas fugiram (voltaram algumas casas). */
  escaped: Array<{ seat: number; piece: number; from: number; to: number }>;
  /** Energia ganha com o movimento (Arena), inclusive por quem perdeu a peca. */
  energy: Array<{ seat: number; amount: number; reason: 'CAPTURE' | 'CAPTURED' | 'TILE' }>;
}

export interface LudoState {
  mode: LudoMode;
  /** Cor de cada lugar da mesa. */
  colors: LudoColor[];
  /** Progresso das 4 pecas de cada lugar. */
  pieces: number[][];
  /** Energia de cada lugar (so conta nas modalidades com energia). */
  energy: number[];
  turn: number;
  phase: 'ROLL' | 'MOVE';
  /** Dado a ser usado no movimento (fase MOVE). */
  dice: number | null;
  /** Casas a mais neste movimento (Impulso). */
  bonus: number;
  effects: LudoEffect[];
  /** Ja usou a habilidade desta vez (uma por vez, inclusive nas jogadas extras). */
  abilityUsed: boolean;
  /** Ultima habilidade usada e em que jogada (para a tela avisar so quando acabou de acontecer). */
  lastAbility: ({ seat: number; ability: AbilityId; move: number } & AbilityTarget) | null;
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

/** Casas de energia do tabuleiro (0..51), nas modalidades com energia. */
export const energySquares = (mode: LudoMode) =>
  LUDO_MODES[mode].energyEnabled
    ? Array.from({ length: TRACK_LENGTH / COLOR_OFFSET }).flatMap((_, quarter) =>
        LUDO_CONFIG.energyTileOffsets.map((offset) => quarter * COLOR_OFFSET + offset),
      )
    : [];

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

export function dealGame(seats: number, mode: LudoMode = 'CLASSICO', seed = randomBytes(32).toString('hex')): LudoState {
  if (seats !== 2 && seats !== 4) throw new LudoRuleError('O Ludo é jogado por 2 ou 4 jogadores');
  return {
    mode,
    colors: seats === 2 ? [0, 2] : [0, 1, 2, 3],
    pieces: Array.from({ length: seats }, () => Array(PIECES).fill(BASE)),
    energy: Array(seats).fill(0),
    turn: 0,
    phase: 'ROLL',
    dice: null,
    bonus: 0,
    effects: [],
    abilityUsed: false,
    lastAbility: null,
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

function targetOf(progress: number, dice: number, bonus = 0): number | null {
  // Para sair da base vale so o dado (o Impulso nao conta)
  if (progress === BASE) return dice === 6 ? 0 : null;
  if (progress === FINISH) return null;
  // Para chegar ao centro e preciso o numero exato
  return progress + dice + bonus <= FINISH ? progress + dice + bonus : null;
}

/** Pecas que o jogador da vez pode mover com o dado atual. */
export function legalPieces(state: LudoState): number[] {
  if (state.status !== 'PLAYING' || state.phase !== 'MOVE' || state.dice === null) return [];
  const dice = state.dice;
  return state.pieces[state.turn].flatMap((progress, piece) => (targetOf(progress, dice, state.bonus) === null ? [] : [piece]));
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

/** Passa a vez: o escudo de quem vai jogar acaba, e a habilidade da vez fica livre de novo. */
function nextTurn(state: LudoState): LudoState {
  const turn = (state.turn + 1) % state.pieces.length;
  return {
    ...state,
    turn,
    phase: 'ROLL',
    dice: null,
    bonus: 0,
    sixes: 0,
    abilityUsed: false,
    effects: state.effects.filter((effect) => !(effect.type === 'SHIELD' && effect.seat === turn)),
  };
}

/** O jogador da vez ainda pode usar alguma habilidade agora? */
const canUseAbility = (state: LudoState) =>
  LUDO_MODES[state.mode].abilitiesEnabled && Object.keys(abilityOptions(state, state.turn)).length > 0;

function roll(state: LudoState, seat: number): LudoState {
  if (state.phase !== 'ROLL') throw new LudoRuleError('Escolha a peça para mover');
  const value = dieAt(state.seed, state.rolls);
  const sixes = value === 6 ? state.sixes + 1 : 0;
  const rolled: LudoState = { ...state, rolls: state.rolls + 1, lastRoll: { seat, value }, sixes, dice: value, phase: 'MOVE' };
  if (sixes === MAX_SIXES) return nextTurn(rolled);
  // Sem peca que ande, a vez passa sozinha, a menos que uma habilidade (ex.: Segunda chance) possa mudar isso
  if (legalPieces(rolled).length === 0 && !canUseAbility(rolled)) return nextTurn(rolled);
  return rolled;
}

/** Segunda chance: rola de novo e o novo numero substitui o anterior (o 6 descartado nao conta). */
export function rerollDice(state: LudoState, seat: number): LudoState {
  return roll({ ...state, phase: 'ROLL', dice: null, sixes: state.dice === 6 ? state.sixes - 1 : state.sixes }, seat);
}

/**
 * Energia ganha ao parar numa casa (so nas modalidades com energia): por captura, por casa de energia
 * e, para quem perdeu a peca, um pouco de compensacao.
 */
function energyGains(state: LudoState, seat: number, square: number | null, captured: LudoMove['captured']): LudoMove['energy'] {
  if (!LUDO_MODES[state.mode].energyEnabled) return [];
  const gains: LudoMove['energy'] = [];
  if (captured.length > 0) gains.push({ seat, amount: captured.length * LUDO_CONFIG.captureEnergy, reason: 'CAPTURE' });
  captured.forEach((capture) => gains.push({ seat: capture.seat, amount: LUDO_CONFIG.capturedEnergy, reason: 'CAPTURED' }));
  if (square !== null && energySquares(state.mode).includes(square)) {
    gains.push({ seat, amount: LUDO_CONFIG.energyTileEnergy, reason: 'TILE' });
  }
  return gains;
}

function move(state: LudoState, seat: number, piece: number): LudoState {
  if (state.phase !== 'MOVE') throw new LudoRuleError('Jogue o dado primeiro');
  if (!legalPieces(state).includes(piece)) throw new LudoRuleError('Esta peça não pode andar com este dado');

  const from = state.pieces[seat][piece];
  const to = targetOf(from, state.dice!, state.bonus)!;
  const square = squareOf(state.colors[seat], to);
  const effectOn = (type: LudoEffect['type'], victim: { seat: number; piece: number }) =>
    state.effects.some((effect) => effect.type === type && effect.seat === victim.seat && effect.piece === victim.piece);
  // Peca com escudo nao e capturada; com fuga, volta algumas casas e gasta a fuga
  const victims = (square === null ? [] : capturesAt(state, seat, square)).filter((victim) => !effectOn('SHIELD', victim));
  const escaped = victims
    .filter((victim) => effectOn('ESCAPE', victim))
    .map((victim) => ({ ...victim, to: retreat(victim.from, LUDO_CONFIG.abilities.ESCAPE.squares) }));
  const captured = victims.filter((victim) => !effectOn('ESCAPE', victim));
  const pieces = state.pieces.map((progresses) => [...progresses]);
  pieces[seat][piece] = to;
  captured.forEach((capture) => (pieces[capture.seat][capture.piece] = BASE));
  escaped.forEach((escape) => (pieces[escape.seat][escape.piece] = escape.to));
  const effects = state.effects.filter(
    (effect) => ![...captured, ...escaped].some((victim) => victim.seat === effect.seat && victim.piece === effect.piece),
  );

  const gains = energyGains(state, seat, square, captured);
  const energy = gains.reduce(
    (total, gain) => total.map((value, i) => (i === gain.seat ? Math.min(value + gain.amount, LUDO_CONFIG.maxEnergy) : value)),
    state.energy,
  );

  const moved: LudoState = {
    ...state,
    pieces,
    energy,
    effects,
    bonus: 0,
    lastMove: { seat, piece, from, to, captured, escaped, energy: gains },
  };
  if (pieces[seat].every((progress) => progress === FINISH)) {
    return { ...moved, status: 'FINISHED', result: { winner: seat }, phase: 'ROLL', dice: null };
  }
  // Tirar 6, capturar ou chegar ao centro da direito a jogar de novo
  if (state.dice === 6 || captured.length > 0 || to === FINISH) {
    return { ...moved, phase: 'ROLL', dice: null, sixes: captured.length > 0 || to === FINISH ? 0 : state.sixes };
  }
  return nextTurn(moved);
}

function pass(state: LudoState): LudoState {
  if (state.phase !== 'MOVE') throw new LudoRuleError('Jogue o dado primeiro');
  if (legalPieces(state).length > 0) throw new LudoRuleError('Você tem peça para mover');
  return nextTurn(state);
}

function ability(state: LudoState, seat: number, action: Extract<LudoAction, { type: 'ABILITY' }>): LudoState {
  if (!LUDO_MODES[state.mode].abilitiesEnabled) throw new LudoRuleError('Esta modalidade não tem habilidades');
  return useAbility(state, seat, action.ability, { pieces: action.pieces, targetSeat: action.targetSeat });
}

export function applyAction(state: LudoState, seat: number, action: LudoAction): LudoState {
  if (state.status !== 'PLAYING') throw new LudoRuleError('A partida já terminou');
  if (seat !== state.turn) throw new LudoRuleError('Não é a sua vez');
  const next =
    action.type === 'ROLL'
      ? roll(state, seat)
      : action.type === 'MOVE'
        ? move(state, seat, action.piece)
        : action.type === 'PASS'
          ? pass(state)
          : ability(state, seat, action);
  return { ...next, moveCount: state.moveCount + 1 };
}

/** Jogada do sistema (tempo esgotado ou jogador ausente): rola, move a peca mais adiantada ou passa. Nunca usa habilidade. */
export function autoAction(state: LudoState): LudoAction {
  if (state.phase === 'ROLL') return { type: 'ROLL' };
  const mine = state.pieces[state.turn];
  const [best] = legalPieces(state).sort((a, b) => mine[b] - mine[a]);
  return best === undefined ? { type: 'PASS' } : { type: 'MOVE', piece: best };
}

/** O servidor joga sozinho quando nao ha decisao: uma so peca (ou nenhuma) para mover e nenhuma habilidade possivel. */
export function isForced(state: LudoState): boolean {
  if (state.status !== 'PLAYING' || state.phase !== 'MOVE' || canUseAbility(state)) return false;
  return legalPieces(state).length === 0 || hasSingleChoice(state);
}

export function viewFor(state: LudoState, seat: number) {
  const finished = state.status === 'FINISHED';
  return {
    mode: state.mode,
    colors: state.colors,
    pieces: state.pieces,
    energy: LUDO_MODES[state.mode].energyEnabled ? state.energy : null,
    maxEnergy: LUDO_CONFIG.maxEnergy,
    energyTiles: energySquares(state.mode),
    turn: state.turn,
    phase: state.phase,
    dice: state.dice,
    rolls: state.rolls,
    lastRoll: state.lastRoll,
    lastMove: state.lastMove,
    moveCount: state.moveCount,
    legalPieces: !finished && state.turn === seat ? legalPieces(state) : [],
    bonus: state.bonus,
    effects: state.effects,
    lastAbility: state.lastAbility,
    abilityUsed: state.abilityUsed,
    abilities: LUDO_MODES[state.mode].abilitiesEnabled
      ? Object.values(ABILITIES).map(({ id, name, description, target }) => ({
          id,
          name,
          description,
          target,
          cost: LUDO_CONFIG.abilities[id].cost,
        }))
      : [],
    // Alvos validos de cada habilidade que quem ve pode usar agora (so na sua vez)
    abilityOptions: LUDO_MODES[state.mode].abilitiesEnabled ? abilityOptions(state, seat) : {},
    commitment: commitmentOf(state.seed),
    // A semente so e revelada no fim, para ninguem prever os dados
    seed: finished ? state.seed : null,
    status: state.status,
    result: state.result,
  };
}

import { createHash, createHmac, randomBytes } from 'crypto';
import { GameRuleError } from '../tables/tables.types';
import { ABILITIES, AbilityId, abilityOptions, AbilityTarget, retreat, useAbility } from './ludo.abilities';
import { CHARACTER_IDS, CHARACTERS, CharacterId } from './ludo.characters';
import { LUDO_CONFIG, LUDO_MODES, LudoMode } from './ludo.config';
import { boardTiles, landOn, LudoSpecial } from './ludo.tiles';

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
  /** Arena: no inicio cada um escolhe o seu personagem, pela ordem dos lugares. */
  | { type: 'PICK'; character: CharacterId }
  | { type: 'ROLL' }
  /** Velocidade maxima: escolhe um dos dois dados rolados. */
  | { type: 'CHOOSE'; index: number }
  | { type: 'MOVE'; piece: number }
  /** Sem peca que possa andar, mas com habilidade possivel, a vez so passa quando o jogador decide. */
  | { type: 'PASS' }
  | ({ type: 'ABILITY'; ability: AbilityId } & AbilityTarget);

/** Efeitos que ficam nas pecas: escudo (ate a proxima vez do dono), fuga e fortificar (ate serem usados). */
export interface LudoEffect {
  type: 'SHIELD' | 'ESCAPE' | 'FORTIFY';
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
  /** Pecas fortificadas (Guardiao) que ignoraram a captura e ficaram onde estavam. */
  fortified: Array<{ seat: number; piece: number }>;
  /** Energia ganha com o movimento (Arena), inclusive por quem perdeu a peca. */
  energy: Array<{ seat: number; amount: number; reason: 'CAPTURE' | 'CAPTURED' | 'TILE' | 'ARENA' }>;
  /** Portal, bau ou evento da casa onde a peca parou (`to` e a casa onde ela parou, antes do portal). */
  special: LudoSpecial | null;
}

export interface LudoState {
  mode: LudoMode;
  /** Cor de cada lugar da mesa. */
  colors: LudoColor[];
  /** Progresso das 4 pecas de cada lugar. */
  pieces: number[][];
  /** Energia de cada lugar (so conta nas modalidades com energia). */
  energy: number[];
  /** Personagem de cada lugar (null ate escolher, e sempre nas modalidades sem personagens). */
  characters: Array<CharacterId | null>;
  /** Ja usou o poder do personagem (uma vez por partida). */
  powerUsed: boolean[];
  /** Carga da ultimate de cada lugar (so conta nas modalidades com ultimate). */
  ultimate: number[];
  /** Habilidade ganha no bau, guardada ate ser usada de graca (uma por lugar). */
  chest: Array<AbilityId | null>;
  /** Dados rolados pela Velocidade maxima, esperando a escolha (fase CHOOSE). */
  diceChoices: number[] | null;
  /** Capturas que ainda dao casas a mais nesta vez (Cacada). */
  hunt: number;
  turn: number;
  phase: 'PICK' | 'ROLL' | 'CHOOSE' | 'MOVE';
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
  /** Sorteios ja feitos na partida (dados, bau, eventos): o proximo sai da semente com este numero. */
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
 * Sorteio numero `index` da partida (0..sides-1), derivado da semente: o resultado e fixado no inicio
 * (o hash da semente e mostrado aos jogadores) e qualquer um confere todos quando ela e revelada.
 * Descarta os valores que deixariam o sorteio viciado (rejeicao), sem nunca usar Math.random.
 */
export function randomAt(seed: string, index: number, sides: number): number {
  for (let attempt = 0; ; attempt++) {
    const value = createHmac('sha256', seed).update(`${index}:${attempt}`).digest().readUInt32BE(0);
    const limit = Math.floor(0x1_0000_0000 / sides) * sides;
    if (value < limit) return value % sides;
  }
}

export const dieAt = (seed: string, index: number) => randomAt(seed, index, 6) + 1;

export function dealGame(seats: number, mode: LudoMode = 'CLASSICO', seed = randomBytes(32).toString('hex')): LudoState {
  if (seats !== 2 && seats !== 4) throw new LudoRuleError('O Ludo é jogado por 2 ou 4 jogadores');
  return {
    mode,
    colors: seats === 2 ? [0, 2] : [0, 1, 2, 3],
    pieces: Array.from({ length: seats }, () => Array(PIECES).fill(BASE)),
    energy: Array(seats).fill(0),
    characters: Array(seats).fill(null),
    powerUsed: Array(seats).fill(false),
    ultimate: Array(seats).fill(0),
    chest: Array(seats).fill(null),
    diceChoices: null,
    hunt: 0,
    turn: 0,
    phase: LUDO_MODES[mode].charactersEnabled ? 'PICK' : 'ROLL',
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
    hunt: 0,
    sixes: 0,
    abilityUsed: false,
    effects: state.effects.filter((effect) => !(effect.type === 'SHIELD' && effect.seat === turn)),
  };
}

/** O jogador da vez ainda pode usar alguma habilidade agora? */
const canUseAbility = (state: LudoState) =>
  LUDO_MODES[state.mode].abilitiesEnabled && Object.keys(abilityOptions(state, state.turn)).length > 0;

/** Dado que vai valer (rolado ou escolhido na Velocidade maxima). */
function rolled(state: LudoState, seat: number, value: number): LudoState {
  const sixes = value === 6 ? state.sixes + 1 : 0;
  const next: LudoState = { ...state, lastRoll: { seat, value }, sixes, dice: value, diceChoices: null, phase: 'MOVE' };
  if (sixes === MAX_SIXES) return nextTurn(next);
  // Sem peca que ande, a vez passa sozinha, a menos que uma habilidade (ex.: Segunda chance) possa mudar isso
  if (legalPieces(next).length === 0 && !canUseAbility(next)) return nextTurn(next);
  return next;
}

function roll(state: LudoState, seat: number): LudoState {
  if (state.phase !== 'ROLL') throw new LudoRuleError('Escolha a peça para mover');
  return rolled({ ...state, rolls: state.rolls + 1 }, seat, dieAt(state.seed, state.rolls));
}

/** Segunda chance: rola de novo e o novo numero substitui o anterior (o 6 descartado nao conta). */
export function rerollDice(state: LudoState, seat: number): LudoState {
  return roll({ ...state, phase: 'ROLL', dice: null, sixes: state.dice === 6 ? state.sixes - 1 : state.sixes }, seat);
}

/**
 * Energia ganha ao parar numa casa (so nas modalidades com energia): por captura (mais ainda numa casa de
 * arena), por casa de energia e, para quem perdeu a peca, um pouco de compensacao.
 */
function energyGains(state: LudoState, seat: number, square: number | null, captured: LudoMove['captured']): LudoMove['energy'] {
  if (!LUDO_MODES[state.mode].energyEnabled) return [];
  const gains: LudoMove['energy'] = [];
  const perCapture = LUDO_CONFIG.captureEnergy + (state.characters[seat] === 'HUNTER' ? LUDO_CONFIG.hunterCaptureEnergy : 0);
  if (captured.length > 0) gains.push({ seat, amount: captured.length * perCapture, reason: 'CAPTURE' });
  captured.forEach((capture) => gains.push({ seat: capture.seat, amount: LUDO_CONFIG.capturedEnergy, reason: 'CAPTURED' }));
  const tile = square === null ? undefined : boardTiles(state.mode)[square];
  if (tile === 'ARENA' && captured.length > 0) gains.push({ seat, amount: LUDO_CONFIG.arenaCaptureEnergy, reason: 'ARENA' });
  if (tile === 'ENERGY') gains.push({ seat, amount: LUDO_CONFIG.energyTileEnergy, reason: 'TILE' });
  return gains;
}

/** Carga da ultimate (modalidades com ultimate): quem moveu, quem capturou, quem foi capturado e quem chegou ao centro. */
function chargeUltimate(state: LudoState, seat: number, captured: LudoMove['captured'], to: number): number[] {
  if (!LUDO_MODES[state.mode].ultimatesEnabled) return state.ultimate;
  const charge = LUDO_CONFIG.ultimateCharge;
  const gain = (i: number) =>
    (i === seat ? charge.move + captured.length * charge.capture + (to === FINISH ? charge.finish : 0) : 0) +
    captured.filter((capture) => capture.seat === i).length * charge.captured;
  return state.ultimate.map((value, i) => Math.min(value + gain(i), LUDO_CONFIG.ultimateMax));
}

function move(state: LudoState, seat: number, piece: number): LudoState {
  if (state.phase !== 'MOVE') throw new LudoRuleError('Jogue o dado primeiro');
  if (!legalPieces(state).includes(piece)) throw new LudoRuleError('Esta peça não pode andar com este dado');

  const from = state.pieces[seat][piece];
  const to = targetOf(from, state.dice!, state.bonus)!;
  const square = squareOf(state.colors[seat], to);
  const effectOn = (type: LudoEffect['type'], victim: { seat: number; piece: number }) =>
    state.effects.some((effect) => effect.type === type && effect.seat === victim.seat && effect.piece === victim.piece);
  // Peca com escudo nao e capturada; fortificada fica onde esta e com fuga volta algumas casas (gastando o efeito)
  const threatened = (square === null ? [] : capturesAt(state, seat, square)).filter((victim) => !effectOn('SHIELD', victim));
  const fortified = threatened.filter((victim) => effectOn('FORTIFY', victim)).map(({ seat, piece }) => ({ seat, piece }));
  const victims = threatened.filter((victim) => !effectOn('FORTIFY', victim));
  const escaped = victims
    .filter((victim) => effectOn('ESCAPE', victim))
    .map((victim) => ({ ...victim, to: retreat(victim.from, LUDO_CONFIG.abilities.ESCAPE.squares) }));
  const captured = victims.filter((victim) => !effectOn('ESCAPE', victim));
  const pieces = state.pieces.map((progresses) => [...progresses]);
  pieces[seat][piece] = to;
  captured.forEach((capture) => (pieces[capture.seat][capture.piece] = BASE));
  escaped.forEach((escape) => (pieces[escape.seat][escape.piece] = escape.to));
  const on = (effect: LudoEffect, list: Array<{ seat: number; piece: number }>) =>
    list.some((victim) => victim.seat === effect.seat && victim.piece === effect.piece);
  const effects = state.effects.filter(
    (effect) => !on(effect, [...captured, ...escaped]) && !(effect.type === 'FORTIFY' && on(effect, fortified)),
  );

  const gains = energyGains(state, seat, square, captured);
  const energy = gains.reduce(
    (total, gain) => total.map((value, i) => (i === gain.seat ? Math.min(value + gain.amount, LUDO_CONFIG.maxEnergy) : value)),
    state.energy,
  );

  // Cacada: a captura da casas a mais no movimento da jogada extra
  const hunting = captured.length > 0 && state.hunt > 0;
  // Depois da captura e da energia vem a casa especial (portal, bau ou evento)
  const landed = landOn(
    {
      ...state,
      pieces,
      energy,
      ultimate: chargeUltimate(state, seat, captured, to),
      effects,
      bonus: hunting ? LUDO_CONFIG.abilities.HUNT.squares : 0,
      hunt: hunting ? state.hunt - 1 : state.hunt,
    },
    seat,
    piece,
    square,
  );
  const moved: LudoState = {
    ...landed.state,
    lastMove: { seat, piece, from, to, captured, escaped, fortified, energy: gains, special: landed.special },
  };
  if (moved.pieces[seat].every((progress) => progress === FINISH)) {
    return { ...moved, status: 'FINISHED', result: { winner: seat }, phase: 'ROLL', dice: null };
  }
  // Tirar 6, capturar ou chegar ao centro da direito a jogar de novo
  if (state.dice === 6 || captured.length > 0 || to === FINISH) {
    return { ...moved, phase: 'ROLL', dice: null, sixes: captured.length > 0 || to === FINISH ? 0 : state.sixes };
  }
  return nextTurn(moved);
}

/** Escolha do personagem; depois do ultimo lugar, o primeiro joga o dado. */
function pick(state: LudoState, seat: number, character: CharacterId): LudoState {
  const turn = (seat + 1) % state.pieces.length;
  return {
    ...state,
    characters: state.characters.map((current, i) => (i === seat ? character : current)),
    turn,
    phase: turn === 0 ? 'ROLL' : 'PICK',
  };
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
  if ((state.phase === 'PICK') !== (action.type === 'PICK')) {
    throw new LudoRuleError(state.phase === 'PICK' ? 'Escolha seu personagem primeiro' : 'A escolha de personagens já terminou');
  }
  if ((state.phase === 'CHOOSE') !== (action.type === 'CHOOSE')) {
    throw new LudoRuleError(state.phase === 'CHOOSE' ? 'Escolha um dos dois dados' : 'Não há dados para escolher');
  }
  const next =
    action.type === 'PICK'
      ? pick(state, seat, action.character)
      : action.type === 'CHOOSE'
        ? rolled(state, seat, state.diceChoices![action.index])
        : action.type === 'ROLL'
          ? roll(state, seat)
          : action.type === 'MOVE'
            ? move(state, seat, action.piece)
            : action.type === 'PASS'
              ? pass(state)
              : ability(state, seat, action);
  return { ...next, moveCount: state.moveCount + 1 };
}

/**
 * Jogada do sistema (tempo esgotado ou jogador ausente): escolhe um personagem pelo lugar, rola, move a peca
 * mais adiantada ou passa. Nunca usa habilidade.
 */
export function autoAction(state: LudoState): LudoAction {
  if (state.phase === 'PICK') return { type: 'PICK', character: CHARACTER_IDS[state.turn % CHARACTER_IDS.length] };
  if (state.phase === 'CHOOSE') return { type: 'CHOOSE', index: state.diceChoices![1] > state.diceChoices![0] ? 1 : 0 };
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
    tiles: boardTiles(state.mode),
    chest: state.chest,
    characters: state.characters,
    powerUsed: state.powerUsed,
    ultimate: LUDO_MODES[state.mode].ultimatesEnabled ? state.ultimate : null,
    ultimateMax: LUDO_CONFIG.ultimateMax,
    diceChoices: state.diceChoices,
    hunt: state.hunt,
    characterCatalog: LUDO_MODES[state.mode].charactersEnabled ? CHARACTER_IDS.map((id) => ({ id, ...CHARACTERS[id] })) : [],
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
      ? Object.values(ABILITIES).map(({ id, name, description, target, character, ultimate }) => ({
          id,
          name,
          description,
          target,
          character,
          ultimate,
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

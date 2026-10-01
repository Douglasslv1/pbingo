import { randomInt } from 'crypto';
import {
  DominoAction,
  DominoMode,
  DominoResult,
  DominoState,
  PlacedTile,
  Side,
  TeamMode,
  Tile,
  TILES_PER_HAND,
  seatsFor,
} from './domino.types';

/** Regra violada por uma jogada (vira erro 4xx na API). */
export class DominoRuleError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DominoRuleError';
  }
}

type RandomInt = (maxExclusive: number) => number;

export function createDeck(): Tile[] {
  const deck: Tile[] = [];
  for (let a = 0; a <= 6; a += 1) {
    for (let b = a; b <= 6; b += 1) {
      deck.push([a, b]);
    }
  }
  return deck;
}

/** Fisher-Yates com gerador criptografico (o mesmo do sorteio do bingo). */
export function shuffle(tiles: Tile[], random: RandomInt = randomInt): Tile[] {
  const shuffled = [...tiles];
  for (let i = shuffled.length - 1; i > 0; i -= 1) {
    const j = random(i + 1);
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

export const isDouble = (tile: Tile): boolean => tile[0] === tile[1];
export const pipsOf = (tile: Tile): number => tile[0] + tile[1];
export const sameTile = (a: Tile, b: Tile): boolean => a[0] === b[0] && a[1] === b[1];
const handPips = (hand: Tile[]): number => hand.reduce((sum, tile) => sum + pipsOf(tile), 0);

/** Peso da pedra de saida: qualquer carroca vence pedra comum; depois mais pontos e a maior face. */
const openingRank = (tile: Tile): number => (isDouble(tile) ? 1000 : 0) + pipsOf(tile) * 10 + tile[1];

/**
 * Quem sai: o lugar com a maior carroca distribuida, jogando essa carroca. No mano a mano pode
 * nao haver carroca nas maos; ai sai a pedra de mais pontos.
 */
function findOpening(hands: Tile[][]): { seat: number; tile: Tile } {
  return hands
    .flatMap((hand, seat) => hand.map((tile) => ({ seat, tile })))
    .reduce((best, candidate) => (openingRank(candidate.tile) > openingRank(best.tile) ? candidate : best));
}

/** Embaralha e distribui 6 pedras para cada lugar da mesa. */
export function dealGame(mode: DominoMode, teamMode: TeamMode, random: RandomInt = randomInt): DominoState {
  const deck = shuffle(createDeck(), random);
  const seats = seatsFor(teamMode);
  const hands = Array.from({ length: seats }, (_, seat) =>
    deck.slice(seat * TILES_PER_HAND, (seat + 1) * TILES_PER_HAND),
  );
  const opening = findOpening(hands);

  return {
    mode,
    teamMode,
    hands,
    boneyard: deck.slice(seats * TILES_PER_HAND),
    line: [],
    currentSeat: opening.seat,
    openingTile: opening.tile,
    consecutivePasses: 0,
    moveCount: 0,
    status: 'PLAYING',
    result: null,
  };
}

export function lineEnds(state: DominoState): { left: number; right: number } | null {
  if (state.line.length === 0) {
    return null;
  }
  return { left: state.line[0].left, right: state.line[state.line.length - 1].right };
}

/** Lados em que a pedra pode ser jogada agora (vazio se nao encaixa). */
export function playableSides(state: DominoState, tile: Tile): Side[] {
  if (state.openingTile) {
    return sameTile(tile, state.openingTile) ? ['LEFT'] : [];
  }
  const ends = lineEnds(state);
  if (!ends) {
    return ['LEFT'];
  }
  const sides: Side[] = [];
  if (tile.includes(ends.left)) sides.push('LEFT');
  if (tile.includes(ends.right)) sides.push('RIGHT');
  return sides;
}

/** Todas as jogadas permitidas ao lugar da vez. */
export function legalActions(state: DominoState, seat: number): DominoAction[] {
  if (state.status !== 'PLAYING' || seat !== state.currentSeat) {
    return [];
  }

  const plays: DominoAction[] = state.hands[seat].flatMap((tile) =>
    playableSides(state, tile).map((side) => ({ type: 'PLAY' as const, tile, side })),
  );
  if (plays.length > 0) {
    return plays;
  }
  if (state.mode === 'BURRINHO' && state.boneyard.length > 0) {
    return [{ type: 'DRAW' }];
  }
  return [{ type: 'PASS' }];
}

function placeTile(line: PlacedTile[], tile: Tile, side: Side): PlacedTile[] {
  if (line.length === 0) {
    return [{ tile, left: tile[0], right: tile[1] }];
  }
  if (side === 'LEFT') {
    const end = line[0].left;
    // A face igual a ponta encosta nela; a outra vira a nova ponta
    const placed = tile[1] === end ? { tile, left: tile[0], right: tile[1] } : { tile, left: tile[1], right: tile[0] };
    return [placed, ...line];
  }
  const end = line[line.length - 1].right;
  const placed = tile[0] === end ? { tile, left: tile[0], right: tile[1] } : { tile, left: tile[1], right: tile[0] };
  return [...line, placed];
}

const nextSeat = (state: DominoState, seat: number): number => (seat + 1) % state.hands.length;

/** Lugares vencedores: o proprio lugar, ou ele e o parceiro nas duplas. */
function winnersFor(state: DominoState, seat: number): number[] {
  return state.teamMode === 'PAIRS' ? [seat % 2, (seat % 2) + 2] : [seat];
}

/** Jogo trancado: vence a menor soma de pontos (da dupla, nas duplas). Empate divide. */
function blockedResult(state: DominoState): DominoResult {
  const pips = state.hands.map(handPips);

  if (state.teamMode === 'PAIRS') {
    const teamPips = [pips[0] + pips[2], pips[1] + pips[3]];
    const best = Math.min(...teamPips);
    const winnerSeats = [0, 1, 2, 3].filter((seat) => teamPips[seat % 2] === best);
    return { reason: 'BLOCKED', winnerSeats, pips };
  }

  const best = Math.min(...pips);
  return { reason: 'BLOCKED', winnerSeats: pips.flatMap((value, seat) => (value === best ? [seat] : [])), pips };
}

function sameAction(a: DominoAction, b: DominoAction): boolean {
  if (a.type !== b.type) return false;
  if (a.type === 'PLAY' && b.type === 'PLAY') return sameTile(a.tile, b.tile) && a.side === b.side;
  return true;
}

function normalizeTile(tile: Tile): Tile {
  return tile[0] <= tile[1] ? tile : [tile[1], tile[0]];
}

/** Aplica a jogada e devolve o novo estado (o estado recebido nao e alterado). */
export function applyAction(state: DominoState, seat: number, action: DominoAction): DominoState {
  if (state.status !== 'PLAYING') {
    throw new DominoRuleError('A partida já terminou');
  }
  if (seat !== state.currentSeat) {
    throw new DominoRuleError('Não é a sua vez');
  }

  const normalized: DominoAction = action.type === 'PLAY' ? { ...action, tile: normalizeTile(action.tile) } : action;
  if (!legalActions(state, seat).some((legal) => sameAction(legal, normalized))) {
    throw new DominoRuleError('Jogada inválida');
  }

  if (normalized.type === 'DRAW') {
    const [drawn, ...boneyard] = state.boneyard;
    const hands = state.hands.map((hand, index) => (index === seat ? [...hand, drawn] : hand));
    // Quem compra continua na vez ate conseguir jogar ou o monte acabar
    return { ...state, hands, boneyard, moveCount: state.moveCount + 1 };
  }

  if (normalized.type === 'PASS') {
    const consecutivePasses = state.consecutivePasses + 1;
    const next: DominoState = {
      ...state,
      currentSeat: nextSeat(state, seat),
      consecutivePasses,
      moveCount: state.moveCount + 1,
    };
    // Todos passaram em sequencia: ninguem mais consegue jogar
    return consecutivePasses >= state.hands.length ? { ...next, status: 'FINISHED', result: blockedResult(next) } : next;
  }

  const hands = state.hands.map((hand, index) =>
    index === seat ? hand.filter((tile) => !sameTile(tile, normalized.tile)) : hand,
  );
  const next: DominoState = {
    ...state,
    hands,
    line: placeTile(state.line, normalized.tile, normalized.side),
    openingTile: null,
    currentSeat: nextSeat(state, seat),
    consecutivePasses: 0,
    moveCount: state.moveCount + 1,
  };

  if (hands[seat].length === 0) {
    const pips = hands.map(handPips);
    return { ...next, status: 'FINISHED', result: { reason: 'DOMINO', winnerSeats: winnersFor(state, seat), pips } };
  }
  return next;
}

/**
 * Jogada feita pelo sistema (tempo esgotado ou jogador ausente): a pedra de maior valor que
 * encaixa; sem pedra, compra ou passa. Tambem usada para passar/comprar sem esperar o jogador.
 */
export function autoAction(state: DominoState, seat: number): DominoAction {
  const actions = legalActions(state, seat);
  if (actions.length === 0) {
    throw new DominoRuleError('Não é a vez deste lugar');
  }
  const plays = actions.filter((action): action is Extract<DominoAction, { type: 'PLAY' }> => action.type === 'PLAY');
  if (plays.length === 0) {
    return actions[0];
  }
  return plays.reduce((best, play) => (pipsOf(play.tile) > pipsOf(best.tile) ? play : best));
}

/** Verdadeiro quando o lugar da vez so pode passar ou comprar (o servidor faz sem esperar). */
export function hasOnlyForcedAction(state: DominoState): boolean {
  const actions = legalActions(state, state.currentSeat);
  return actions.length === 1 && actions[0].type !== 'PLAY';
}

/** O que cada jogador pode ver: a propria mao, a mesa e quantas pedras os outros tem. */
export function viewFor(state: DominoState, seat: number) {
  return {
    mode: state.mode,
    teamMode: state.teamMode,
    seat,
    hand: state.hands[seat],
    handSizes: state.hands.map((hand) => hand.length),
    boneyardSize: state.boneyard.length,
    line: state.line,
    ends: lineEnds(state),
    currentSeat: state.currentSeat,
    openingTile: state.openingTile,
    status: state.status,
    // No fim da partida as maos sao reveladas para conferencia
    result: state.result,
    revealedHands: state.status === 'FINISHED' ? state.hands : null,
    legalActions: legalActions(state, seat),
  };
}

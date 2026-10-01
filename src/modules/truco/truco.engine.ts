import { randomInt } from 'crypto';
import { GameRuleError } from '../tables/tables.types';
import { RandomInt, shuffle } from '../domino/domino.engine';
import {
  Card,
  CARDS_PER_HAND,
  HAND_VALUES,
  HandOutcome,
  HandState,
  POINTS_TO_WIN,
  Rank,
  RANKS,
  RoundResult,
  seatsFor,
  Suit,
  SUITS,
  TablePlay,
  Team,
  teamOf,
  TrucoAction,
  TrucoState,
  TrucoTeamMode,
} from './truco.types';

/** Regra violada por uma jogada (vira erro 4xx na API). */
export class TrucoRuleError extends GameRuleError {}

export function createDeck(): Card[] {
  return RANKS.flatMap((rank) => SUITS.map((suit) => `${rank}${suit}` as Card));
}

export const rankOf = (card: Card): Rank => card[0] as Rank;
export const suitOf = (card: Card): Suit => card[1] as Suit;

/** A manilha e o valor seguinte ao da vira; depois do 3 volta para o 4. */
export const manilhaFor = (vira: Card): Rank => RANKS[(RANKS.indexOf(rankOf(vira)) + 1) % RANKS.length];

/** Forca da carta: as manilhas ganham de tudo (desempatadas pelo naipe); as demais seguem a ordem dos valores. */
export function strength(card: Card, manilha: Rank): number {
  return rankOf(card) === manilha ? 100 + SUITS.indexOf(suitOf(card)) : RANKS.indexOf(rankOf(card));
}

const nextValue = (value: number): number => HAND_VALUES[HAND_VALUES.indexOf(value as (typeof HAND_VALUES)[number]) + 1];
const otherTeam = (team: Team): Team => (team === 0 ? 1 : 0);

/** Distribui 3 cartas para cada um e vira a carta que define a manilha. Quem esta depois do carteador comeca. */
function newHand(teamMode: TrucoTeamMode, score: [number, number], dealer: number, random: RandomInt): HandState {
  const seats = seatsFor(teamMode);
  const deck = shuffle(createDeck(), random);
  const vira = deck[seats * CARDS_PER_HAND];
  const first = (dealer + 1) % seats;
  const atEleven = ([0, 1] as Team[]).filter((team) => score[team] === POINTS_TO_WIN - 1);
  const elevenTeam = atEleven.length === 1 ? atEleven[0] : null;

  return {
    vira,
    manilha: manilhaFor(vira),
    hands: Array.from({ length: seats }, (_, seat) => deck.slice(seat * CARDS_PER_HAND, (seat + 1) * CARDS_PER_HAND)),
    rounds: [],
    table: [],
    currentSeat: first,
    value: 1,
    lastRaiseTeam: null,
    pendingRaise: null,
    // Decide o primeiro jogador do time com 11 na ordem da mao
    elevenDecision:
      elevenTeam === null ? null : { team: elevenTeam, seat: teamOf(first) === elevenTeam ? first : (first + 1) % seats },
    noRaises: atEleven.length > 0,
    blind: atEleven.length === 2,
  };
}

export function dealGame(teamMode: TrucoTeamMode, random: RandomInt = randomInt): TrucoState {
  const dealer = random(seatsFor(teamMode));
  const score: [number, number] = [0, 0];
  return {
    teamMode,
    score,
    dealer,
    handNumber: 1,
    hand: newHand(teamMode, score, dealer, random),
    lastHand: null,
    moveCount: 0,
    status: 'PLAYING',
    winner: null,
  };
}

/** Rodada completa: vence a carta mais forte; cartas iguais de times diferentes empatam. */
function resolveRound(table: TablePlay[], manilha: Rank): { result: RoundResult; leader: number } {
  const power = (play: TablePlay) => (play.covered ? -1 : strength(play.card, manilha));
  const best = Math.max(...table.map(power));
  const top = table.filter((play) => power(play) === best);
  const tied = best < 0 || new Set(top.map((play) => teamOf(play.seat))).size > 1;
  // No empate, quem abriu a rodada abre a proxima
  return tied
    ? { result: { plays: table, winner: null }, leader: table[0].seat }
    : { result: { plays: table, winner: teamOf(top[0].seat) }, leader: top[0].seat };
}

/**
 * Vencedor da mao pelas rodadas: quem ganhar 2. Empate na 1a: decide a 2a (ou a 3a). Empate na
 * 2a ou na 3a: vale quem ganhou a 1a. Tudo empatado: ninguem pontua (null). undefined = continua.
 */
export function handWinner(rounds: RoundResult[]): Team | null | undefined {
  const [first, second, third] = rounds.map((round) => round.winner);
  const wins = [0, 1].map((team) => rounds.filter((round) => round.winner === team).length);
  if (wins[0] >= 2) return 0;
  if (wins[1] >= 2) return 1;
  if (rounds.length === 2) {
    if (first === null && second !== null) return second;
    if (first !== null && second === null) return first;
  }
  if (rounds.length === 3) return third ?? first ?? null;
  return undefined;
}

/** Marca os pontos e comeca a proxima mao (o carteador passa para o lugar seguinte), ou encerra a partida. */
function endHand(
  state: TrucoState,
  winner: Team | null,
  points: number,
  reason: HandOutcome['reason'],
  rounds: RoundResult[],
  random: RandomInt,
): TrucoState {
  const score = state.score.map((value, team) =>
    team === winner ? Math.min(value + points, POINTS_TO_WIN) : value,
  ) as [number, number];
  const lastHand: HandOutcome = {
    winner,
    points: winner === null ? 0 : points,
    reason,
    rounds,
    hands: state.hand.hands,
    vira: state.hand.vira,
  };

  if (winner !== null && score[winner] >= POINTS_TO_WIN) {
    return { ...state, score, lastHand, status: 'FINISHED', winner, hand: { ...state.hand, pendingRaise: null } };
  }
  const dealer = (state.dealer + 1) % seatsFor(state.teamMode);
  return {
    ...state,
    score,
    lastHand,
    dealer,
    handNumber: state.handNumber + 1,
    hand: newHand(state.teamMode, score, dealer, random),
  };
}

/** Todas as acoes permitidas a um lugar agora. */
export function legalActions(state: TrucoState, seat: number): TrucoAction[] {
  const hand = state.hand;
  if (state.status !== 'PLAYING') return [];

  if (hand.elevenDecision) {
    return seat === hand.elevenDecision.seat ? [{ type: 'ACCEPT' }, { type: 'RUN' }] : [];
  }
  if (hand.pendingRaise) {
    if (seat !== hand.pendingRaise.responderSeat) return [];
    const answers: TrucoAction[] = [{ type: 'ACCEPT' }, { type: 'RUN' }];
    return hand.pendingRaise.value < POINTS_TO_WIN ? [...answers, { type: 'RAISE' }] : answers;
  }
  if (seat !== hand.currentSeat) return [];

  // Carta coberta so a partir da 2a rodada
  const canCover = hand.rounds.length > 0 && !hand.blind;
  const plays: TrucoAction[] = hand.hands[seat].flatMap((_, index) =>
    canCover
      ? [
          { type: 'PLAY' as const, index },
          { type: 'PLAY' as const, index, covered: true },
        ]
      : [{ type: 'PLAY' as const, index }],
  );
  const canRaise = !hand.noRaises && hand.value < POINTS_TO_WIN && hand.lastRaiseTeam !== teamOf(seat);
  return canRaise ? [...plays, { type: 'TRUCO' }] : plays;
}

const sameAction = (a: TrucoAction, b: TrucoAction): boolean =>
  a.type === b.type &&
  (a.type !== 'PLAY' || (b.type === 'PLAY' && a.index === b.index && Boolean(a.covered) === Boolean(b.covered)));

/** Aplica a acao e devolve o novo estado (o recebido nao e alterado). */
export function applyAction(
  state: TrucoState,
  seat: number,
  action: TrucoAction,
  random: RandomInt = randomInt,
): TrucoState {
  if (state.status !== 'PLAYING') {
    throw new TrucoRuleError('A partida já terminou');
  }
  if (!legalActions(state, seat).some((legal) => sameAction(legal, action))) {
    throw new TrucoRuleError('Jogada inválida');
  }

  const counted = { ...state, moveCount: state.moveCount + 1 };
  const hand = state.hand;
  const seats = seatsFor(state.teamMode);
  const withHand = (changes: Partial<HandState>): TrucoState => ({ ...counted, hand: { ...hand, ...changes } });

  if (hand.elevenDecision) {
    return action.type === 'ACCEPT'
      ? withHand({ elevenDecision: null, value: 3 })
      : endHand(counted, otherTeam(hand.elevenDecision.team), 1, 'ELEVEN_RUN', [], random);
  }

  const raise = hand.pendingRaise;
  if (action.type === 'TRUCO') {
    return withHand({ pendingRaise: { requesterSeat: seat, responderSeat: (seat + 1) % seats, value: nextValue(hand.value) } });
  }
  if (raise && action.type === 'ACCEPT') {
    return withHand({ value: raise.value, lastRaiseTeam: teamOf(raise.requesterSeat), pendingRaise: null });
  }
  if (raise && action.type === 'RUN') {
    // Quem corre entrega o valor que a mao tinha antes do pedido
    return endHand(counted, teamOf(raise.requesterSeat), hand.value, 'RUN', hand.rounds, random);
  }
  if (raise && action.type === 'RAISE') {
    return withHand({
      value: raise.value,
      lastRaiseTeam: teamOf(seat),
      pendingRaise: { requesterSeat: seat, responderSeat: (seat + 1) % seats, value: nextValue(raise.value) },
    });
  }

  const { index, covered = false } = action as Extract<TrucoAction, { type: 'PLAY' }>;
  const hands = hand.hands.map((cards, owner) => (owner === seat ? cards.filter((_, i) => i !== index) : cards));
  const table = [...hand.table, { seat, card: hand.hands[seat][index], covered }];
  if (table.length < seats) {
    return withHand({ hands, table, currentSeat: (seat + 1) % seats });
  }

  const { result, leader } = resolveRound(table, hand.manilha);
  const rounds = [...hand.rounds, result];
  const winner = handWinner(rounds);
  if (winner === undefined) {
    return withHand({ hands, table: [], rounds, currentSeat: leader });
  }
  return endHand({ ...counted, hand: { ...hand, hands } }, winner, hand.value, winner === null ? 'TIE' : 'ROUNDS', rounds, random);
}

/**
 * Acao feita pelo sistema (tempo esgotado ou jogador ausente): corre de pedidos e da mao de onze;
 * na vez de jogar, joga a carta mais fraca.
 */
export function autoAction(state: TrucoState, seat: number): TrucoAction {
  const actions = legalActions(state, seat);
  if (actions.length === 0) {
    throw new TrucoRuleError('Não é a vez deste lugar');
  }
  if (actions.some((action) => action.type === 'RUN')) {
    return { type: 'RUN' };
  }
  const hand = state.hand;
  const weakest = hand.hands[seat].reduce(
    (best, card, index) => (strength(card, hand.manilha) < strength(hand.hands[seat][best], hand.manilha) ? index : best),
    0,
  );
  return { type: 'PLAY', index: hand.blind ? 0 : weakest };
}

/** Quem deve agir agora: o jogador da vez, quem responde a um pedido ou quem decide a mao de onze. */
export function actingSeat(state: TrucoState): number {
  const hand = state.hand;
  return hand.elevenDecision?.seat ?? hand.pendingRaise?.responderSeat ?? hand.currentSeat;
}

const masked = (play: TablePlay) => ({ seat: play.seat, card: play.covered ? null : play.card, covered: play.covered });

/** O que cada jogador pode ver: a propria mao (nem ela na mao de ferro), a mesa e o placar. */
export function viewFor(state: TrucoState, seat: number) {
  const hand = state.hand;
  const myTeam = teamOf(seat);
  const showPartner = state.teamMode === 'PAIRS' && hand.elevenDecision?.team === myTeam;

  return {
    teamMode: state.teamMode,
    seat,
    myTeam,
    score: state.score,
    dealer: state.dealer,
    handNumber: state.handNumber,
    value: hand.value,
    vira: hand.vira,
    manilha: hand.manilha,
    hand: hand.blind ? hand.hands[seat].map(() => null) : hand.hands[seat],
    // Mao de onze nas duplas: o time que decide ve as cartas do parceiro
    partnerHand: showPartner ? hand.hands[(seat + 2) % 4] : null,
    handSizes: hand.hands.map((cards) => cards.length),
    table: hand.table.map(masked),
    rounds: hand.rounds.map((round) => ({ winner: round.winner, plays: round.plays.map(masked) })),
    currentSeat: hand.currentSeat,
    actingSeat: actingSeat(state),
    pendingRaise: hand.pendingRaise,
    elevenDecision: hand.elevenDecision,
    noRaises: hand.noRaises,
    blind: hand.blind,
    lastHand: state.lastHand && {
      winner: state.lastHand.winner,
      points: state.lastHand.points,
      reason: state.lastHand.reason,
      vira: state.lastHand.vira,
      rounds: state.lastHand.rounds.map((round) => ({ winner: round.winner, plays: round.plays.map(masked) })),
    },
    status: state.status,
    winner: state.winner,
    legalActions: legalActions(state, seat),
  };
}

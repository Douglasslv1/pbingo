/** Valores do mais fraco ao mais forte (sem 8, 9, 10 e coringas: baralho de 40 cartas). */
export const RANKS = ['4', '5', '6', '7', 'Q', 'J', 'K', 'A', '2', '3'] as const;
/** Naipes da manilha, do mais fraco ao mais forte: ouros (pica-fumo), espadas, copas e paus (zap). */
export const SUITS = ['O', 'E', 'C', 'P'] as const;

export type Rank = (typeof RANKS)[number];
export type Suit = (typeof SUITS)[number];
/** Carta como texto curto: valor + naipe (ex.: "3P" = 3 de paus). */
export type Card = `${Rank}${Suit}`;

/** DUEL: mano a mano (2 jogadores). PAIRS: duplas, parceiros em frente (lugares 0 e 2 contra 1 e 3). */
export type TrucoTeamMode = 'DUEL' | 'PAIRS';
/** Time de um lugar: lugares pares sao o time 0, impares o time 1. */
export type Team = 0 | 1;

/** Valor da mao: 1, truco (3), seis, nove e doze. */
export const HAND_VALUES = [1, 3, 6, 9, 12] as const;
export const POINTS_TO_WIN = 12;
export const CARDS_PER_HAND = 3;

/**
 * PLAY: joga a carta da posicao `index` da mao; `covered` joga virada para baixo (so a partir da
 * 2a rodada, e ela nao vale nada). TRUCO pede aumento; ACCEPT/RUN/RAISE respondem ao pedido
 * (RAISE aceita e ja pede o proximo valor). Na mao de onze, ACCEPT joga a mao e RUN corre.
 */
export type TrucoAction =
  | { type: 'PLAY'; index: number; covered?: boolean }
  | { type: 'TRUCO' }
  | { type: 'ACCEPT' }
  | { type: 'RUN' }
  | { type: 'RAISE' };

export interface TablePlay {
  seat: number;
  card: Card;
  /** Jogada virada para baixo: os outros jogadores nunca veem a carta. */
  covered: boolean;
}

export interface RoundResult {
  plays: TablePlay[];
  /** Time que venceu a rodada, ou null se empatou ("cangou"). */
  winner: Team | null;
}

export interface PendingRaise {
  requesterSeat: number;
  /** Quem responde: o proximo jogador depois de quem pediu. */
  responderSeat: number;
  value: number;
}

export interface HandState {
  vira: Card;
  manilha: Rank;
  hands: Card[][];
  rounds: RoundResult[];
  /** Cartas da rodada em andamento. */
  table: TablePlay[];
  currentSeat: number;
  value: number;
  /** Time que fez o ultimo aumento aceito: ele nao pode pedir o proximo. */
  lastRaiseTeam: Team | null;
  pendingRaise: PendingRaise | null;
  /** Mao de onze: o time com 11 pontos decide se joga (vale 3) ou corre (o adversario ganha 1). */
  elevenDecision: { team: Team; seat: number } | null;
  /** Mao de onze ou de ferro em jogo: ninguem pode pedir truco. */
  noRaises: boolean;
  /** Mao de ferro (os dois times com 11): ninguem ve as proprias cartas. */
  blind: boolean;
}

export interface HandOutcome {
  winner: Team | null;
  points: number;
  reason: 'ROUNDS' | 'RUN' | 'ELEVEN_RUN' | 'TIE';
  rounds: RoundResult[];
  hands: Card[][];
  vira: Card;
}

export interface TrucoState {
  teamMode: TrucoTeamMode;
  score: [number, number];
  dealer: number;
  handNumber: number;
  hand: HandState;
  /** Resultado da mao anterior, para a tela mostrar o que aconteceu. */
  lastHand: HandOutcome | null;
  moveCount: number;
  status: 'PLAYING' | 'FINISHED';
  winner: Team | null;
}

export const seatsFor = (teamMode: TrucoTeamMode): number => (teamMode === 'DUEL' ? 2 : 4);
export const teamOf = (seat: number): Team => (seat % 2) as Team;

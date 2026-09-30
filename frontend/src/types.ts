export type RoundStatus = 'WAITING' | 'IN_PROGRESS' | 'FINISHED' | 'CANCELLED';

export interface RoundView {
  id: string;
  status: RoundStatus;
  accumulatedPrize: string;
  drawnNumbers: number[];
  startedAt: string;
  waitingEndsAt: string | null;
  playersCount: number;
  minPlayers: number;
}

export interface GameConfig {
  creditPriceBrl: number;
  ticketPriceCredits: number;
  prizeContributionPerTicket: number;
  minPlayersPerRound: number;
  roundIntervalMinutes: number;
  minWithdrawalBrl: number;
  houseFeePercent: number;
  termsVersion: string;
  dominoEnabled: boolean;
  dominoTurnSeconds: number;
}

export interface JoinRoundResult {
  ticketId: string;
  roundId: string;
  numbersMatrix: (number | null)[][];
  accumulatedPrize: string;
}

export interface Ticket {
  id: string;
  roundId: string;
  userId: string;
  numbersMatrix: (number | null)[][];
  markedNumbers: number[];
  isWinner: boolean;
  createdAt: string;
}

export interface Wallet {
  credits: { balance: number };
  prizes: { balanceFiat: string };
}

export type UserRole = 'PLAYER' | 'ADMIN';

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  // Ausentes em sessoes salvas antes da criacao desses campos (atualizados via /auth/me)
  role?: UserRole;
  termsAccepted?: boolean;
}

export type PixKeyType = 'CPF' | 'EMAIL' | 'PHONE' | 'RANDOM';
export type WithdrawalStatus = 'PENDING' | 'PAID' | 'REJECTED';

export interface WithdrawalRequest {
  amount: number;
  cpf: string;
  pixKeyType: PixKeyType;
  pixKey: string;
}

export interface Withdrawal {
  id: string;
  amountFiat: string;
  cpf: string;
  pixKeyType: PixKeyType;
  pixKey: string;
  status: WithdrawalStatus;
  paymentReference: string | null;
  rejectionReason: string | null;
  reviewedAt: string | null;
  createdAt: string;
}

export interface WithdrawalForReview extends Withdrawal {
  user: { id: string; name: string; email: string };
}

export interface AuthResult {
  token: string;
  user: AuthUser;
}

export type TransactionType = 'PURCHASE_CREDITS' | 'SPEND_KEY' | 'PRIZE_PAYOUT' | 'WITHDRAWAL' | 'KEY_REFUND';

export interface TransactionItem {
  id: string;
  type: TransactionType;
  status: string;
  amountFiat: string;
  amountCredits: number;
  game: 'BINGO' | 'DOMINO' | null;
  createdAt: string;
}

export interface RoundHistoryItem {
  roundId: string;
  status: RoundStatus;
  startedAt: string;
  endedAt: string | null;
  accumulatedPrize: string;
  ticketsCount: number;
  winningTickets: number;
  prizeWon: string;
}

export interface Page<T> {
  items: T[];
  nextCursor: string | null;
}

export type DominoTile = [number, number];
export type DominoMode = 'SIX_TILES' | 'BURRINHO';
export type DominoTeamMode = 'INDIVIDUAL' | 'PAIRS';
export type DominoSide = 'LEFT' | 'RIGHT';

export type DominoAction =
  | { type: 'PLAY'; tile: DominoTile; side: DominoSide }
  | { type: 'DRAW' }
  | { type: 'PASS' };

export interface DominoPlacedTile {
  tile: DominoTile;
  left: number;
  right: number;
}

export interface DominoGameView {
  mode: DominoMode;
  teamMode: DominoTeamMode;
  seat: number;
  hand: DominoTile[];
  handSizes: number[];
  boneyardSize: number;
  line: DominoPlacedTile[];
  ends: { left: number; right: number } | null;
  currentSeat: number;
  openingTile: DominoTile | null;
  status: 'PLAYING' | 'FINISHED';
  result: { reason: 'DOMINO' | 'BLOCKED'; winnerSeats: number[]; pips: number[] } | null;
  revealedHands: DominoTile[][] | null;
  legalActions: DominoAction[];
}

export interface DominoTableView {
  id: string;
  mode: DominoMode;
  teamMode: DominoTeamMode;
  status: 'WAITING' | 'PLAYING' | 'FINISHED' | 'CANCELLED';
  prizePool: string;
  queueExpiresAt: string | null;
  mySeat: number | null;
  players: Array<{ seat: number; name: string; isMe: boolean; away: boolean; prizeAmount: string | null }>;
  turnDeadline: string | null;
  game: DominoGameView | null;
}

export interface DominoMatchItem {
  tableId: string;
  mode: DominoMode;
  teamMode: DominoTeamMode;
  status: 'FINISHED' | 'CANCELLED';
  playedAt: string;
  outcome: 'WON' | 'LOST' | 'CANCELLED';
  reason: 'DOMINO' | 'BLOCKED' | null;
  prizeWon: string;
}

export interface AdminDominoTableSummary {
  id: string;
  mode: DominoMode;
  teamMode: DominoTeamMode;
  status: DominoTableView['status'];
  prizePool: string;
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
  moveCount: number;
  players: Array<{ seat: number; name: string; email: string }>;
}

export interface AdminDominoTableDetail extends Omit<AdminDominoTableSummary, 'players' | 'moveCount'> {
  turnDeadline: string | null;
  players: Array<{
    seat: number;
    name: string;
    email: string;
    timeouts: number;
    away: boolean;
    prizeAmount: string | null;
    hand: DominoTile[] | null;
  }>;
  line: DominoPlacedTile[];
  boneyard: DominoTile[];
  currentSeat: number | null;
  result: DominoGameView['result'];
  moves: Array<{ moveNumber: number; seat: number; action: DominoAction; automatic: boolean; createdAt: string }>;
}

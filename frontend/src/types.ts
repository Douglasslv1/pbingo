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
  dominoFree: boolean;
  dominoTurnSeconds: number;
  queueTimeoutMinutes: number;
  trucoEnabled: boolean;
  trucoTurnSeconds: number;
  damasEnabled: boolean;
  xadrezEnabled: boolean;
  boardGamesFree: boolean;
  boardTurnSeconds: number;
  ludoEnabled: boolean;
  ludoFree: boolean;
  ludoTurnSeconds: number;
  stakes: number[];
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
  /** null: ainda nao escolheu (undefined em sessoes salvas antes do perfil). */
  nickname?: string | null;
  /** Ja informou a data de nascimento (o aceite de novos termos nao pede de novo). */
  hasBirthDate?: boolean;
}

export interface GameStats {
  matches: number;
  wins: number;
  prizes: string;
}

export type RankingGame = 'truco' | 'domino' | 'damas' | 'xadrez' | 'ludo' | 'bingo';

export interface RankingEntry {
  position: number;
  name: string;
  wins: number;
  matches: number;
  winRate: number;
  isMe: boolean;
}

export interface Ranking {
  period: 'month' | 'all';
  minMatches: number;
  maxDailyWinsVsSame: number | null;
  /** O jogo e gratuito hoje: o ranking e das partidas gratuitas. */
  free: boolean;
  entries: RankingEntry[];
  me: RankingEntry | null;
}

export interface Profile {
  name: string;
  email: string;
  nickname: string | null;
  displayName: string;
  memberSince: string;
  /** Quando o apelido pode ser trocado de novo (null: agora). */
  nicknameChangeAt: string | null;
  games: Record<'BINGO' | 'DOMINO' | 'TRUCO' | 'DAMAS' | 'XADREZ' | 'LUDO', GameStats>;
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
export type DominoTeamMode = 'INDIVIDUAL' | 'PAIRS' | 'DUEL';
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
  anchorIndex: number;
  ends: { left: number; right: number } | null;
  currentSeat: number;
  openingTile: DominoTile | null;
  status: 'PLAYING' | 'FINISHED';
  result: { reason: 'DOMINO' | 'BLOCKED'; winnerSeats: number[]; pips: number[] } | null;
  revealedHands: DominoTile[][] | null;
  legalActions: DominoAction[];
}

/** Jogos de mesa: o nome tambem e o caminho na API (/domino, /truco). */
export type TableGame = 'domino' | 'truco' | 'damas' | 'xadrez' | 'ludo';

/** Mesa de qualquer jogo; `game` e a visao do motor do jogo para este jogador. */
export interface GameTableView<G, M extends string = string, T extends string = string> {
  id: string;
  kind: 'DOMINO' | 'TRUCO' | 'DAMAS' | 'XADREZ' | 'LUDO';
  mode: M;
  teamMode: T;
  stake: number;
  status: 'WAITING' | 'PLAYING' | 'FINISHED' | 'CANCELLED';
  prizePool: string;
  queueExpiresAt: string | null;
  mySeat: number | null;
  players: Array<{ seat: number; name: string; isMe: boolean; away: boolean; prizeAmount: string | null }>;
  turnDeadline: string | null;
  game: G | null;
}

export type DominoTableView = GameTableView<DominoGameView, DominoMode, DominoTeamMode>;

interface MatchItem<M extends string, T extends string> {
  tableId: string;
  mode: M;
  teamMode: T;
  stake: number;
  status: 'FINISHED' | 'CANCELLED';
  playedAt: string;
  outcome: 'WON' | 'LOST' | 'CANCELLED';
  mySeat: number;
  prizeWon: string;
}

export interface DominoMatchItem extends MatchItem<DominoMode, DominoTeamMode> {
  reason: 'DOMINO' | 'BLOCKED' | null;
}

export interface TrucoMatchItem extends MatchItem<'PAULISTA', TrucoTeamMode> {
  score?: [number, number];
}

export type TrucoRank = '4' | '5' | '6' | '7' | 'Q' | 'J' | 'K' | 'A' | '2' | '3';
export type TrucoSuit = 'O' | 'E' | 'C' | 'P';
export type TrucoCard = `${TrucoRank}${TrucoSuit}`;
export type TrucoTeamMode = 'DUEL' | 'PAIRS';

export type TrucoAction =
  | { type: 'PLAY'; index: number; covered?: boolean }
  | { type: 'TRUCO' }
  | { type: 'ACCEPT' }
  | { type: 'RUN' }
  | { type: 'RAISE' };

export interface TrucoPlay {
  seat: number;
  /** null quando a carta foi jogada coberta. */
  card: TrucoCard | null;
  covered: boolean;
}

export interface TrucoRound {
  winner: 0 | 1 | null;
  plays: TrucoPlay[];
}

export interface TrucoGameView {
  teamMode: TrucoTeamMode;
  seat: number;
  myTeam: 0 | 1;
  score: [number, number];
  dealer: number;
  handNumber: number;
  value: number;
  vira: TrucoCard;
  manilha: TrucoRank;
  /** null em cada posicao na mao de ferro (ninguem ve as proprias cartas). */
  hand: Array<TrucoCard | null>;
  partnerHand: TrucoCard[] | null;
  handSizes: number[];
  table: TrucoPlay[];
  rounds: TrucoRound[];
  currentSeat: number;
  actingSeat: number;
  pendingRaise: { requesterSeat: number; responderSeat: number; value: number } | null;
  elevenDecision: { team: 0 | 1; seat: number } | null;
  noRaises: boolean;
  blind: boolean;
  lastHand: {
    winner: 0 | 1 | null;
    points: number;
    reason: 'ROUNDS' | 'RUN' | 'ELEVEN_RUN' | 'TIE';
    vira: TrucoCard;
    rounds: TrucoRound[];
  } | null;
  status: 'PLAYING' | 'FINISHED';
  winner: 0 | 1 | null;
  legalActions: TrucoAction[];
}

export type TrucoTableView = GameTableView<TrucoGameView, 'PAULISTA', TrucoTeamMode>;

/** Damas e xadrez: brancas ('w') e pretas ('b'); casa 0 = a8, 63 = h1. */
export type BoardColor = 'w' | 'b';

export interface BoardResult {
  winner: BoardColor | null;
  reason: string;
}

interface BoardViewBase {
  myColor: BoardColor;
  turn: BoardColor;
  moveCount: number;
  status: 'PLAYING' | 'FINISHED';
  result: BoardResult | null;
}

export type DamasPiece = 'w' | 'W' | 'b' | 'B';
export type DamasAction = { type: 'MOVE'; path: number[] } | { type: 'RESIGN' };

export interface DamasView extends BoardViewBase {
  board: Array<DamasPiece | null>;
  quietKingPlies: number;
  /** Lances permitidos (caminho de casas), so na vez de quem ve. */
  legalPaths: number[][];
  lastMove: number[] | null;
}

export interface XadrezMove {
  from: number;
  to: number;
  promotion?: 'Q' | 'R' | 'B' | 'N';
}
export type XadrezAction = ({ type: 'MOVE' } & XadrezMove) | { type: 'RESIGN' };

export interface XadrezView extends BoardViewBase {
  /** Pecas como na notacao FEN: maiusculas brancas, minusculas pretas. */
  board: Array<string | null>;
  inCheck: boolean;
  halfmove: number;
  legalMoves: XadrezMove[];
  lastMove: XadrezMove | null;
}

export type DamasTableView = GameTableView<DamasView, 'BRASILEIRA', 'DUEL'>;
export type XadrezTableView = GameTableView<XadrezView, 'CLASSICO', 'DUEL'>;

/** Ludo: progresso das pecas -1 = base, 0..50 = volta, 51..55 = reta final, 56 = centro. */
export type LudoAction = { type: 'ROLL' } | { type: 'MOVE'; piece: number };
export type LudoTeamMode = 'DUEL' | 'INDIVIDUAL';

export interface LudoGameView {
  mode: 'CLASSICO';
  colors: number[];
  pieces: number[][];
  turn: number;
  phase: 'ROLL' | 'MOVE';
  dice: number | null;
  rolls: number;
  lastRoll: { seat: number; value: number } | null;
  lastMove: { seat: number; piece: number; from: number; to: number; captured: Array<{ seat: number; piece: number; from: number }> } | null;
  moveCount: number;
  legalPieces: number[];
  /** Hash da semente dos dados, publico desde o inicio; a semente e revelada no fim. */
  commitment: string;
  seed: string | null;
  status: 'PLAYING' | 'FINISHED';
  result: { winner: number } | null;
}

export type LudoTableView = GameTableView<LudoGameView, 'CLASSICO', LudoTeamMode>;

export interface LudoMatchItem extends MatchItem<'CLASSICO', LudoTeamMode> {
  result?: { winner: number } | null;
  pieces?: number[][];
}

export interface BoardMatchItem extends MatchItem<string, 'DUEL'> {
  result?: BoardResult;
  whiteSeat?: number;
}

export interface AdminTableSummary {
  id: string;
  mode: string;
  teamMode: string;
  stake: number;
  status: DominoTableView['status'];
  prizePool: string;
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
  moveCount: number;
  players: Array<{ seat: number; name: string; email: string }>;
}

/** Detalhe de uma mesa no admin: `H` e a mao de cada jogador e `A` a acao gravada de cada jogada. */
interface AdminTableDetail<H, A> extends Omit<AdminTableSummary, 'players' | 'moveCount'> {
  turnDeadline: string | null;
  players: Array<{
    seat: number;
    name: string;
    email: string;
    timeouts: number;
    away: boolean;
    prizeAmount: string | null;
    hand: H | null;
  }>;
  moves: Array<{ moveNumber: number; seat: number; action: A; automatic: boolean; createdAt: string }>;
}

export interface AdminDominoTableDetail extends AdminTableDetail<DominoTile[], DominoAction> {
  mode: DominoMode;
  teamMode: DominoTeamMode;
  result: DominoGameView['result'];
}

export interface AdminTrucoTableDetail
  extends AdminTableDetail<TrucoCard[], TrucoAction & { hand: number; vira: TrucoCard; card?: TrucoCard; value?: number }> {
  teamMode: TrucoTeamMode;
  score?: [number, number];
  handNumber?: number;
  vira?: TrucoCard;
}

export interface AdminStats {
  users: {
    total: number;
    newToday: number;
    newWeek: number;
    everLoggedIn: number;
    activeToday: number;
    activeWeek: number;
    onlineUsers: number;
    onlineConnections: number;
  };
  money: {
    pixIn: string;
    prizesPaid: string;
    withdrawals: Partial<Record<WithdrawalStatus, { count: number; amount: string }>>;
  };
  bingoRounds: Partial<Record<RoundStatus, number>>;
  tables: Record<'DOMINO' | 'TRUCO' | 'DAMAS' | 'XADREZ' | 'LUDO', Partial<Record<DominoTableView['status'], number>>>;
  recentUsers: Array<{ id: string; name: string; email: string; createdAt: string }>;
}

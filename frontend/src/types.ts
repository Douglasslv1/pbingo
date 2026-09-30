export type RoundStatus = 'WAITING' | 'IN_PROGRESS' | 'FINISHED';

export interface RoundView {
  id: string;
  status: RoundStatus;
  accumulatedPrize: string;
  drawnNumbers: number[];
  startedAt: string;
  waitingEndsAt: string | null;
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
  // Ausente em sessoes salvas antes da criacao dos papeis
  role?: UserRole;
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

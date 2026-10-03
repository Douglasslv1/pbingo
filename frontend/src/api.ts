import type {
  AuthResult,
  AdminTableSummary,
  AdminStats,
  AuthUser,
  GameConfig,
  JoinRoundResult,
  Page,
  Profile,
  Ranking,
  RankingGame,
  RoundHistoryItem,
  RoundView,
  TableGame,
  Ticket,
  TransactionItem,
  Wallet,
  Withdrawal,
  WithdrawalForReview,
  WithdrawalRequest,
  WithdrawalStatus,
} from './types';
import { socketRequest } from './socket';

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

async function request<T>(path: string, options: RequestInit = {}, token?: string): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });

  const isJson = res.headers.get('content-type')?.includes('application/json');
  const body = isJson ? await res.json() : null;

  if (!res.ok) {
    throw new ApiError(body?.error ?? 'Erro inesperado no servidor', res.status);
  }

  return body as T;
}

export const api = {
  register: (data: { name: string; email: string; password: string; birthDate: string; acceptTerms: boolean }) =>
    request<AuthResult>('/auth/register', { method: 'POST', body: JSON.stringify(data) }),

  login: (data: { email: string; password: string }) =>
    request<AuthResult>('/auth/login', { method: 'POST', body: JSON.stringify(data) }),

  me: (token: string) => request<AuthUser>('/auth/me', {}, token),

  acceptTerms: (token: string, birthDate?: string) =>
    request<AuthUser>('/auth/accept-terms', { method: 'POST', body: JSON.stringify({ birthDate, acceptTerms: true }) }, token),

  forgotPassword: (email: string) =>
    request<{ message: string }>('/auth/forgot-password', { method: 'POST', body: JSON.stringify({ email }) }),

  resetPassword: (token: string, password: string) =>
    request<{ message: string }>('/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({ token, password }),
    }),

  getRanking: (game: RankingGame, period: 'month' | 'all', token?: string) =>
    request<Ranking>(`/ranking/${game}?period=${period}`, {}, token),

  getProfile: (token: string) => request<Profile>('/profile/me', {}, token),

  setNickname: (token: string, nickname: string) =>
    request<Profile>('/profile/me/nickname', { method: 'PUT', body: JSON.stringify({ nickname }) }, token),

  getWallet: (token: string) => request<Wallet>('/wallet/me', {}, token),

  createPixCharge: (token: string, creditsAmount: number) =>
    request<{ transactionId: string; status: string; qrCode: string | null; qrCodeBase64: string | null }>(
      '/payments/pix/create',
      { method: 'POST', body: JSON.stringify({ creditsAmount }) },
      token,
    ),

  getPixChargeStatus: (token: string, transactionId: string) =>
    request<{ status: string; amountCredits: number; amountFiat: string }>(
      `/payments/pix/${transactionId}/status`,
      {},
      token,
    ),

  getConfig: () => request<GameConfig>('/config'),

  getCurrentRound: () => request<RoundView | null>('/rounds/current'),

  joinRound: (token: string) => request<JoinRoundResult>('/rounds/join', { method: 'POST' }, token),

  leaveRound: (token: string) =>
    request<{ refundedCredits: number; accumulatedPrize: string; playersCount: number }>(
      '/rounds/leave',
      { method: 'POST' },
      token,
    ),

  getMyTickets: (token: string, roundId: string) =>
    request<Ticket[]>(`/rounds/${roundId}/my-tickets`, {}, token),

  withdraw: (token: string, data: WithdrawalRequest) =>
    request<{ withdrawalId: string; transactionId: string; remainingBalance: string }>(
      '/withdrawals',
      { method: 'POST', body: JSON.stringify(data) },
      token,
    ),

  getMyTransactions: (token: string, cursor?: string) =>
    request<Page<TransactionItem>>(`/wallet/transactions${cursor ? `?cursor=${cursor}` : ''}`, {}, token),

  getMyRoundHistory: (token: string, cursor?: string) =>
    request<Page<RoundHistoryItem>>(`/rounds/history/me${cursor ? `?cursor=${cursor}` : ''}`, {}, token),

  // Mesas (domino e truco): o mesmo formato de rotas, com o jogo no caminho
  getMyTable: <V>(game: TableGame, token: string) => request<V | null>(`/${game}/tables/me`, {}, token),

  joinTable: <V>(game: TableGame, token: string, choice: Record<string, unknown>) =>
    request<V>(`/${game}/queue`, { method: 'POST', body: JSON.stringify(choice) }, token),

  leaveTable: (game: TableGame, token: string) =>
    request<{ tableId: string; refundedCredits: number }>(`/${game}/queue/leave`, { method: 'POST' }, token),

  /** Jogada pelo WebSocket quando conectado (mais rapido); senao, por HTTP. */
  playTable: async <V>(game: TableGame, token: string, tableId: string, action: unknown): Promise<V> => {
    const sent = socketRequest(token, `${game}:move`, { id: tableId, action });
    if (!sent) return request<V>(`/${game}/tables/${tableId}/moves`, { method: 'POST', body: JSON.stringify(action) }, token);
    const reply = await sent;
    if (reply.error) throw new ApiError(reply.error, reply.status ?? 500);
    return reply.data as V;
  },

  comeBackToTable: <V>(game: TableGame, token: string, tableId: string) =>
    request<V>(`/${game}/tables/${tableId}/back`, { method: 'POST' }, token),

  getMyMatches: <M>(game: TableGame, token: string, cursor?: string) =>
    request<Page<M>>(`/${game}/history/me${cursor ? `?cursor=${cursor}` : ''}`, {}, token),

  adminStats: (token: string) => request<AdminStats>('/admin/stats', {}, token),

  adminTables: (game: TableGame, token: string, status?: string) =>
    request<AdminTableSummary[]>(`/admin/${game}/tables${status ? `?status=${status}` : ''}`, {}, token),

  adminTable: <D>(game: TableGame, token: string, tableId: string) =>
    request<D>(`/admin/${game}/tables/${tableId}`, {}, token),

  getMyWithdrawals: (token: string) => request<Withdrawal[]>('/withdrawals/me', {}, token),

  getWithdrawalsForReview: (token: string, status?: WithdrawalStatus) =>
    request<WithdrawalForReview[]>(`/admin/withdrawals${status ? `?status=${status}` : ''}`, {}, token),

  markWithdrawalPaid: (token: string, withdrawalId: string, paymentReference: string) =>
    request<Withdrawal>(
      `/admin/withdrawals/${withdrawalId}/pay`,
      { method: 'POST', body: JSON.stringify({ paymentReference }) },
      token,
    ),

  rejectWithdrawal: (token: string, withdrawalId: string, reason: string) =>
    request<Withdrawal>(
      `/admin/withdrawals/${withdrawalId}/reject`,
      { method: 'POST', body: JSON.stringify({ reason }) },
      token,
    ),
};

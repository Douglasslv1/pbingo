import type {
  AuthResult,
  AdminDominoTableDetail,
  AdminDominoTableSummary,
  AuthUser,
  DominoAction,
  DominoMatchItem,
  DominoMode,
  DominoTableView,
  DominoTeamMode,
  GameConfig,
  JoinRoundResult,
  Page,
  RoundHistoryItem,
  RoundView,
  Ticket,
  TransactionItem,
  Wallet,
  Withdrawal,
  WithdrawalForReview,
  WithdrawalRequest,
  WithdrawalStatus,
} from './types';

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

  acceptTerms: (token: string, birthDate: string) =>
    request<AuthUser>('/auth/accept-terms', { method: 'POST', body: JSON.stringify({ birthDate, acceptTerms: true }) }, token),

  forgotPassword: (email: string) =>
    request<{ message: string }>('/auth/forgot-password', { method: 'POST', body: JSON.stringify({ email }) }),

  resetPassword: (token: string, password: string) =>
    request<{ message: string }>('/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({ token, password }),
    }),

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

  getMyDominoTable: (token: string) => request<DominoTableView | null>('/domino/tables/me', {}, token),

  joinDominoQueue: (token: string, mode: DominoMode, teamMode: DominoTeamMode) =>
    request<DominoTableView>('/domino/queue', { method: 'POST', body: JSON.stringify({ mode, teamMode }) }, token),

  leaveDominoQueue: (token: string) =>
    request<{ tableId: string; refundedCredits: number }>('/domino/queue/leave', { method: 'POST' }, token),

  playDomino: (token: string, tableId: string, action: DominoAction) =>
    request<DominoTableView>(`/domino/tables/${tableId}/moves`, { method: 'POST', body: JSON.stringify(action) }, token),

  dominoComeBack: (token: string, tableId: string) =>
    request<DominoTableView>(`/domino/tables/${tableId}/back`, { method: 'POST' }, token),

  getMyDominoMatches: (token: string, cursor?: string) =>
    request<Page<DominoMatchItem>>(`/domino/history/me${cursor ? `?cursor=${cursor}` : ''}`, {}, token),

  adminDominoTables: (token: string, status?: string) =>
    request<AdminDominoTableSummary[]>(`/admin/domino/tables${status ? `?status=${status}` : ''}`, {}, token),

  adminDominoTable: (token: string, tableId: string) =>
    request<AdminDominoTableDetail>(`/admin/domino/tables/${tableId}`, {}, token),

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

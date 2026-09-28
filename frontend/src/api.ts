import type { AuthResult, JoinRoundResult, RoundView, Ticket, Wallet } from './types';

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
  register: (data: { name: string; email: string; password: string }) =>
    request<AuthResult>('/auth/register', { method: 'POST', body: JSON.stringify(data) }),

  login: (data: { email: string; password: string }) =>
    request<AuthResult>('/auth/login', { method: 'POST', body: JSON.stringify(data) }),

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

  getCurrentRound: () => request<RoundView | null>('/rounds/current'),

  joinRound: (token: string) => request<JoinRoundResult>('/rounds/join', { method: 'POST' }, token),

  getMyTickets: (token: string, roundId: string) =>
    request<Ticket[]>(`/rounds/${roundId}/my-tickets`, {}, token),

  withdraw: (token: string, amount: number) =>
    request<{ transactionId: string; remainingBalance: string }>(
      '/withdrawals',
      { method: 'POST', body: JSON.stringify({ amount }) },
      token,
    ),
};

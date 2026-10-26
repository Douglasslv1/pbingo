import { request } from './api';

export interface Discount { minQuantity: number; percent: number }
export interface RaffleInput {
  title: string; description: string; image: string; prize: string; priceCents: number;
  discounts: Discount[]; digits: number; lottery: string; contest: string; prizePosition: number;
  closesAt: string; drawAt: string;
}
export interface Raffle extends RaffleInput {
  id: string; status: 'DRAFT' | 'OPEN' | 'CLOSED' | 'DRAWN'; rule: string; salesOpen: boolean;
  totalTickets: number; sold: number; reserved: number; available: number;
  revenueCents?: number; pendingCents?: number; buyers?: number;
  drawnNumber: number | null; resultNumber: string | null; resultSource: string | null;
  winner: { name: string; email?: string; userId?: string; purchaseId?: string } | null;
}
export interface RafflePurchase {
  id: string; raffleId: string; transactionId: string; quantity: number; unitPriceCents: number;
  discountPercent: number; totalCents: number; status: 'PENDING' | 'PAID' | 'FAILED'; createdAt: string;
  tickets: { number: number }[];
  raffle: Pick<Raffle, 'title' | 'digits' | 'drawAt' | 'status' | 'drawnNumber'>;
}
export interface BuyerPurchase extends Omit<RafflePurchase, 'raffle'> { user: { id: string; name: string; email: string } }
export interface BuyersPage { items: BuyerPurchase[]; total: number; page: number }
export interface RaffleCharge { transactionId: string; status: string; qrCode?: string | null; qrCodeBase64?: string | null }
const post = (body?: unknown) => ({ method: 'POST', ...(body ? { body: JSON.stringify(body) } : {}) });
export const raffleApi = {
  list: () => request<Raffle[]>('/raffles'),
  mine: (token: string) => request<RafflePurchase[]>('/raffles/me/purchases', {}, token),
  buy: (token: string, id: string, quantity: number) => request<RaffleCharge>(`/raffles/${id}/purchases`, post({ quantity }), token),
  refresh: (token: string, id: string, admin = false) => request<RaffleCharge>(`${admin ? '/admin' : ''}/raffles/purchases/${id}/refresh`, post(), token),
  adminList: (token: string) => request<Raffle[]>('/admin/raffles', {}, token),
  save: (token: string, input: RaffleInput, id?: string) => request<Raffle>(`/admin/raffles${id ? `/${id}` : ''}`, { method: id ? 'PUT' : 'POST', body: JSON.stringify(input) }, token),
  action: (token: string, id: string, action: 'publish' | 'close') => request(`/admin/raffles/${id}/${action}`, post(), token),
  buyers: (token: string, id: string, page = 1) => request<BuyersPage>(`/admin/raffles/${id}/purchases?page=${page}`, {}, token),
  draw: (token: string, id: string, resultNumber: string, resultSource: string) => request(`/admin/raffles/${id}/draw`, post({ resultNumber, resultSource }), token),
};
export const raffleStatus = { DRAFT: 'Rascunho', OPEN: 'Publicada', CLOSED: 'Vendas encerradas', DRAWN: 'Apurada' };
export const purchaseStatus = { PENDING: 'Aguardando Pix', PAID: 'Pago', FAILED: 'Não concluído' };
export const ticketNumber = (number: number, digits: number) => String(number).padStart(digits, '0');
export function raffleQuote(raffle: RaffleInput, quantity: number) {
  const percent = raffle.discounts.filter((d) => quantity >= d.minQuantity).reduce((best, d) => Math.max(best, d.percent), 0);
  return { percent, totalCents: Math.round(raffle.priceCents * quantity * (100 - percent) / 100) };
}

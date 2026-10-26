import { request } from './api';
import type { PartnerWallet } from './types';
export interface PartnerSettings { rateBps: number; holdDays: number; durationDays: number | null; active: boolean; blocked: boolean; reason: string }
export interface Partner extends PartnerSettings { id: string; code: string; userId: string; user: { name: string; email: string }; wallet: PartnerWallet | null; _count: { referrals: number } }
export interface CommissionRow { id: string; purchaseId: string; rateBps: number; amountCents: number; reversedCents: number; createdAt: string; availableAt: string; releasedAt: string | null;
  purchase: { quantity: number; totalCents: number; refundedCents: number; user: { nickname: string | null; playerNumber: number }; raffle: { id: string; title: string } } }
export interface PartnerReport {
  wallet: PartnerWallet; totals: { tickets: number; salesCents: number; refundedCents: number; commissionCents: number; reversedCents: number; buyers: number; referrals: number };
  referred: { nickname: string | null; playerNumber: number; createdAt: string }[];
  rows: CommissionRow[]; total: number; page: number;
  audits: { id: string; action: string; adminId: string; createdAt: string; details: Record<string, unknown> }[];
}
export const partnerApi = {
  mine: (token: string, query = '') => request<PartnerReport>(`/partners/me?${query}`, {}, token),
  list: (token: string) => request<Partner[]>('/admin/partners', {}, token),
  report: (token: string, id: string, query = '') => request<PartnerReport>(`/admin/partners/${id}/dashboard?${query}`, {}, token),
  save: (token: string, data: PartnerSettings & { userEmail?: string; code?: string }, id?: string) => request(`/admin/partners${id ? `/${id}` : ''}`, { method: id ? 'PUT' : 'POST', body: JSON.stringify(data) }, token),
  refund: (token: string, purchaseId: string, totalRefundedCents: number, reference: string) => request(`/admin/partners/purchases/${purchaseId}/refund`, { method: 'POST', body: JSON.stringify({ totalRefundedCents, reference, confirmed: true }) }, token),
};
export const partnerLink = (code: string) => `${window.location.origin}/?ref=${encodeURIComponent(code)}`;

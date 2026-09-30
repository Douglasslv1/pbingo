import type { PixKeyType, WithdrawalStatus } from './types';

export const PIX_KEY_LABELS: Record<PixKeyType, string> = {
  CPF: 'CPF',
  EMAIL: 'E-mail',
  PHONE: 'Celular',
  RANDOM: 'Chave aleatoria',
};

export const WITHDRAWAL_STATUS_LABELS: Record<WithdrawalStatus, string> = {
  PENDING: 'Em analise',
  PAID: 'Pago',
  REJECTED: 'Recusado',
};

export function formatCpf(cpf: string): string {
  return cpf.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, '$1.$2.$3-$4');
}

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
}

import { FormEvent, useState } from 'react';
import { api, ApiError } from '../api';
import { formatBrl } from '../format';
import { useAuth } from '../hooks/useAuth';
import type { WithdrawalForReview } from '../types';
import { formatCpf, formatDateTime, PIX_KEY_LABELS, WITHDRAWAL_STATUS_LABELS } from '../withdrawalFormat';

interface Props {
  withdrawal: WithdrawalForReview;
  onReviewed: () => Promise<void>;
}

export default function AdminWithdrawalItem({ withdrawal, onReviewed }: Props) {
  const { auth } = useAuth();
  const [paymentReference, setPaymentReference] = useState('');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const amount = formatBrl(withdrawal.amountFiat);

  async function runReview(action: () => Promise<unknown>) {
    setBusy(true);
    setError(null);
    try {
      await action();
      await onReviewed();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro ao revisar o saque');
    } finally {
      setBusy(false);
    }
  }

  function handlePay(event: FormEvent) {
    event.preventDefault();
    if (!auth) return;
    runReview(() => api.markWithdrawalPaid(auth.token, withdrawal.id, paymentReference));
  }

  function handleReject(event: FormEvent) {
    event.preventDefault();
    if (!auth) return;
    if (!window.confirm(`Recusar o saque de ${amount} e devolver o valor ao jogador?`)) return;
    runReview(() => api.rejectWithdrawal(auth.token, withdrawal.id, reason));
  }

  async function copyPixKey() {
    await navigator.clipboard.writeText(withdrawal.pixKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <li className="card admin-withdrawal">
      <div className="withdrawal-row">
        <strong>{amount}</strong>
        <span className={`status-chip status-${withdrawal.status.toLowerCase()}`}>
          {WITHDRAWAL_STATUS_LABELS[withdrawal.status]}
        </span>
      </div>

      <dl className="admin-details">
        <dt>Jogador</dt>
        <dd>
          {withdrawal.user.name} ({withdrawal.user.email})
        </dd>
        <dt>CPF</dt>
        <dd>{formatCpf(withdrawal.cpf)}</dd>
        <dt>Chave Pix ({PIX_KEY_LABELS[withdrawal.pixKeyType]})</dt>
        <dd>
          <code>{withdrawal.pixKey}</code>{' '}
          <button type="button" className="link" onClick={copyPixKey}>
            {copied ? 'Copiada!' : 'Copiar'}
          </button>
        </dd>
        <dt>Solicitado em</dt>
        <dd>{formatDateTime(withdrawal.createdAt)}</dd>
        {withdrawal.paymentReference && (
          <>
            <dt>ID do Pix enviado</dt>
            <dd>
              <code>{withdrawal.paymentReference}</code>
            </dd>
          </>
        )}
        {withdrawal.rejectionReason && (
          <>
            <dt>Motivo da recusa</dt>
            <dd>{withdrawal.rejectionReason}</dd>
          </>
        )}
        {withdrawal.reviewedAt && (
          <>
            <dt>Revisado em</dt>
            <dd>{formatDateTime(withdrawal.reviewedAt)}</dd>
          </>
        )}
      </dl>

      {withdrawal.status === 'PENDING' && (
        <div className="admin-actions">
          <form onSubmit={handlePay}>
            <label>
              ID da transação Pix (E2E) enviada
              <input
                value={paymentReference}
                onChange={(e) => setPaymentReference(e.target.value)}
                placeholder="E00000000202609301200..."
                required
              />
            </label>
            <button type="submit" disabled={busy}>
              Marcar como pago
            </button>
          </form>
          <form onSubmit={handleReject}>
            <label>
              Motivo da recusa
              <input value={reason} onChange={(e) => setReason(e.target.value)} minLength={3} required />
            </label>
            <button type="submit" className="danger" disabled={busy}>
              Recusar e estornar
            </button>
          </form>
        </div>
      )}

      {error && <p className="error">{error}</p>}
    </li>
  );
}

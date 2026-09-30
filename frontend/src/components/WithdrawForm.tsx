import { FormEvent, useState } from 'react';
import { api, ApiError } from '../api';
import { formatBrl } from '../format';
import { useAuth } from '../hooks/useAuth';
import type { PixKeyType } from '../types';
import { PIX_KEY_LABELS } from '../withdrawalFormat';

interface Props {
  onWithdrawn: () => Promise<void>;
}

const PIX_KEY_PLACEHOLDERS: Record<PixKeyType, string> = {
  CPF: '000.000.000-00',
  EMAIL: 'você@exemplo.com',
  PHONE: '(11) 98765-4321',
  RANDOM: '123e4567-e89b-12d3-a456-426614174000',
};

export default function WithdrawForm({ onWithdrawn }: Props) {
  const { auth } = useAuth();
  const [amount, setAmount] = useState(0);
  const [cpf, setCpf] = useState('');
  const [pixKeyType, setPixKeyType] = useState<PixKeyType>('CPF');
  const [pixKey, setPixKey] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!auth) return;
    setBusy(true);
    setError(null);
    setInfo(null);
    try {
      const res = await api.withdraw(auth.token, { amount, cpf, pixKeyType, pixKey });
      await onWithdrawn();
      setAmount(0);
      setInfo(`Saque solicitado! Ele será pago via Pix após análise. Saldo restante: ${formatBrl(res.remainingBalance)}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro ao solicitar saque');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="withdraw-form">
      <label>
        Sacar prêmio (R$)
        <input type="number" min={0} step="0.01" value={amount} onChange={(e) => setAmount(Number(e.target.value))} />
      </label>
      <label>
        Seu CPF
        <input
          value={cpf}
          onChange={(e) => setCpf(e.target.value)}
          placeholder="000.000.000-00"
          inputMode="numeric"
          autoComplete="off"
          required
        />
      </label>
      <label>
        Tipo de chave Pix
        <select value={pixKeyType} onChange={(e) => setPixKeyType(e.target.value as PixKeyType)}>
          {(Object.keys(PIX_KEY_LABELS) as PixKeyType[]).map((type) => (
            <option key={type} value={type}>
              {PIX_KEY_LABELS[type]}
            </option>
          ))}
        </select>
      </label>
      <label>
        Chave Pix
        <input
          value={pixKey}
          onChange={(e) => setPixKey(e.target.value)}
          placeholder={PIX_KEY_PLACEHOLDERS[pixKeyType]}
          autoComplete="off"
          required
        />
      </label>
      <p className="hint">A chave Pix precisa estar no mesmo CPF informado.</p>
      {error && <p className="error">{error}</p>}
      {info && <p className="info">{info}</p>}
      <button type="submit" disabled={busy}>
        {busy ? 'Enviando...' : 'Sacar'}
      </button>
    </form>
  );
}

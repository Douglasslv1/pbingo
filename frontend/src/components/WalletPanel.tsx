import { FormEvent, useState } from 'react';
import { api, ApiError } from '../api';
import { useAuth } from '../hooks/useAuth';
import type { Wallet } from '../types';
import PixPurchase from './PixPurchase';

interface Props {
  wallet: Wallet | null;
  onWalletChange: () => Promise<void>;
}

export default function WalletPanel({ wallet, onWalletChange }: Props) {
  const { auth } = useAuth();
  const [withdrawAmount, setWithdrawAmount] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  async function handleWithdraw(event: FormEvent) {
    event.preventDefault();
    if (!auth) return;
    setBusy(true);
    setError(null);
    setInfo(null);
    try {
      const res = await api.withdraw(auth.token, withdrawAmount);
      await onWalletChange();
      setInfo(`Saque solicitado. Saldo restante: R$ ${res.remainingBalance}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro ao solicitar saque');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card">
      <h2>Carteira</h2>
      <div className="wallet-balances">
        <div>
          <span className="label">Chaves (nao sacavel)</span>
          <strong>{wallet?.credits.balance ?? '-'}</strong>
        </div>
        <div>
          <span className="label">Premios (sacavel)</span>
          <strong>R$ {wallet?.prizes.balanceFiat ?? '-'}</strong>
        </div>
      </div>

      {error && <p className="error">{error}</p>}
      {info && <p className="info">{info}</p>}

      <div className="wallet-forms">
        <PixPurchase onWalletChange={onWalletChange} />

        <form onSubmit={handleWithdraw}>
          <label>
            Sacar premio (R$)
            <input
              type="number"
              min={0}
              step="0.01"
              value={withdrawAmount}
              onChange={(e) => setWithdrawAmount(Number(e.target.value))}
            />
          </label>
          <button type="submit" disabled={busy}>
            Sacar
          </button>
        </form>
      </div>
    </div>
  );
}

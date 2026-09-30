import { useCallback, useEffect, useState } from 'react';
import { api } from '../api';
import { formatBrl } from '../format';
import { useAuth } from '../hooks/useAuth';
import type { Wallet, Withdrawal } from '../types';
import PixPurchase from './PixPurchase';
import WithdrawForm from './WithdrawForm';
import WithdrawalHistory from './WithdrawalHistory';

interface Props {
  wallet: Wallet | null;
  onWalletChange: () => Promise<void>;
}

export default function WalletPanel({ wallet, onWalletChange }: Props) {
  const { auth } = useAuth();
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([]);

  const refreshWithdrawals = useCallback(async () => {
    if (!auth) return;
    setWithdrawals(await api.getMyWithdrawals(auth.token));
  }, [auth]);

  useEffect(() => {
    refreshWithdrawals().catch(() => setWithdrawals([]));
  }, [refreshWithdrawals]);

  async function handleWithdrawn() {
    await Promise.all([onWalletChange(), refreshWithdrawals()]);
  }

  return (
    <div className="card">
      <h2>Carteira</h2>
      <div className="wallet-balances">
        <div>
          <span className="label">Chaves (não sacável)</span>
          <strong>{wallet?.credits.balance ?? '-'}</strong>
        </div>
        <div>
          <span className="label">Prêmios (sacável)</span>
          <strong>{wallet ? formatBrl(wallet.prizes.balanceFiat) : '-'}</strong>
        </div>
      </div>

      <div className="wallet-forms">
        <PixPurchase onWalletChange={onWalletChange} />
        <WithdrawForm onWithdrawn={handleWithdrawn} />
      </div>

      <WithdrawalHistory withdrawals={withdrawals} />
    </div>
  );
}

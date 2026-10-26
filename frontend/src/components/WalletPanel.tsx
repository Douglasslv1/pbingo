import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
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

      {wallet?.commissions && <div className="card"><h3>Comissões de indicações</h3>
        <p>Disponível: <strong>{formatBrl(wallet.commissions.availableCents / 100)}</strong> · Pendente: {formatBrl(wallet.commissions.pendingCents / 100)}</p>
        <p>Reservado em saques: {formatBrl(wallet.commissions.reservedCents / 100)} · Estornos a compensar: {formatBrl(wallet.commissions.debtCents / 100)}</p>
        {wallet.commissions.blocked && <p className="error">Saques de comissões bloqueados para revisão.</p>}
        <Link to="/parceiro">Ver painel de parceiro e link de indicação</Link>
      </div>}
      <div className="wallet-forms">
        <PixPurchase onWalletChange={onWalletChange} />
        <WithdrawForm onWithdrawn={handleWithdrawn} hasCommissions={!!wallet?.commissions} />
      </div>

      <WithdrawalHistory withdrawals={withdrawals} />
    </div>
  );
}

import { useCallback, useEffect, useState } from 'react';
import { api, ApiError } from '../api';
import AdminWithdrawalItem from '../components/AdminWithdrawalItem';
import AppHeader from '../components/AppHeader';
import AuthForm from '../components/AuthForm';
import { useAuth } from '../hooks/useAuth';
import type { WithdrawalForReview, WithdrawalStatus } from '../types';
import { WITHDRAWAL_STATUS_LABELS } from '../withdrawalFormat';

const STATUS_TABS: WithdrawalStatus[] = ['PENDING', 'PAID', 'REJECTED'];

export default function AdminPage() {
  const { auth } = useAuth();
  const [status, setStatus] = useState<WithdrawalStatus>('PENDING');
  const [withdrawals, setWithdrawals] = useState<WithdrawalForReview[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadWithdrawals = useCallback(async () => {
    if (!auth) return;
    setLoading(true);
    setError(null);
    try {
      setWithdrawals(await api.getWithdrawalsForReview(auth.token, status));
    } catch (err) {
      setWithdrawals([]);
      setError(err instanceof ApiError ? err.message : 'Erro ao carregar saques');
    } finally {
      setLoading(false);
    }
  }, [auth, status]);

  useEffect(() => {
    loadWithdrawals();
  }, [loadWithdrawals]);

  return (
    <div className="app-shell">
      <AppHeader />
      <main>
        {!auth ? (
          <AuthForm />
        ) : (
          <>
            <h1>Saques</h1>
            <div className="tabs admin-tabs">
              {STATUS_TABS.map((tab) => (
                <button
                  key={tab}
                  type="button"
                  className={tab === status ? 'tab active' : 'tab'}
                  onClick={() => setStatus(tab)}
                >
                  {WITHDRAWAL_STATUS_LABELS[tab]}
                </button>
              ))}
              <button type="button" className="link" onClick={loadWithdrawals} disabled={loading}>
                Atualizar
              </button>
            </div>

            {error && <p className="error">{error}</p>}
            {!error && !loading && withdrawals.length === 0 && <p className="label">Nenhum saque nesta lista.</p>}

            <ul className="admin-withdrawals">
              {withdrawals.map((withdrawal) => (
                <AdminWithdrawalItem key={withdrawal.id} withdrawal={withdrawal} onReviewed={loadWithdrawals} />
              ))}
            </ul>
          </>
        )}
      </main>
    </div>
  );
}

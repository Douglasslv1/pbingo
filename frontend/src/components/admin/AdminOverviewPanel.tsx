import { useCallback, useEffect, useState } from 'react';
import { api, ApiError } from '../../api';
import { formatBrl } from '../../format';
import { useAuth } from '../../hooks/useAuth';
import type { AdminStats } from '../../types';
import { formatDateTime } from '../../withdrawalFormat';

const REFRESH_MS = 30_000;

type StatItem = [label: string, value: string | number, hint?: string];

function StatGroup({ title, items }: { title: string; items: StatItem[] }) {
  return (
    <section className="card">
      <h3>{title}</h3>
      <div className="round-stats">
        {items.map(([label, value, hint]) => (
          <div key={label}>
            <span className="label">{label}</span>
            <strong>{value}</strong>
            {hint && <span className="label">{hint}</span>}
          </div>
        ))}
      </div>
    </section>
  );
}

export default function AdminOverviewPanel() {
  const { auth } = useAuth();
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    if (!auth) return;
    api
      .adminStats(auth.token)
      .then((data) => {
        setStats(data);
        setError(null);
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Erro ao carregar os números'));
  }, [auth]);

  useEffect(() => {
    load();
    const timer = setInterval(load, REFRESH_MS);
    return () => clearInterval(timer);
  }, [load]);

  if (error) return <p className="error">{error}</p>;
  if (!stats) return <p className="label">Carregando...</p>;

  const { users, money, bingoRounds, dominoTables } = stats;
  const pending = money.withdrawals.PENDING;

  return (
    <div className="admin-overview">
      <StatGroup
        title="Agora"
        items={[
          ['Jogadores online', users.onlineUsers],
          ['Conexões abertas', users.onlineConnections, 'inclui visitantes'],
          ['Mesas de dominó em jogo', dominoTables.PLAYING ?? 0, `${dominoTables.WAITING ?? 0} aguardando`],
        ]}
      />
      <StatGroup
        title="Usuários"
        items={[
          ['Cadastrados', users.total, `+${users.newToday} hoje · +${users.newWeek} em 7 dias`],
          ['Já fizeram login', users.everLoggedIn, 'últimos 6 meses'],
          ['Ativos', users.activeToday, `hoje · ${users.activeWeek} em 7 dias`],
        ]}
      />
      <StatGroup
        title="Dinheiro"
        items={[
          ['Entradas via Pix', formatBrl(money.pixIn)],
          ['Prêmios pagos', formatBrl(money.prizesPaid)],
          ['Saques pagos', formatBrl(money.withdrawals.PAID?.amount ?? 0), `${money.withdrawals.PAID?.count ?? 0} saques`],
          ['Saques pendentes', pending?.count ?? 0, formatBrl(pending?.amount ?? 0)],
        ]}
      />
      <StatGroup
        title="Jogos"
        items={[
          ['Rodadas encerradas', bingoRounds.FINISHED ?? 0, `${bingoRounds.CANCELLED ?? 0} canceladas`],
          ['Partidas de dominó', dominoTables.FINISHED ?? 0, `${dominoTables.CANCELLED ?? 0} canceladas`],
        ]}
      />

      <section className="card">
        <h3>Últimos cadastros</h3>
        <ul className="admin-domino-moves">
          {stats.recentUsers.map((user) => (
            <li key={user.id}>
              <span>
                <strong>{user.name}</strong> <span className="label">{user.email}</span>
              </span>
              <span className="label">{formatDateTime(user.createdAt)}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

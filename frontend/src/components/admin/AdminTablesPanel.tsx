import { ComponentType, useCallback, useEffect, useState } from 'react';
import { api, ApiError } from '../../api';
import { formatBrl } from '../../format';
import { useAuth } from '../../hooks/useAuth';
import type { AdminTableSummary, DominoTableView, TableGame } from '../../types';
import { formatDateTime } from '../../withdrawalFormat';

type TableStatus = DominoTableView['status'];

const STATUS_TABS: Array<{ value: TableStatus; label: string }> = [
  { value: 'PLAYING', label: 'Em jogo' },
  { value: 'WAITING', label: 'Aguardando' },
  { value: 'FINISHED', label: 'Encerradas' },
  { value: 'CANCELLED', label: 'Canceladas' },
];

export interface TableDetailProps {
  tableId: string;
  onClose: () => void;
}

/** Carrega o detalhe de uma mesa para o admin. */
export function useAdminTable<D>(game: TableGame, tableId: string) {
  const { auth } = useAuth();
  const [detail, setDetail] = useState<D | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!auth) return;
    api
      .adminTable<D>(game, auth.token, tableId)
      .then(setDetail)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Erro ao carregar a mesa'));
  }, [auth, game, tableId]);

  return { detail, error };
}

interface Props {
  game: TableGame;
  /** Modalidade e formato da mesa, ja traduzidos. */
  describe: (table: AdminTableSummary) => string;
  Detail: ComponentType<TableDetailProps>;
}

/** Mesas de um jogo por situacao; abrir uma mostra maos e jogadas para resolver reclamacoes. */
export default function AdminTablesPanel({ game, describe, Detail }: Props) {
  const { auth } = useAuth();
  const [status, setStatus] = useState<TableStatus>('PLAYING');
  const [tables, setTables] = useState<AdminTableSummary[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!auth) return;
    setLoading(true);
    setError(null);
    try {
      setTables(await api.adminTables(game, auth.token, status));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro ao carregar as mesas');
    } finally {
      setLoading(false);
    }
  }, [auth, game, status]);

  useEffect(() => {
    load();
  }, [load]);

  if (selected) {
    return <Detail tableId={selected} onClose={() => setSelected(null)} />;
  }

  return (
    <>
      <div className="tabs admin-tabs">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab.value}
            type="button"
            className={tab.value === status ? 'tab active' : 'tab'}
            onClick={() => setStatus(tab.value)}
          >
            {tab.label}
          </button>
        ))}
        <button type="button" className="link" onClick={load} disabled={loading}>
          Atualizar
        </button>
      </div>

      {error && <p className="error">{error}</p>}
      {!error && !loading && tables.length === 0 && <p className="label">Nenhuma mesa nesta lista.</p>}

      <ul className="admin-withdrawals">
        {tables.map((table) => (
          <li key={table.id} className="card">
            <div className="withdrawal-row">
              <strong>
                {describe(table)} · {table.stake} {table.stake === 1 ? 'chave' : 'chaves'}
              </strong>
              <span className="label">pote {formatBrl(table.prizePool)}</span>
            </div>
            <p className="label">
              {formatDateTime(table.startedAt ?? table.createdAt)} · {table.moveCount} jogadas ·{' '}
              {table.players.map((player) => player.name).join(', ')}
            </p>
            <button type="button" className="link" onClick={() => setSelected(table.id)}>
              Ver mesa e jogadas
            </button>
          </li>
        ))}
      </ul>
    </>
  );
}

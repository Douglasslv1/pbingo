import { useCallback, useEffect, useState } from 'react';
import { api, ApiError } from '../../api';
import { formatBrl } from '../../format';
import { useAuth } from '../../hooks/useAuth';
import type { AdminDominoTableDetail, AdminDominoTableSummary, DominoAction, DominoTableView } from '../../types';
import { formatDateTime } from '../../withdrawalFormat';
import DominoTile from '../domino/DominoTile';
import { MODE_LABELS, TEAM_LABELS } from '../domino/dominoLabels';

type TableStatus = DominoTableView['status'];

const STATUS_TABS: Array<{ value: TableStatus; label: string }> = [
  { value: 'PLAYING', label: 'Em jogo' },
  { value: 'WAITING', label: 'Aguardando' },
  { value: 'FINISHED', label: 'Encerradas' },
  { value: 'CANCELLED', label: 'Canceladas' },
];

function describeAction(action: DominoAction): string {
  if (action.type === 'PLAY') {
    return `jogou ${action.tile[0]}-${action.tile[1]} na ponta ${action.side === 'LEFT' ? 'inicial' : 'final'}`;
  }
  return action.type === 'DRAW' ? 'comprou do monte' : 'passou';
}

function TableDetail({ tableId, onClose }: { tableId: string; onClose: () => void }) {
  const { auth } = useAuth();
  const [detail, setDetail] = useState<AdminDominoTableDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!auth) return;
    api
      .adminDominoTable(auth.token, tableId)
      .then(setDetail)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Erro ao carregar a mesa'));
  }, [auth, tableId]);

  if (error) return <p className="error">{error}</p>;
  if (!detail) return <p className="label">Carregando mesa...</p>;

  const nameOf = (seat: number) => detail.players.find((p) => p.seat === seat)?.name ?? `Lugar ${seat + 1}`;

  return (
    <div className="card admin-domino-detail">
      <div className="withdrawal-row">
        <h3>
          {MODE_LABELS[detail.mode]} · {TEAM_LABELS[detail.teamMode]}
        </h3>
        <button type="button" className="link" onClick={onClose}>
          Fechar
        </button>
      </div>
      <p className="label">
        Mesa {detail.id} · pote {formatBrl(detail.prizePool)} · criada {formatDateTime(detail.createdAt)}
        {detail.finishedAt && ` · encerrada ${formatDateTime(detail.finishedAt)}`}
      </p>
      {detail.result && (
        <p>
          {detail.result.reason === 'DOMINO' ? 'Batida' : 'Jogo trancado'} · vencedor(es):{' '}
          <strong>{detail.result.winnerSeats.map(nameOf).join(', ')}</strong>
        </p>
      )}

      <h4>Jogadores e mãos</h4>
      <ul className="admin-domino-players">
        {detail.players.map((player) => (
          <li key={player.seat}>
            <div className="withdrawal-row">
              <span>
                <strong>
                  {player.seat + 1}. {player.name}
                </strong>{' '}
                <span className="label">{player.email}</span>
              </span>
              <span className="label">
                {player.prizeAmount && `prêmio ${formatBrl(player.prizeAmount)} · `}
                {player.timeouts} tempo(s) esgotado(s){player.away && ' · ausente'}
              </span>
            </div>
            <div className="domino-backs">
              {(player.hand ?? []).map((tile) => (
                <DominoTile key={`${tile[0]}-${tile[1]}`} first={tile[0]} second={tile[1]} vertical size={14} />
              ))}
            </div>
          </li>
        ))}
      </ul>

      <h4>Jogadas ({detail.moves.length})</h4>
      <ol className="admin-domino-moves">
        {detail.moves.map((move) => (
          <li key={move.moveNumber}>
            <span>
              <strong>{nameOf(move.seat)}</strong> {describeAction(move.action)}
              {move.automatic && <span className="away-badge">automática</span>}
            </span>
            <span className="label">{new Date(move.createdAt).toLocaleTimeString('pt-BR')}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

export default function AdminDominoPanel() {
  const { auth } = useAuth();
  const [status, setStatus] = useState<TableStatus>('PLAYING');
  const [tables, setTables] = useState<AdminDominoTableSummary[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!auth) return;
    setLoading(true);
    setError(null);
    try {
      setTables(await api.adminDominoTables(auth.token, status));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro ao carregar as mesas');
    } finally {
      setLoading(false);
    }
  }, [auth, status]);

  useEffect(() => {
    load();
  }, [load]);

  if (selected) {
    return <TableDetail tableId={selected} onClose={() => setSelected(null)} />;
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
                {MODE_LABELS[table.mode]} · {TEAM_LABELS[table.teamMode]}
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

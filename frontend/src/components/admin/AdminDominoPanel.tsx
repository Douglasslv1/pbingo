import { formatBrl } from '../../format';
import type { AdminDominoTableDetail, DominoAction, DominoMode, DominoTeamMode } from '../../types';
import { formatDateTime } from '../../withdrawalFormat';
import DominoTile from '../domino/DominoTile';
import { MODE_LABELS, TEAM_LABELS } from '../domino/dominoLabels';
import AdminTablesPanel, { TableDetailProps, useAdminTable } from './AdminTablesPanel';

function describeAction(action: DominoAction): string {
  if (action.type === 'PLAY') {
    return `jogou ${action.tile[0]}-${action.tile[1]} na ponta ${action.side === 'LEFT' ? 'inicial' : 'final'}`;
  }
  return action.type === 'DRAW' ? 'comprou do monte' : 'passou';
}

function DominoTableDetail({ tableId, onClose }: TableDetailProps) {
  const { detail, error } = useAdminTable<AdminDominoTableDetail>('domino', tableId);

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
  return (
    <AdminTablesPanel
      game="domino"
      describe={(table) => `${MODE_LABELS[table.mode as DominoMode]} · ${TEAM_LABELS[table.teamMode as DominoTeamMode]}`}
      Detail={DominoTableDetail}
    />
  );
}

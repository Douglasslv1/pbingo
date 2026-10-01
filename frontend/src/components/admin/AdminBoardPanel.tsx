import { formatBrl } from '../../format';
import type { BoardResult } from '../../types';
import { formatDateTime } from '../../withdrawalFormat';
import AdminTablesPanel, { TableDetailProps, useAdminTable } from './AdminTablesPanel';

type BoardMove = { type: 'MOVE'; path?: number[]; from?: number; to?: number; promotion?: string } | { type: 'RESIGN' | 'TIMEOUT' };

interface BoardDetail {
  id: string;
  stake: number;
  prizePool: string;
  createdAt: string;
  finishedAt: string | null;
  result?: BoardResult | null;
  whiteSeat?: number;
  players: Array<{ seat: number; name: string; email: string; nickname?: string | null; prizeAmount: string | null }>;
  moves: Array<{ moveNumber: number; seat: number; action: BoardMove; automatic: boolean; createdAt: string }>;
}

const squareName = (square: number) => `${'abcdefgh'[square & 7]}${8 - (square >> 3)}`;

function describeMove(action: BoardMove): string {
  if (action.type !== 'MOVE') return action.type === 'RESIGN' ? 'desistiu' : 'deixou o tempo acabar';
  const squares = action.path ?? [action.from!, action.to!];
  return `${squares.map(squareName).join(' → ')}${action.promotion ? ` (promoveu a ${action.promotion})` : ''}`;
}

function BoardTableDetail({ game, title, tableId, onClose }: TableDetailProps & { game: 'damas' | 'xadrez'; title: string }) {
  const { detail, error } = useAdminTable<BoardDetail>(game, tableId);
  if (error) return <p className="error">{error}</p>;
  if (!detail) return <p className="label">Carregando mesa...</p>;

  const colorOf = (seat: number) => (seat === detail.whiteSeat ? 'brancas' : 'pretas');
  const nameOf = (seat: number) => detail.players.find((player) => player.seat === seat)?.name ?? `Lugar ${seat + 1}`;
  const winnerSeat = detail.result?.winner ? (detail.result.winner === 'w' ? detail.whiteSeat : 1 - (detail.whiteSeat ?? 0)) : null;

  return (
    <div className="card admin-domino-detail">
      <div className="withdrawal-row">
        <h3>
          {title} · {detail.stake} {detail.stake === 1 ? 'chave' : 'chaves'}
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
          Resultado: <strong>{winnerSeat === null ? 'empate' : `venceu ${nameOf(winnerSeat!)}`}</strong> ({detail.result.reason})
        </p>
      )}

      <h4>Jogadores</h4>
      <ul className="admin-domino-players">
        {detail.players.map((player) => (
          <li key={player.seat} className="withdrawal-row">
            <span>
              <strong>{player.name}</strong> ({colorOf(player.seat)}
              {player.nickname && ` · ${player.nickname}`}) <span className="label">{player.email}</span>
            </span>
            {player.prizeAmount && <span className="label">prêmio {formatBrl(player.prizeAmount)}</span>}
          </li>
        ))}
      </ul>

      <h4>Lances ({detail.moves.length})</h4>
      <ol className="admin-domino-moves">
        {detail.moves.map((move) => (
          <li key={move.moveNumber}>
            <span>
              <strong>{nameOf(move.seat)}</strong> {describeMove(move.action)}
              {move.automatic && <span className="away-badge">automático</span>}
            </span>
            <span className="label">{new Date(move.createdAt).toLocaleTimeString('pt-BR')}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

/** Mesas de damas ou xadrez no admin, com cada lance registrado. */
export default function AdminBoardPanel({ game, title }: { game: 'damas' | 'xadrez'; title: string }) {
  return (
    <AdminTablesPanel
      game={game}
      describe={() => `${title} · mano a mano`}
      Detail={(props) => <BoardTableDetail {...props} game={game} title={title} />}
    />
  );
}

import DominoGame from '../components/domino/DominoGame';
import DominoLobby from '../components/domino/DominoLobby';
import { MODE_LABELS, seatsFor, TEAM_LABELS } from '../components/domino/dominoLabels';
import { withOptimisticPlay } from '../components/domino/optimisticPlay';
import HistoryPanel from '../components/HistoryPanel';
import TablePage from '../components/tables/TablePage';
import TableWaiting from '../components/tables/TableWaiting';
import { useGameConfig } from '../hooks/useGameConfig';
import { useTableRoom } from '../hooks/useTableRoom';
import type { DominoAction, DominoTableView } from '../types';

function DominoRoom() {
  const free = useGameConfig()?.dominoFree ?? false;
  const room = useTableRoom<DominoTableView, DominoAction>('domino', (table, action) =>
    action.type === 'PLAY' ? withOptimisticPlay(table, action) : null,
  );
  const { table } = room;

  if (room.loading) {
    return <div className="card">Carregando...</div>;
  }

  if (table?.status === 'WAITING') {
    return (
      <TableWaiting
        table={table}
        subtitle={`${MODE_LABELS[table.mode]} · ${TEAM_LABELS[table.teamMode]}`}
        seatCount={seatsFor(table.teamMode)}
        pairs={table.teamMode === 'PAIRS'}
        free={free}
        leaving={room.busy}
        onLeave={room.leave}
      />
    );
  }
  if (table && (table.status === 'PLAYING' || table.status === 'FINISHED')) {
    return (
      <DominoGame
        table={table}
        busy={room.busy}
        error={room.error}
        onAction={room.act}
        onComeBack={room.comeBack}
        onBackToLobby={room.backToLobby}
      />
    );
  }

  return (
    <>
      {table?.status === 'CANCELLED' && (
        <div className="banner">A mesa foi cancelada por falta de jogadores. Sua chave foi devolvida.</div>
      )}
      {room.error && <p className="error">{room.error}</p>}
      <DominoLobby keysBalance={room.keysBalance} joining={room.busy} onJoin={room.join} />
      <HistoryPanel initialTab="domino" />
    </>
  );
}

export default function DominoPage() {
  return (
    <TablePage>
      <DominoRoom />
    </TablePage>
  );
}

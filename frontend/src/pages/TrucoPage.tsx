import HistoryPanel from '../components/HistoryPanel';
import TablePage from '../components/tables/TablePage';
import TableWaiting from '../components/tables/TableWaiting';
import TrucoGame from '../components/truco/TrucoGame';
import TrucoLobby from '../components/truco/TrucoLobby';
import { useTableRoom } from '../hooks/useTableRoom';
import type { TrucoAction, TrucoTableView } from '../types';

function TrucoRoom() {
  const room = useTableRoom<TrucoTableView, TrucoAction>('truco');
  const { table } = room;

  if (room.loading) {
    return <div className="card">Carregando...</div>;
  }

  if (table?.status === 'WAITING') {
    const pairs = table.teamMode === 'PAIRS';
    return (
      <TableWaiting
        table={table}
        subtitle={`Truco · ${pairs ? 'Duplas' : 'Mano a mano'} · mesa de ${table.stake} ${table.stake === 1 ? 'chave' : 'chaves'}`}
        seatCount={pairs ? 4 : 2}
        pairs={pairs}
        free={false}
        leaving={room.busy}
        onLeave={room.leave}
      />
    );
  }
  if (table && (table.status === 'PLAYING' || table.status === 'FINISHED')) {
    return (
      <TrucoGame
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
        <div className="banner">A mesa foi cancelada por falta de jogadores. Suas chaves foram devolvidas.</div>
      )}
      {room.error && <p className="error">{room.error}</p>}
      <TrucoLobby keysBalance={room.keysBalance} joining={room.busy} onJoin={room.join} />
      <HistoryPanel initialTab="truco" />
    </>
  );
}

export default function TrucoPage() {
  return (
    <TablePage>
      <TrucoRoom />
    </TablePage>
  );
}

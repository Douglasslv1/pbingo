import { ComponentType, ReactNode, useState } from 'react';
import { Link } from 'react-router-dom';
import { formatBrl } from '../../format';
import { useGameConfig } from '../../hooks/useGameConfig';
import { useTableRoom } from '../../hooks/useTableRoom';
import type { GameTableView, TableGame } from '../../types';
import HistoryPanel from '../HistoryPanel';
import StakePicker from '../tables/StakePicker';
import TableWaiting from '../tables/TableWaiting';

export interface BoardGameProps<V, A> {
  table: V;
  busy: boolean;
  error: string | null;
  onAction: (action: A) => void;
  onBackToLobby: () => void;
}

interface Props<V, A> {
  game: Extract<TableGame, 'damas' | 'xadrez'>;
  title: string;
  intro: ReactNode;
  Rules: ComponentType;
  Game: ComponentType<BoardGameProps<V, A>>;
}

/** Sala de um jogo de tabuleiro (mano a mano): lobby com as regras, espera e partida. */
export default function BoardRoom<V extends GameTableView<unknown>, A>({ game, title, intro, Rules, Game }: Props<V, A>) {
  const config = useGameConfig();
  const room = useTableRoom<V, A>(game);
  const [stake, setStake] = useState(1);
  const [showRules, setShowRules] = useState(false);
  const { table } = room;
  const free = config?.boardGamesFree ?? true;
  const keyPrice = config ? config.creditPriceBrl * config.ticketPriceCredits : null;
  const hasKeys = free || room.keysBalance === null || room.keysBalance >= stake;

  if (room.loading) return <div className="card">Carregando...</div>;

  if (table?.status === 'WAITING') {
    return (
      <TableWaiting
        table={table}
        subtitle={`${title} · mano a mano`}
        seatCount={2}
        pairs={false}
        free={free}
        leaving={room.busy}
        onLeave={room.leave}
      />
    );
  }
  if (table && (table.status === 'PLAYING' || table.status === 'FINISHED')) {
    return <Game table={table} busy={room.busy} error={room.error} onAction={room.act} onBackToLobby={room.backToLobby} />;
  }

  const entry = free ? 'grátis' : `${stake} ${stake === 1 ? 'chave' : 'chaves'}${keyPrice ? ` = ${formatBrl(stake * keyPrice)}` : ''}`;

  return (
    <>
      {table?.status === 'CANCELLED' && <div className="banner">A mesa foi cancelada: ninguém apareceu a tempo.</div>}
      {room.error && <p className="error">{room.error}</p>}
      <div className="card">
        <h2>{title}</h2>
        <p className="hint intro-hint">
          {intro} Mano a mano, {config?.boardTurnSeconds ?? 60}s por lance: se o tempo acabar, você perde a partida.
          {free && ' Durante os testes a partida é grátis e não há prêmio.'}
        </p>

        <button type="button" className="link" onClick={() => setShowRules(!showRules)} aria-expanded={showRules}>
          {showRules ? 'Esconder as regras' : 'Ver as regras completas'}
        </button>
        {showRules && <Rules />}

        {!free && <StakePicker value={stake} onChange={setStake} seats={2} winners={1} />}

        {hasKeys ? (
          <button type="button" onClick={() => room.join({ stake })} disabled={room.busy}>
            {room.busy ? 'Entrando...' : `Entrar na mesa (${entry})`}
          </button>
        ) : (
          <p className="hint">
            Chaves insuficientes para esta mesa. <Link to="/app">Compre chaves via Pix</Link> para jogar.
          </p>
        )}
      </div>
      <HistoryPanel initialTab={game} />
    </>
  );
}

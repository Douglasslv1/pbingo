import { formatBrl } from '../format';
import type { RoundView, Ticket } from '../types';
import { useCountdown } from '../hooks/useCountdown';
import BallRoulette, { DrawEvent } from './BallRoulette';
import TicketCard from './TicketCard';

interface Props {
  round: RoundView | null;
  myTickets: Ticket[];
  onJoin: () => void;
  joining: boolean;
  lastDrawn: DrawEvent | null;
}

export default function RoundPanel({ round, myTickets, onJoin, joining, lastDrawn }: Props) {
  const countdown = useCountdown(round?.status === 'WAITING' ? round.waitingEndsAt : null);

  if (!round) {
    return <div className="card">Carregando rodada...</div>;
  }

  const statusLabel: Record<string, string> = {
    WAITING: 'Aberta para entrada',
    IN_PROGRESS: 'Sorteio em andamento',
    FINISHED: 'Encerrada',
  };

  return (
    <div className="card">
      <h2>Rodada atual</h2>
      <p>
        Status: <strong>{statusLabel[round.status] ?? round.status}</strong>
        {round.status === 'WAITING' && countdown !== null && <> — abre em {countdown}s</>}
      </p>
      <p>
        Premio acumulado: <strong>{formatBrl(round.accumulatedPrize)}</strong>
      </p>

      {round.status === 'WAITING' && (
        <button onClick={onJoin} disabled={myTickets.length > 0 || joining}>
          {myTickets.length > 0 ? 'Cartela comprada' : joining ? 'Comprando...' : 'Comprar cartela (1 chave)'}
        </button>
      )}

      {round.status === 'IN_PROGRESS' && <BallRoulette lastDrawn={lastDrawn} />}

      {round.drawnNumbers.length > 0 && (
        <div className="drawn-numbers">
          <span className="label">Numeros sorteados</span>
          <div className="ball-list">
            {round.drawnNumbers.map((n) => (
              <span key={n} className="ball">
                {n}
              </span>
            ))}
          </div>
        </div>
      )}

      {myTickets.length > 0 && (
        <div className="my-tickets">
          <span className="label">Minha cartela</span>
          {myTickets.map((ticket) => (
            <TicketCard
              key={ticket.id}
              matrix={ticket.numbersMatrix}
              drawnNumbers={round.drawnNumbers}
              isWinner={ticket.isWinner}
            />
          ))}
        </div>
      )}
    </div>
  );
}

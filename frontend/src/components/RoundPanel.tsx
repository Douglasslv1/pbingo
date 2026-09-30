import { formatBrl, formatCountdown, formatTime } from '../format';
import { useCountdown } from '../hooks/useCountdown';
import { useGameConfig } from '../hooks/useGameConfig';
import type { RoundView, Ticket } from '../types';
import BallRoulette, { DrawEvent } from './BallRoulette';
import TicketCard from './TicketCard';

interface Props {
  round: RoundView | null;
  myTickets: Ticket[];
  onJoin: () => void;
  onLeave: () => void;
  joining: boolean;
  lastDrawn: DrawEvent | null;
}

const STATUS_LABELS: Record<RoundView['status'], string> = {
  WAITING: 'Sala aberta - aguardando jogadores',
  IN_PROGRESS: 'Sorteio em andamento',
  FINISHED: 'Encerrada',
  CANCELLED: 'Cancelada por falta de jogadores',
};

export default function RoundPanel({ round, myTickets, onJoin, onLeave, joining, lastDrawn }: Props) {
  const config = useGameConfig();
  const countdown = useCountdown(round?.status === 'WAITING' ? round.waitingEndsAt : null);

  if (!round) {
    return <div className="card">Carregando rodada...</div>;
  }

  const inRound = myTickets.length > 0;
  const missingPlayers = Math.max(round.minPlayers - round.playersCount, 0);
  const ticketPrice = config ? formatBrl(config.creditPriceBrl * config.ticketPriceCredits) : null;

  return (
    <div className="card">
      <h2>Números da sorte</h2>
      <p>
        <strong>{STATUS_LABELS[round.status]}</strong>
      </p>

      {round.status === 'WAITING' && (
        <div className="round-lobby">
          <div className="round-stats">
            <div>
              <span className="label">Começa as</span>
              <strong>{round.waitingEndsAt ? formatTime(round.waitingEndsAt) : '-'}</strong>
              {countdown !== null && <span className="label">em {formatCountdown(countdown)}</span>}
            </div>
            <div>
              <span className="label">Jogadores</span>
              <strong>
                {round.playersCount}/{round.minPlayers}
              </strong>
              <span className="label">
                {missingPlayers > 0 ? `faltam ${missingPlayers} para começar` : 'mínimo atingido'}
              </span>
            </div>
            <div>
              <span className="label">Prêmio atual</span>
              <strong>{formatBrl(round.accumulatedPrize)}</strong>
            </div>
          </div>

          <div className="progress" aria-hidden="true">
            <div
              className="progress-bar"
              style={{ width: `${Math.min((round.playersCount / round.minPlayers) * 100, 100)}%` }}
            />
          </div>

          <p className="hint">
            A rodada só começa com pelo menos {round.minPlayers} jogadores. Se não completar até o horário, ela é
            cancelada e sua chave volta para a carteira.
          </p>

          {inRound ? (
            <div className="round-actions">
              <button type="button" disabled>
                Você está na rodada
              </button>
              <button type="button" className="link" onClick={onLeave} disabled={joining}>
                Sair e recuperar a chave
              </button>
            </div>
          ) : (
            <button type="button" onClick={onJoin} disabled={joining}>
              {joining ? 'Entrando...' : `Entrar na rodada (1 chave${ticketPrice ? ` = ${ticketPrice}` : ''})`}
            </button>
          )}
        </div>
      )}

      {round.status !== 'WAITING' && (
        <p>
          Prêmio da rodada: <strong>{formatBrl(round.accumulatedPrize)}</strong>
        </p>
      )}

      {round.status === 'IN_PROGRESS' && <BallRoulette lastDrawn={lastDrawn} />}

      {round.drawnNumbers.length > 0 && (
        <div className="drawn-numbers">
          <span className="label">Números sorteados</span>
          <div className="ball-list">
            {round.drawnNumbers.map((n) => (
              <span key={n} className="ball">
                {n}
              </span>
            ))}
          </div>
        </div>
      )}

      {inRound && (
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

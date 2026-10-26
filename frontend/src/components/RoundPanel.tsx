import { useState } from 'react';
import { formatBrl, formatCountdown, formatTime } from '../format';
import { useCountdown } from '../hooks/useCountdown';
import { useGameConfig } from '../hooks/useGameConfig';
import type { RoundView, Ticket } from '../types';
import BallRoulette, { DrawEvent } from './BallRoulette';
import TicketCard from './TicketCard';

interface Props {
  round: RoundView | null;
  myTickets: Ticket[];
  onJoin: (quantity: number) => void;
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
  const [quantity, setQuantity] = useState(1);
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
            cancelada e as chaves de todas as suas cartelas voltam para a carteira.
          </p>

          <div className="round-actions">
            <label>Quantidade de cartelas
              <input type="number" min={1} max={100} value={quantity} disabled={joining}
                onChange={(event) => setQuantity(Number(event.target.value))} />
            </label>
            <p className="hint">Cada cartela: {config?.ticketPriceCredits ?? 1} chave(s){ticketPrice ? ` (${ticketPrice})` : ''}.
              Total: {quantity * (config?.ticketPriceCredits ?? 1)} chave(s).
            </p>
            <button type="button" onClick={() => onJoin(quantity)}
              disabled={joining || !config || !Number.isInteger(quantity) || quantity < 1 || quantity > 100}>
              {joining ? 'Comprando...' : inRound ? 'Comprar mais cartelas' : 'Comprar cartelas'}
            </button>
            {inRound && <>
              <p>Você tem {myTickets.length} cartela(s) nesta rodada.</p>
              <button type="button" className="link" onClick={onLeave} disabled={joining}>
                Sair e recuperar todas as chaves
              </button>
            </>}
          </div>
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
          <span className="label">Minhas cartelas ({myTickets.length})</span>
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

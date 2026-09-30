import { formatBrl, formatCountdown } from '../../format';
import { useCountdown } from '../../hooks/useCountdown';
import type { DominoTableView } from '../../types';
import { MODE_LABELS, TEAM_LABELS } from './dominoLabels';

interface Props {
  table: DominoTableView;
  leaving: boolean;
  onLeave: () => void;
}

export default function DominoWaiting({ table, leaving, onLeave }: Props) {
  const countdown = useCountdown(table.queueExpiresAt);
  const seats = [0, 1, 2, 3].map((seat) => table.players.find((player) => player.seat === seat) ?? null);

  return (
    <div className="card">
      <h2>Aguardando jogadores</h2>
      <p className="label">
        {MODE_LABELS[table.mode]} · {TEAM_LABELS[table.teamMode]} · prêmio atual {formatBrl(table.prizePool)}
      </p>

      <div className="domino-seats">
        {seats.map((player, seat) => (
          <div key={seat} className={player ? 'domino-seat filled' : 'domino-seat'}>
            <strong>{player ? (player.isMe ? 'Você' : player.name) : 'Livre'}</strong>
            {table.teamMode === 'PAIRS' && <span className="label">Dupla {seat % 2 === 0 ? 'A' : 'B'}</span>}
          </div>
        ))}
      </div>

      <div className="progress" aria-hidden="true">
        <div className="progress-bar" style={{ width: `${(table.players.length / 4) * 100}%` }} />
      </div>
      <p className="hint intro-hint">
        {table.players.length}/4 jogadores. A partida começa sozinha quando a mesa completar.
        {countdown !== null && ` Se não completar em ${formatCountdown(countdown)}, a mesa é cancelada e sua chave volta.`}
      </p>

      <button type="button" className="link" onClick={onLeave} disabled={leaving}>
        {leaving ? 'Saindo...' : 'Sair e recuperar a chave'}
      </button>
    </div>
  );
}

import { formatBrl, formatCountdown } from '../../format';
import { useCountdown } from '../../hooks/useCountdown';
import type { GameTableView } from '../../types';

interface Props {
  table: GameTableView<unknown>;
  /** Modalidade e formato, ja traduzidos. */
  subtitle: string;
  seatCount: number;
  pairs: boolean;
  /** Entrada gratuita: nao ha chave a devolver. */
  free: boolean;
  leaving: boolean;
  onLeave: () => void;
}

/** Sala de espera de qualquer jogo de mesa: lugares, prazo para completar e saida com devolucao. */
export default function TableWaiting({ table, subtitle, seatCount, pairs, free, leaving, onLeave }: Props) {
  const countdown = useCountdown(table.queueExpiresAt);
  const seats = Array.from({ length: seatCount }, (_, seat) => table.players.find((player) => player.seat === seat) ?? null);
  const keys = `${table.stake === 1 ? 'sua chave volta' : 'suas chaves voltam'}`;

  return (
    <div className="card">
      <h2>Aguardando jogadores</h2>
      <p className="label">
        {subtitle} · prêmio atual {formatBrl(table.prizePool)}
      </p>

      <div className="domino-seats">
        {seats.map((player, seat) => (
          <div key={seat} className={player ? 'domino-seat filled' : 'domino-seat'}>
            <strong>{player ? (player.isMe ? 'Você' : player.name) : 'Livre'}</strong>
            {pairs && <span className="label">Dupla {seat % 2 === 0 ? 'A' : 'B'}</span>}
          </div>
        ))}
      </div>

      <div className="progress" aria-hidden="true">
        <div className="progress-bar" style={{ width: `${(table.players.length / seatCount) * 100}%` }} />
      </div>
      <p className="hint intro-hint">
        {table.players.length}/{seatCount} jogadores. A partida começa sozinha quando a mesa completar.
        {countdown !== null &&
          ` Se não completar em ${formatCountdown(countdown)}, a mesa é cancelada${free ? '' : ` e ${keys}`}.`}
      </p>

      <button type="button" className="link" onClick={onLeave} disabled={leaving}>
        {leaving ? 'Saindo...' : free ? 'Sair da mesa' : `Sair e recuperar ${table.stake === 1 ? 'a chave' : 'as chaves'}`}
      </button>
    </div>
  );
}

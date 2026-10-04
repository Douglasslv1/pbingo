import type { ReactNode } from 'react';
import ChampionBadge from '../ChampionBadge';

export interface TableSeat {
  name: string;
  /** Torneios vencidos: selo de campeao ao lado do nome. */
  titles?: number;
  /** Rotulo ao lado do nome (ex.: "brancas"). Nas duplas e substituido por parceiro/adversario. */
  tag?: string;
  away?: boolean;
  /** Pedras ou cartas viradas do jogador. */
  hand?: ReactNode;
  /** Classe extra da placa (ex.: a cor das pecas do jogador no Ludo). */
  className?: string;
}

interface Props {
  /** Um item por lugar, na ordem dos lugares da mesa. */
  seats: TableSeat[];
  mySeat: number;
  /** Lugar de quem joga agora (null: ninguem, partida encerrada). */
  turnSeat: number | null;
  countdown: number | null;
  /** Duplas: parceiros sentam frente a frente (lugares de mesma paridade). */
  pairs?: boolean;
  children: ReactNode;
}

/** Posicoes em volta da mesa, a partir de quem olha (embaixo), no sentido do jogo. */
const POSITIONS: Record<number, string[]> = { 2: ['bottom', 'top'], 4: ['bottom', 'right', 'top', 'left'] };

/**
 * Mesa de jogo: cada jogador numa ponta, como numa mesa de verdade, e o jogo no centro. O jogador
 * fica sempre embaixo; o lado de cada um (sua dupla ou adversarios) aparece em cores diferentes.
 */
export default function GameTable({ seats, mySeat, turnSeat, countdown, pairs = false, children }: Props) {
  const count = seats.length;
  // Mano a mano tem dois lados; individual a quatro, nenhum
  const sides = pairs || count === 2;

  return (
    <div className={`game-table seats-${count}`}>
      {POSITIONS[count].map((position, index) => {
        const seat = (mySeat + index) % count;
        const { name, titles, tag, away, hand, className } = seats[seat];
        const mine = seat % 2 === mySeat % 2;
        const turn = turnSeat === seat;
        const classes = ['seat-plate', position, sides && (mine ? 'mine' : 'theirs'), turn && 'turn', className];
        const label = pairs ? (seat === mySeat ? 'sua dupla' : mine ? 'parceiro' : 'adversário') : tag;

        return (
          <div key={seat} className={classes.filter(Boolean).join(' ')}>
            <strong>
              {name}
              <ChampionBadge titles={titles} />
            </strong>
            {label && <span className="seat-tag">{label}</span>}
            {away && <span className="away-badge">ausente</span>}
            {turn && countdown !== null && (
              <span className={countdown <= 10 ? 'turn-timer urgent' : 'turn-timer'}>{countdown}s</span>
            )}
            {hand}
          </div>
        );
      })}
      <div className="game-table-center">{children}</div>
    </div>
  );
}

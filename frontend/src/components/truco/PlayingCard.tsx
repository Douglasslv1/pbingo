import type { TrucoCard } from '../../types';
import { cardName, rankOf, suitOf, SUIT_SYMBOL } from './trucoLabels';

interface Props {
  /** null: carta virada para baixo (mao do adversario, carta coberta ou mao de ferro). */
  card: TrucoCard | null;
  size?: 'small' | 'medium' | 'large';
  manilha?: boolean;
  highlighted?: boolean;
  dimmed?: boolean;
  onClick?: () => void;
  label?: string;
}

/** Carta de baralho desenhada em CSS: valor no canto e naipe grande no centro. */
export default function PlayingCard({ card, size = 'medium', manilha, highlighted, dimmed, onClick, label }: Props) {
  const red = card !== null && ['O', 'C'].includes(suitOf(card));
  const classes = [
    'playing-card',
    size,
    card === null && 'back',
    red && 'red',
    manilha && 'manilha',
    highlighted && 'highlighted',
    dimmed && 'dimmed',
    onClick && 'clickable',
  ]
    .filter(Boolean)
    .join(' ');
  const name = label ?? (card ? cardName(card) : 'Carta virada para baixo');

  const face = card && (
    <>
      <span className="card-corner">
        {rankOf(card)}
        <br />
        {SUIT_SYMBOL[suitOf(card)]}
      </span>
      <span className="card-suit">{SUIT_SYMBOL[suitOf(card)]}</span>
    </>
  );

  return onClick ? (
    <button type="button" className={classes} onClick={onClick} aria-label={name}>
      {face}
    </button>
  ) : (
    <span className={classes} role="img" aria-label={name}>
      {face}
    </span>
  );
}

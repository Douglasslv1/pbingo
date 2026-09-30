// Posicao dos pontos em cada metade (quadrado 0-1), na pedra deitada
const PIPS: Record<number, Array<[number, number]>> = {
  0: [],
  1: [[0.5, 0.5]],
  2: [
    [0.25, 0.25],
    [0.75, 0.75],
  ],
  3: [
    [0.25, 0.25],
    [0.5, 0.5],
    [0.75, 0.75],
  ],
  4: [
    [0.25, 0.25],
    [0.75, 0.25],
    [0.25, 0.75],
    [0.75, 0.75],
  ],
  5: [
    [0.25, 0.25],
    [0.75, 0.25],
    [0.5, 0.5],
    [0.25, 0.75],
    [0.75, 0.75],
  ],
  6: [
    [0.25, 0.25],
    [0.5, 0.25],
    [0.75, 0.25],
    [0.25, 0.75],
    [0.5, 0.75],
    [0.75, 0.75],
  ],
};

const HALF = 100;

interface Props {
  /** Valor da metade esquerda (ou de cima, na pedra em pe). */
  first: number;
  second: number;
  vertical?: boolean;
  /** Altura da pedra deitada (lado menor), em px. */
  size?: number;
  selected?: boolean;
  highlighted?: boolean;
  dimmed?: boolean;
  onClick?: () => void;
  label?: string;
}

function Half({ value, offset, vertical }: { value: number; offset: number; vertical: boolean }) {
  return (
    <>
      {PIPS[value].map(([x, y], index) => {
        // Na pedra em pe, a metade vai para baixo e os pontos giram junto
        const [px, py] = vertical ? [y, x] : [x, y];
        const cx = (vertical ? px : px + offset) * HALF;
        const cy = (vertical ? py + offset : py) * HALF;
        return <circle key={index} cx={cx} cy={cy} r={9} className="domino-pip" />;
      })}
    </>
  );
}

export default function DominoTile({
  first,
  second,
  vertical = false,
  size = 32,
  selected,
  highlighted,
  dimmed,
  onClick,
  label,
}: Props) {
  const width = vertical ? HALF : HALF * 2;
  const height = vertical ? HALF * 2 : HALF;
  const classes = ['domino-tile', selected && 'selected', highlighted && 'highlighted', dimmed && 'dimmed', onClick && 'clickable']
    .filter(Boolean)
    .join(' ');

  const svg = (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width={vertical ? size : size * 2}
      height={vertical ? size * 2 : size}
      role="img"
      aria-label={label ?? `Pedra ${first}-${second}`}
    >
      <rect x={3} y={3} width={width - 6} height={height - 6} rx={14} className="domino-face" />
      {vertical ? (
        <line x1={14} y1={HALF} x2={HALF - 14} y2={HALF} className="domino-divider" />
      ) : (
        <line x1={HALF} y1={14} x2={HALF} y2={HALF - 14} className="domino-divider" />
      )}
      <Half value={first} offset={0} vertical={vertical} />
      <Half value={second} offset={1} vertical={vertical} />
    </svg>
  );

  if (!onClick) {
    return <span className={classes}>{svg}</span>;
  }
  return (
    <button type="button" className={classes} onClick={onClick} aria-pressed={selected}>
      {svg}
    </button>
  );
}

/** Pedra virada para baixo (maos dos adversarios). */
export function DominoTileBack({ size = 14 }: { size?: number }) {
  return (
    <span className="domino-tile">
      <svg viewBox="0 0 100 200" width={size} height={size * 2} aria-hidden="true">
        <rect x={3} y={3} width={94} height={194} rx={14} className="domino-back" />
      </svg>
    </span>
  );
}

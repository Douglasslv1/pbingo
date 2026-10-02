import { motion } from 'framer-motion';
import type { LudoGameView } from '../../types';
import { BASE_AREA, boardCells, COLOR_NAMES, pathOf, pointOf, Point, SIZE, viewTurns } from './ludoGeometry';

interface Props {
  game: LudoGameView;
  mySeat: number;
  /** Pecas do jogador que podem andar agora (destacadas e clicaveis). */
  playable: number[];
  onPiece: (piece: number) => void;
}

/** Segundos por casa na animacao do movimento. */
const STEP = 0.16;

/**
 * Tabuleiro de Ludo em SVG (15x15 casas), girado para a cor de quem joga ficar embaixo a direita.
 * A ultima peca movida percorre as casas uma a uma; as capturadas voltam a base depois que ela chega.
 */
export default function LudoBoard({ game, mySeat, playable, onPiece }: Props) {
  const turns = viewTurns(game.colors[mySeat]);
  const cells = boardCells(turns);
  const last = game.lastMove;
  const moverDuration = last ? (last.from === -1 ? 1 : last.to - last.from) * STEP : 0;
  const landing = last ? pointOf(game.colors[last.seat], last.to, last.piece, turns) : [0, 0];

  // Varias pecas na mesma casa ficam levemente deslocadas para todas aparecerem
  const stacks = new Map<string, number>();
  const pieces = game.pieces.flatMap((progresses, seat) =>
    progresses.map((progress, piece) => {
      const [y, x] = pointOf(game.colors[seat], progress, piece, turns);
      const key = `${y},${x}`;
      const order = stacks.get(key) ?? 0;
      stacks.set(key, order + 1);
      return { seat, piece, progress, target: [y - order * 0.18, x + order * 0.18] as Point };
    }),
  );

  return (
    <svg className="ludo-board" viewBox={`0 0 ${SIZE} ${SIZE}`} role="img" aria-label="Tabuleiro de Ludo">
      <rect width={SIZE} height={SIZE} rx={0.3} className="ludo-surface" />
      {cells.bases.map(({ color, center }) => (
        <g key={color} className={`ludo-color-${color}`}>
          <rect
            x={center[1] - BASE_AREA.size / 2}
            y={center[0] - BASE_AREA.size / 2}
            width={BASE_AREA.size}
            height={BASE_AREA.size}
            rx={0.4}
            className="ludo-base"
          />
          <rect x={center[1] - 2} y={center[0] - 2} width={4} height={4} rx={0.4} className="ludo-base-inner" />
        </g>
      ))}
      {cells.bases.flatMap(({ color, slots }) =>
        slots.map(([y, x], index) => <circle key={`${color}-${index}`} cx={x} cy={y} r={0.55} className={`ludo-slot ludo-color-${color}`} />),
      )}
      {cells.track.map(({ point: [y, x], color, safe }, index) => {
        const energy = game.energyTiles.includes(index);
        return (
          <g key={index}>
            <rect
              x={x - 0.5}
              y={y - 0.5}
              width={1}
              height={1}
              className={color === null ? `ludo-cell${energy ? ' energy' : ''}` : `ludo-cell ludo-color-${color} filled`}
            />
            {((safe && color === null) || energy) && (
              <text x={x} y={y + 0.32} textAnchor="middle" className={energy ? 'ludo-bolt' : 'ludo-star'}>
                {energy ? '⚡' : '★'}
              </text>
            )}
          </g>
        );
      })}
      {cells.homes.map(({ point: [y, x], color }, index) => (
        <rect key={index} x={x - 0.5} y={y - 0.5} width={1} height={1} className={`ludo-cell ludo-color-${color} filled`} />
      ))}
      {cells.finishes.map(({ color, points }) => (
        <polygon key={color} points={points.map(([y, x]) => `${x},${y}`).join(' ')} className={`ludo-finish ludo-color-${color}`} />
      ))}

      {pieces.map(({ seat, piece, progress, target }) => {
        const color = game.colors[seat];
        const moved = last?.seat === seat && last.piece === piece;
        const captured = last?.captured.some((capture) => capture.seat === seat && capture.piece === piece);
        const route = moved ? pathOf(color, last.from, last.to, piece, turns).slice(0, -1).concat([target]) : [target];
        const canPlay = seat === mySeat && playable.includes(piece);

        return (
          <motion.g
            key={`${seat}-${piece}`}
            className={`ludo-piece ludo-color-${color}${canPlay ? ' playable' : ''}`}
            initial={false}
            animate={{ x: route.map(([, x]) => x), y: route.map(([y]) => y) }}
            transition={{
              duration: moved ? moverDuration : 0.35,
              delay: captured ? moverDuration : 0,
              ease: moved ? 'linear' : 'easeOut',
            }}
            onClick={canPlay ? () => onPiece(piece) : undefined}
            role={canPlay ? 'button' : undefined}
            aria-label={`Peça ${piece + 1} ${COLOR_NAMES[color]}${progress === -1 ? ' (na base)' : ''}`}
          >
            {canPlay && <circle r={0.62} className="ludo-piece-ring" />}
            <circle r={0.4} className="ludo-piece-body" />
            <circle r={0.18} className="ludo-piece-top" />
          </motion.g>
        );
      })}

      {/* Energia ganha no ultimo movimento sobe da casa onde a peca parou */}
      {last?.energy && last.energy.length > 0 && (
        <g transform={`translate(${landing[1]} ${landing[0] - 0.6})`}>
          <motion.text
            key={game.moveCount}
            textAnchor="middle"
            className="ludo-energy-gain"
            initial={{ opacity: 0, y: 0 }}
            animate={{ opacity: [0, 1, 1, 0], y: -1.4 }}
            transition={{ duration: 1.6, delay: moverDuration }}
          >
            +{last.energy.reduce((sum, gain) => sum + gain.amount, 0)} ⚡
          </motion.text>
        </g>
      )}
    </svg>
  );
}

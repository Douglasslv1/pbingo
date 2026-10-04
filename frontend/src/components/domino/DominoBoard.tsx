import { motion } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';
import type { DominoPlacedTile, DominoSide } from '../../types';
import DominoTile from './DominoTile';

interface Props {
  line: DominoPlacedTile[];
  /** Indice da primeira pedra jogada, que fica fixa no centro. */
  anchorIndex: number;
  /** Pontas onde a pedra selecionada encaixa: ficam destacadas e clicaveis. */
  targetSides: DominoSide[];
  onPlaySide: (side: DominoSide) => void;
}

const GAP = 2;

/**
 * Tamanho da pedra e colunas que cabem na largura disponivel (sempre impar, para a primeira pedra
 * ficar no meio). Todas as pedras ficam deitadas, encostadas umas nas outras.
 */
function useLayout() {
  const ref = useRef<HTMLDivElement>(null);
  const [layout, setLayout] = useState({ size: 26, columns: 5 });

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => {
      const width = entry.contentRect.width;
      // No desktop a mesa e larga: pedras maiores
      const size = width < 300 ? 17 : width < 480 ? 22 : width < 900 ? 28 : width < 1200 ? 34 : 40;
      const fit = Math.max(3, Math.floor((width + GAP) / (size * 2 + GAP)));
      setLayout({ size, columns: fit % 2 === 0 ? fit - 1 : fit });
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return { ref, ...layout };
}

interface Cell {
  index: number;
  row: number;
  col: number;
  /** A linha corre da direita para a esquerda: a pedra e mostrada virada para as faces continuarem encostadas. */
  flipped: boolean;
}

/**
 * Posicao fixa de cada pedra: a primeira fica no centro, a ponta direita cresce para a direita e
 * dobra para baixo, a esquerda cresce para a esquerda e dobra para cima. Jogar numa ponta nunca
 * move as pedras ja colocadas.
 */
function layout(length: number, anchor: number, columns: number): Cell[] {
  const center = (columns - 1) / 2;

  return Array.from({ length }, (_, index) => {
    const step = Math.abs(index - anchor);
    const dir = index >= anchor ? 1 : -1;
    if (step <= center) {
      return { index, row: 0, col: center + dir * step, flipped: false };
    }
    const k = step - center - 1;
    const turns = Math.floor(k / columns) + 1;
    const rowDir = turns % 2 === 1 ? -dir : dir;
    const offset = k % columns;
    return { index, row: dir * turns, col: rowDir === 1 ? offset : columns - 1 - offset, flipped: rowDir !== dir };
  });
}

export default function DominoBoard({ line, anchorIndex, targetSides, onPlaySide }: Props) {
  const { ref, size, columns } = useLayout();
  const cells = layout(line.length, anchorIndex, columns);
  const topRow = Math.min(0, ...cells.map((cell) => cell.row));
  const lastIndex = line.length - 1;

  return (
    <div className="domino-board" ref={ref}>
      {line.length === 0 ? (
        <p className="label">A mesa está vazia. Quem tem a maior carroça começa.</p>
      ) : (
        <div className="domino-grid" style={{ gridTemplateColumns: `repeat(${columns}, ${size * 2}px)`, gap: `${GAP * 2}px ${GAP}px` }}>
          {cells.map(({ index, row, col, flipped }) => {
            const placed = line[index];
            const side: DominoSide | null = index === 0 ? 'LEFT' : index === lastIndex ? 'RIGHT' : null;
            const isTarget = side !== null && targetSides.includes(side);
            const [first, second] = flipped ? [placed.right, placed.left] : [placed.left, placed.right];

            return (
              <motion.span
                key={`${placed.tile[0]}-${placed.tile[1]}`}
                className="domino-slot"
                style={{ gridRow: row - topRow + 1, gridColumn: col + 1 }}
                initial={{ scale: 0.4, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: 'spring', stiffness: 380, damping: 22 }}
              >
                <DominoTile
                  first={first}
                  second={second}
                  size={size}
                  highlighted={isTarget}
                  onClick={isTarget && side ? () => onPlaySide(side) : undefined}
                  label={isTarget ? `Jogar nesta ponta (${side === 'LEFT' ? placed.left : placed.right})` : undefined}
                />
              </motion.span>
            );
          })}
        </div>
      )}
    </div>
  );
}

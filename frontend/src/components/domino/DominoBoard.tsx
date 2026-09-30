import { motion } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';
import type { DominoPlacedTile, DominoSide } from '../../types';
import DominoTile from './DominoTile';

interface Props {
  line: DominoPlacedTile[];
  /** Pontas onde a pedra selecionada encaixa: ficam destacadas e clicaveis. */
  targetSides: DominoSide[];
  onPlaySide: (side: DominoSide) => void;
}

const TILE_SIZE = 26;
// Pedra deitada (2x o lado menor) + espaco entre pedras
const SLOT_WIDTH = TILE_SIZE * 2 + 6;

/** Quantas pedras cabem por linha na largura disponivel. */
function useTilesPerRow() {
  const ref = useRef<HTMLDivElement>(null);
  const [perRow, setPerRow] = useState(6);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => {
      setPerRow(Math.max(3, Math.floor(entry.contentRect.width / SLOT_WIDTH)));
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return { ref, perRow };
}

/**
 * Mesa em "cobra": as linhas alternam o sentido (esquerda->direita, depois direita->esquerda),
 * para a fileira caber na tela sem perder a continuidade entre as pedras.
 */
const tileKey = (placed: DominoPlacedTile) => `${placed.tile[0]}-${placed.tile[1]}`;

export default function DominoBoard({ line, targetSides, onPlaySide }: Props) {
  const { ref, perRow } = useTilesPerRow();
  // Pedras ja mostradas na mesa (atualizado depois de cada renderizacao)
  const seenTiles = useRef(new Set<string>());
  useEffect(() => {
    seenTiles.current = new Set(line.map(tileKey));
  }, [line]);

  const rows: DominoPlacedTile[][] = [];
  for (let i = 0; i < line.length; i += perRow) {
    rows.push(line.slice(i, i + perRow));
  }
  const lastIndex = line.length - 1;

  return (
    <div className="domino-board" ref={ref}>
      {line.length === 0 && <p className="label">A mesa está vazia. Quem tem a maior carroça começa.</p>}
      {rows.map((row, rowIndex) => {
        const reversed = rowIndex % 2 === 1;
        return (
          <div key={rowIndex} className={reversed ? 'domino-row reversed' : 'domino-row'}>
            {row.map((placed, indexInRow) => {
              const index = rowIndex * perRow + indexInRow;
              const side: DominoSide | null = index === 0 ? 'LEFT' : index === lastIndex ? 'RIGHT' : null;
              const isTarget = side !== null && targetSides.includes(side);
              const isDouble = placed.left === placed.right;
              // Na linha invertida a pedra e mostrada ao contrario para as faces continuarem encostadas
              const [first, second] = reversed ? [placed.right, placed.left] : [placed.left, placed.right];

              const key = tileKey(placed);

              return (
                <motion.span
                  key={key}
                  className="domino-slot"
                  // So a pedra recem-jogada anima; as outras podem trocar de linha sem piscar
                  initial={seenTiles.current.has(key) ? false : { scale: 0.4, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: 'spring', stiffness: 380, damping: 22 }}
                >
                  <DominoTile
                    first={first}
                    second={second}
                    vertical={isDouble}
                    size={TILE_SIZE}
                    highlighted={isTarget}
                    onClick={isTarget && side ? () => onPlaySide(side) : undefined}
                    label={isTarget ? `Jogar nesta ponta (${side === 'LEFT' ? placed.left : placed.right})` : undefined}
                  />
                </motion.span>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}

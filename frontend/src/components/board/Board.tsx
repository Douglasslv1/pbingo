import type { ReactNode } from 'react';

interface Props {
  /** O que desenhar em cada uma das 64 casas (0 = a8, 63 = h1). */
  pieces: Array<ReactNode | null>;
  /** Tabuleiro visto pelas pretas (a casa h1 fica no alto). */
  flipped: boolean;
  selected?: number | null;
  /** Casas para onde a peca selecionada pode ir. */
  targets?: number[];
  /** Casas do ultimo lance, destacadas para todos verem o que mudou. */
  lastMove?: number[];
  /** Casa em perigo (rei em xeque). */
  danger?: number | null;
  onSquare?: (square: number) => void;
}

const FILES = 'abcdefgh';

/** Tabuleiro 8x8 comum a damas e xadrez: so muda o desenho das pecas. */
export default function Board({ pieces, flipped, selected = null, targets = [], lastMove = [], danger = null, onSquare }: Props) {
  const order = Array.from({ length: 64 }, (_, index) => (flipped ? 63 - index : index));

  return (
    <div className="board" role="grid" aria-label="Tabuleiro">
      {order.map((square) => {
        const row = square >> 3;
        const col = square & 7;
        const classes = [
          'board-square',
          (row + col) % 2 === 1 ? 'dark' : 'light',
          selected === square && 'selected',
          targets.includes(square) && 'target',
          lastMove.includes(square) && 'last',
          danger === square && 'danger',
        ]
          .filter(Boolean)
          .join(' ');
        const name = `${FILES[col]}${8 - row}`;
        // Coordenadas na borda esquerda e de baixo, conforme o lado de quem joga
        const showRank = col === (flipped ? 7 : 0);
        const showFile = row === (flipped ? 0 : 7);

        return (
          <button
            key={square}
            type="button"
            className={classes}
            onClick={onSquare ? () => onSquare(square) : undefined}
            disabled={!onSquare}
            aria-label={name}
          >
            {pieces[square]}
            {showRank && <span className="board-rank">{8 - row}</span>}
            {showFile && <span className="board-file">{FILES[col]}</span>}
          </button>
        );
      })}
    </div>
  );
}

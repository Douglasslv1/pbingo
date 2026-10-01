import type { DominoAction, DominoPlacedTile, DominoTableView } from '../../types';

type PlayAction = Extract<DominoAction, { type: 'PLAY' }>;

/** Mesma regra do servidor: a face igual a ponta encosta nela, a outra vira a nova ponta. */
function place(line: DominoPlacedTile[], { tile, side }: PlayAction): DominoPlacedTile[] {
  const [a, b] = tile;
  if (line.length === 0) return [{ tile, left: a, right: b }];
  if (side === 'LEFT') {
    const placed = b === line[0].left ? { tile, left: a, right: b } : { tile, left: b, right: a };
    return [placed, ...line];
  }
  const placed = a === line[line.length - 1].right ? { tile, left: a, right: b } : { tile, left: b, right: a };
  return [...line, placed];
}

/**
 * Mostra a jogada na hora, antes da resposta do servidor (que chega em seguida e substitui
 * esta previsao; se a jogada for recusada, a tela volta ao estado anterior).
 */
export function withOptimisticPlay(table: DominoTableView, action: PlayAction): DominoTableView {
  const game = table.game!;
  const line = place(game.line, action);
  const handSizes = game.handSizes.map((size, seat) => (seat === game.seat ? size - 1 : size));

  return {
    ...table,
    game: {
      ...game,
      hand: game.hand.filter((tile) => tile[0] !== action.tile[0] || tile[1] !== action.tile[1]),
      handSizes,
      line,
      anchorIndex: game.line.length === 0 ? 0 : game.anchorIndex + (action.side === 'LEFT' ? 1 : 0),
      ends: { left: line[0].left, right: line[line.length - 1].right },
      currentSeat: (game.seat + 1) % handSizes.length,
      openingTile: null,
      legalActions: [],
    },
  };
}

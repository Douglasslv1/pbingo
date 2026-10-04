import type { TrucoAction, TrucoTableView } from '../../types';

/** Carta jogada aparece na mesa na hora, antes da resposta do servidor (que substitui esta previsao). */
export function predictTruco(table: TrucoTableView, action: TrucoAction): TrucoTableView | null {
  const game = table.game;
  if (!game || action.type !== 'PLAY') return null;
  const covered = action.covered ?? false;
  return {
    ...table,
    game: {
      ...game,
      hand: game.hand.filter((_, index) => index !== action.index),
      handSizes: game.handSizes.map((size, seat) => (seat === game.seat ? size - 1 : size)),
      table: [...game.table, { seat: game.seat, card: covered ? null : game.hand[action.index], covered }],
      legalActions: [],
    },
  };
}

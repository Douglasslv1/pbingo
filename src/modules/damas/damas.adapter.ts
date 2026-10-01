import { env } from '../../config/env';
import { boardAdapter } from '../board/board.adapter';
import { applyAction, dealGame, legalPaths } from './damas.engine';

export const damasAdapter = boardAdapter({
  game: 'DAMAS',
  label: 'damas',
  enabled: () => env.damasEnabled,
  deal: () => dealGame(),
  apply: applyAction,
  view: (state, color) => ({
    board: state.board,
    quietKingPlies: state.quietKingPlies,
    legalPaths: state.turn === color ? legalPaths(state) : [],
  }),
});

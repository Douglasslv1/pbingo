import { env } from '../../config/env';
import { boardAdapter } from '../board/board.adapter';
import { applyAction, dealGame, inCheck, legalMoves } from './xadrez.engine';

export const xadrezAdapter = boardAdapter({
  game: 'XADREZ',
  label: 'xadrez',
  enabled: () => env.xadrezEnabled,
  deal: () => dealGame(),
  apply: applyAction,
  view: (state, color) => ({
    board: state.board,
    inCheck: state.status === 'PLAYING' && inCheck(state, state.turn),
    halfmove: state.halfmove,
    legalMoves: state.turn === color ? legalMoves(state) : [],
  }),
});

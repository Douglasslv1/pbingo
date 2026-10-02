import { env } from '../../config/env';
import { GameAdapter } from '../tables/tables.types';
import { LudoMode } from './ludo.config';
import { applyAction, autoAction, dealGame, dieAt, hasSingleChoice, LudoAction, LudoState, viewFor } from './ludo.engine';

export const ludoAdapter: GameAdapter<LudoState, LudoAction> = {
  game: 'LUDO',
  label: 'ludo',
  enabled: () => env.ludoEnabled,
  free: () => env.ludoFree,
  turnSeconds: () => env.ludoTurnSeconds,
  seatsFor: (teamMode) => (teamMode === 'DUEL' ? 2 : 4),
  deal: (mode, teamMode) => dealGame(teamMode === 'DUEL' ? 2 : 4, mode as LudoMode),
  apply: applyAction,
  autoAction,
  actingSeat: (state) => state.turn,
  // Uma so peca (ou pecas na mesma posicao) pode andar: o servidor move sem esperar
  isForced: (state) => state.status === 'PLAYING' && state.phase === 'MOVE' && hasSingleChoice(state),
  isFinished: (state) => state.status === 'FINISHED',
  winnerSeats: (state) => (state.result ? [state.result.winner] : []),
  moveCount: (state) => state.moveCount,
  viewFor,
  handOf: () => null,
  summary: (state) => ({
    result: state.result,
    colors: state.colors,
    pieces: state.pieces,
    seed: state.status === 'FINISHED' ? state.seed : null,
  }),
  // Grava o valor de cada dado e de onde a peca saiu, para o admin reconstruir a partida
  record: (state, _seat, action) =>
    action.type === 'ROLL'
      ? { ...action, value: dieAt(state.seed, state.rolls) }
      : { ...action, dice: state.dice, from: state.pieces[state.turn][action.piece] },
};

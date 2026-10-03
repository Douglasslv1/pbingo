import { env } from '../../config/env';
import { GameAdapter } from '../tables/tables.types';
import { LudoMode } from './ludo.config';
import { applyAction, autoAction, dealGame, dieAt, isForced, LudoAction, LudoState, viewFor } from './ludo.engine';

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
  // Sem decisao (uma so peca ou nenhuma, e nenhuma habilidade possivel): o servidor joga sem esperar
  isForced,
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
    action.type === 'ROLL' || (action.type === 'ABILITY' && action.ability === 'SECOND_CHANCE')
      ? { ...action, value: dieAt(state.seed, state.rolls) }
      : action.type === 'ABILITY' && action.ability === 'MAX_SPEED'
        ? { ...action, values: [dieAt(state.seed, state.rolls), dieAt(state.seed, state.rolls + 1)] }
        : action.type === 'MOVE'
          ? { ...action, dice: state.dice, bonus: state.bonus, from: state.pieces[state.turn][action.piece] }
          : action,
};

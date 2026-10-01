import { env } from '../../config/env';
import { GameAdapter } from '../tables/tables.types';
import { applyAction, autoAction, dealGame, hasOnlyForcedAction, viewFor } from './domino.engine';
import { DominoAction, DominoMode, DominoState, seatsFor, TeamMode } from './domino.types';

export const dominoAdapter: GameAdapter<DominoState, DominoAction> = {
  game: 'DOMINO',
  label: 'dominó',
  enabled: () => env.dominoEnabled,
  free: () => env.dominoFree,
  turnSeconds: () => env.dominoTurnSeconds,
  seatsFor: (teamMode) => seatsFor(teamMode as TeamMode),
  deal: (mode, teamMode) => dealGame(mode as DominoMode, teamMode as TeamMode),
  apply: applyAction,
  autoAction,
  actingSeat: (state) => state.currentSeat,
  isForced: (state) => state.status === 'PLAYING' && hasOnlyForcedAction(state),
  isFinished: (state) => state.status === 'FINISHED',
  winnerSeats: (state) => state.result?.winnerSeats ?? [],
  moveCount: (state) => state.moveCount,
  viewFor,
  handOf: (state, seat) => state.hands[seat],
  summary: (state) => ({ reason: state.result?.reason ?? null, result: state.result }),
};

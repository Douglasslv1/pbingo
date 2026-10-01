import { env } from '../../config/env';
import { GameAdapter } from '../tables/tables.types';
import { actingSeat, applyAction, autoAction, dealGame, viewFor } from './truco.engine';
import { seatsFor, teamOf, TrucoAction, TrucoState, TrucoTeamMode } from './truco.types';

export const trucoAdapter: GameAdapter<TrucoState, TrucoAction> = {
  game: 'TRUCO',
  label: 'truco',
  enabled: () => env.trucoEnabled,
  free: () => false,
  turnSeconds: () => env.trucoTurnSeconds,
  seatsFor: (teamMode) => seatsFor(teamMode as TrucoTeamMode),
  deal: (_mode, teamMode) => dealGame(teamMode as TrucoTeamMode),
  apply: (state, seat, action) => applyAction(state, seat, action),
  autoAction,
  actingSeat,
  isForced: () => false,
  isFinished: (state) => state.status === 'FINISHED',
  winnerSeats: (state) =>
    state.winner === null ? [] : state.hand.hands.flatMap((_, seat) => (teamOf(seat) === state.winner ? [seat] : [])),
  moveCount: (state) => state.moveCount,
  viewFor,
  handOf: (state, seat) => state.hand.hands[seat],
  summary: (state) => ({ score: state.score, handNumber: state.handNumber, vira: state.hand.vira }),
};

import { env } from '../../config/env';
import { GameAdapter } from '../tables/tables.types';
import { actingSeat, applyAction, autoAction, dealGame, viewFor } from './truco.engine';
import { HAND_VALUES, seatsFor, teamOf, TrucoAction, TrucoState, TrucoTeamMode } from './truco.types';

const raisedFrom = (value: number) => HAND_VALUES[HAND_VALUES.indexOf(value as (typeof HAND_VALUES)[number]) + 1];

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
  // Grava a carta (a posicao na mao muda a cada jogada), a mao e a vira, para o admin reconstruir a partida
  record: (state, seat, action) => ({
    ...action,
    hand: state.handNumber,
    vira: state.hand.vira,
    ...(action.type === 'PLAY' ? { card: state.hand.hands[seat][action.index] } : {}),
    ...(action.type === 'TRUCO' ? { value: raisedFrom(state.hand.value) } : {}),
    ...(action.type === 'RAISE' && state.hand.pendingRaise ? { value: raisedFrom(state.hand.pendingRaise.value) } : {}),
  }),
};

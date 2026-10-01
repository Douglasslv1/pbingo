import { env } from '../../config/env';
import { GameAdapter, GameName } from '../tables/tables.types';
import { Color, colorOfSeat, EndAction, seatOfColor } from './board';

/** O que damas e xadrez tem em comum no estado da partida. */
export interface BoardState {
  turn: Color;
  whiteSeat: number;
  moveCount: number;
  lastMove: unknown;
  status: 'PLAYING' | 'FINISHED';
  result: { winner: Color | null; reason: string } | null;
}

interface BoardGame<S extends BoardState, A> {
  game: GameName;
  label: string;
  enabled: () => boolean;
  deal: () => S;
  apply: (state: S, color: Color, action: A | EndAction) => S;
  /** Parte da visao especifica do jogo (tabuleiro, lances permitidos se for a vez de quem ve). */
  view: (state: S, color: Color) => Record<string, unknown>;
}

/**
 * Jogos de tabuleiro mano a mano: cores sorteadas no inicio; tempo esgotado e desistencia dao a
 * vitoria ao adversario (um lance automatico estragaria a partida).
 */
export function boardAdapter<S extends BoardState, A>(board: BoardGame<S, A>): GameAdapter<S, A | EndAction> {
  return {
    game: board.game,
    label: board.label,
    enabled: board.enabled,
    free: () => env.boardGamesFree,
    turnSeconds: () => env.boardTurnSeconds,
    seatsFor: () => 2,
    deal: () => board.deal(),
    apply: (state, seat, action) => board.apply(state, colorOfSeat(state.whiteSeat, seat), action),
    autoAction: () => ({ type: 'TIMEOUT' }),
    actingSeat: (state) => seatOfColor(state.whiteSeat, state.turn),
    isForced: () => false,
    isFinished: (state) => state.status === 'FINISHED',
    winnerSeats: (state) => (state.result?.winner ? [seatOfColor(state.whiteSeat, state.result.winner)] : []),
    moveCount: (state) => state.moveCount,
    viewFor: (state, seat) => {
      const color = colorOfSeat(state.whiteSeat, seat);
      return {
        myColor: color,
        turn: state.turn,
        lastMove: state.lastMove,
        moveCount: state.moveCount,
        status: state.status,
        result: state.result,
        ...board.view(state, color),
      };
    },
    handOf: () => null,
    summary: (state) => ({ result: state.result, whiteSeat: state.whiteSeat }),
  };
}

import type { LudoAction, LudoTableView } from '../../types';
import { BASE } from './ludoGeometry';

/**
 * A peca comeca a andar na hora, antes da resposta do servidor. Captura, portal e energia vem na
 * resposta, que substitui esta previsao (se o lance for recusado, a tela volta ao estado real).
 */
export function predictLudo(table: LudoTableView, action: LudoAction): LudoTableView | null {
  const game = table.game;
  if (!game || action.type !== 'MOVE' || table.mySeat === null || game.dice === null) return null;
  const seat = table.mySeat;
  const from = game.pieces[seat][action.piece];
  const to = from === BASE ? 0 : from + game.dice + game.bonus;
  return {
    ...table,
    game: {
      ...game,
      pieces: game.pieces.map((progresses, owner) => progresses.map((progress, piece) => (owner === seat && piece === action.piece ? to : progress))),
      lastMove: { seat, piece: action.piece, from, to, captured: [], escaped: [], fortified: [], energy: [], special: null },
      legalPieces: [],
      abilityOptions: {},
    },
  };
}

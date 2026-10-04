import type { DamasAction, DamasPiece, DamasTableView, XadrezAction, XadrezTableView } from '../../types';

/**
 * Lance mostrado na hora, antes da resposta do servidor (mesmas regras dele). A resposta chega em
 * seguida e substitui esta previsao; se o lance for recusado, a tela volta ao estado real.
 */
const rowOf = (square: number) => Math.floor(square / 8);
const colOf = (square: number) => square % 8;

export function predictDamas(table: DamasTableView, action: DamasAction): DamasTableView | null {
  const game = table.game;
  if (!game || action.type !== 'MOVE') return null;
  const { path } = action;
  const board = [...game.board];
  const piece = board[path[0]]!;
  // Pecas puladas em cada trecho do caminho (a dama voa: pode haver casas vazias antes da capturada)
  path.slice(1).forEach((to, index) => {
    const from = path[index];
    const step = Math.sign(rowOf(to) - rowOf(from)) * 8 + Math.sign(colOf(to) - colOf(from));
    for (let square = from + step; square !== to; square += step) board[square] = null;
  });
  board[path[0]] = null;
  const to = path[path.length - 1];
  const promotes = (piece === 'w' && rowOf(to) === 0) || (piece === 'b' && rowOf(to) === 7);
  board[to] = promotes ? (piece.toUpperCase() as DamasPiece) : piece;
  return {
    ...table,
    game: { ...game, board, turn: game.turn === 'w' ? 'b' : 'w', lastMove: path, legalPaths: [], moveCount: game.moveCount + 1 },
  };
}

export function predictXadrez(table: XadrezTableView, action: XadrezAction): XadrezTableView | null {
  const game = table.game;
  if (!game || action.type !== 'MOVE') return null;
  const { from, to, promotion } = action;
  const board = [...game.board];
  const piece = board[from]!;
  const white = piece === piece.toUpperCase();
  const kind = piece.toUpperCase();
  // En passant: peao na diagonal para casa vazia captura o peao ao lado
  if (kind === 'P' && colOf(from) !== colOf(to) && !board[to]) board[to + (white ? 8 : -8)] = null;
  // Roque: o rei anda duas casas e a torre pula para o outro lado dele
  if (kind === 'K' && Math.abs(to - from) === 2) {
    const rookFrom = to > from ? from + 3 : from - 4;
    board[(from + to) / 2] = board[rookFrom];
    board[rookFrom] = null;
  }
  board[to] = promotion ? (white ? promotion : promotion.toLowerCase()) : piece;
  board[from] = null;
  return {
    ...table,
    game: {
      ...game,
      board,
      turn: game.turn === 'w' ? 'b' : 'w',
      lastMove: { from, to, promotion },
      legalMoves: [],
      inCheck: false,
      moveCount: game.moveCount + 1,
    },
  };
}

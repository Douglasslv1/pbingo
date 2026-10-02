import { useState } from 'react';
import type { XadrezAction, XadrezMove, XadrezTableView } from '../../types';
import Board from '../board/Board';
import BoardGameShell from '../board/BoardGameShell';

interface Props {
  table: XadrezTableView;
  busy: boolean;
  error: string | null;
  onAction: (action: XadrezAction) => void;
  onBackToLobby: () => void;
}

/** Simbolos cheios para as duas cores (a cor vem do CSS); ︎ evita virar emoji no celular. */
const GLYPH: Record<string, string> = { K: '♚', Q: '♛', R: '♜', B: '♝', N: '♞', P: '♟' };
const NAME: Record<string, string> = { K: 'rei', Q: 'dama', R: 'torre', B: 'bispo', N: 'cavalo', P: 'peão' };
const PROMOTIONS = ['Q', 'R', 'B', 'N'] as const;

const REASONS: Record<string, string> = {
  CHECKMATE: 'xeque-mate',
  RESIGN: 'o adversário desistiu',
  TIMEOUT: 'o tempo do adversário acabou',
  STALEMATE: 'empate por afogamento (quem joga não tem lance e não está em xeque)',
  FIFTY_MOVES: 'empate pela regra dos 50 lances sem captura nem movimento de peão',
  REPETITION: 'empate pela repetição da mesma posição 3 vezes',
  MATERIAL: 'empate: não há peças suficientes para dar xeque-mate',
};

const SHOUTS: Record<string, string> = { CHECKMATE: 'Xeque‑mate!', STALEMATE: 'Rei afogado!' };

export default function XadrezGame({ table, busy, error, onAction, onBackToLobby }: Props) {
  const [selected, setSelected] = useState<number | null>(null);
  /** Lance de peao ate a ultima linha, esperando a escolha da peca. */
  const [promoting, setPromoting] = useState<XadrezMove | null>(null);
  const game = table.game!;
  const myTurn = game.status === 'PLAYING' && game.turn === game.myColor;
  const movesFrom = (square: number) => game.legalMoves.filter((move) => move.from === square);
  const targets = selected === null ? [] : [...new Set(movesFrom(selected).map((move) => move.to))];

  function onSquare(square: number) {
    if (!myTurn || busy) return;
    if (selected !== null && targets.includes(square)) {
      const options = movesFrom(selected).filter((move) => move.to === square);
      if (options.some((move) => move.promotion)) setPromoting({ from: selected, to: square });
      else onAction({ type: 'MOVE', from: selected, to: square });
      setSelected(null);
      return;
    }
    setPromoting(null);
    setSelected(movesFrom(square).length > 0 ? square : null);
  }

  const pieces = game.board.map((piece) =>
    piece ? (
      <span
        className={`chess-piece ${piece === piece.toUpperCase() ? 'w' : 'b'}`}
        aria-label={`${NAME[piece.toUpperCase()]} ${piece === piece.toUpperCase() ? 'branco' : 'preto'}`}
      >
        {GLYPH[piece.toUpperCase()]}
        {'︎'}
      </span>
    ) : null,
  );
  const kingInCheck = game.inCheck ? game.board.indexOf(game.turn === 'w' ? 'K' : 'k') : null;

  const situation = !myTurn
    ? game.inCheck
      ? 'O adversário está em xeque e precisa se defender...'
      : 'Vez do adversário...'
    : promoting
      ? 'Promoção: escolha a peça que o peão vai virar.'
      : `${game.inCheck ? 'Você está em XEQUE: proteja o rei. ' : 'Sua vez: '}toque numa peça e depois na casa de destino.`;

  return (
    <BoardGameShell
      table={table}
      title="Xadrez"
      situation={situation}
      reasonText={(reason) => REASONS[reason] ?? reason}
      shouts={SHOUTS}
      busy={busy}
      error={error}
      onResign={() => onAction({ type: 'RESIGN' })}
      onBackToLobby={onBackToLobby}
    >
      <Board
        pieces={pieces}
        flipped={game.myColor === 'b'}
        selected={selected}
        targets={myTurn ? targets : []}
        lastMove={game.lastMove ? [game.lastMove.from, game.lastMove.to] : []}
        danger={kingInCheck}
        onSquare={myTurn ? onSquare : undefined}
      />
      {promoting && (
        <div className="truco-actions promotion-choice">
          {PROMOTIONS.map((promotion) => (
            <button
              key={promotion}
              type="button"
              disabled={busy}
              onClick={() => {
                onAction({ type: 'MOVE', ...promoting, promotion });
                setPromoting(null);
              }}
            >
              {GLYPH[promotion]}
              {'︎'} {NAME[promotion]}
            </button>
          ))}
        </div>
      )}
    </BoardGameShell>
  );
}

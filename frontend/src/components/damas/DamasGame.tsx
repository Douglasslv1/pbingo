import { useState } from 'react';
import type { DamasAction, DamasPiece, DamasTableView } from '../../types';
import Board from '../board/Board';
import BoardGameShell from '../board/BoardGameShell';

interface Props {
  table: DamasTableView;
  busy: boolean;
  error: string | null;
  onAction: (action: DamasAction) => void;
  onBackToLobby: () => void;
}

const REASONS: Record<string, string> = {
  NO_MOVES: 'o adversário ficou sem peças ou sem lances',
  RESIGN: 'o adversário desistiu',
  TIMEOUT: 'o tempo do adversário acabou',
  DRAW_KINGS: 'empate: 20 lances seguidos de cada lado só com damas, sem captura',
};

const startsWith = (path: number[], prefix: number[]) => prefix.every((square, i) => path[i] === square);

export default function DamasGame({ table, busy, error, onAction, onBackToLobby }: Props) {
  // Caminho escolhido ate agora: a pedra e as casas onde ela ja pousou nesta captura
  const [prefix, setPrefix] = useState<number[]>([]);
  const game = table.game!;
  const myTurn = game.status === 'PLAYING' && game.turn === game.myColor;
  const candidates = game.legalPaths.filter((path) => startsWith(path, prefix));
  // Havendo captura, o servidor so oferece capturas: basta olhar o primeiro lance
  const mustCapture = isCapture(game.board, game.legalPaths[0]);
  const targets = prefix.length > 0 ? [...new Set(candidates.map((path) => path[prefix.length]).filter((s) => s !== undefined))] : [];

  function onSquare(square: number) {
    if (!myTurn || busy) return;
    // Tocar numa pedra que pode jogar recomeca a escolha
    if (game.legalPaths.some((path) => path[0] === square)) {
      setPrefix([square]);
      return;
    }
    if (!targets.includes(square)) return;
    const next = [...prefix, square];
    const done = game.legalPaths.find((path) => path.length === next.length && startsWith(path, next));
    const more = game.legalPaths.some((path) => path.length > next.length && startsWith(path, next));
    if (done && !more) {
      onAction({ type: 'MOVE', path: next });
      setPrefix([]);
    } else setPrefix(next);
  }

  const pieces = game.board.map((piece) =>
    piece ? (
      <span className={`checker ${piece.toLowerCase()}${piece === piece.toUpperCase() ? ' king' : ''}`} aria-label={piece === 'W' || piece === 'B' ? 'dama' : 'pedra'}>
        {piece === piece.toUpperCase() && '♛︎'}
      </span>
    ) : null,
  );

  const situation = !myTurn
    ? 'Vez do adversário...'
    : prefix.length === 0
      ? mustCapture
        ? 'Sua vez: a captura é obrigatória (e pelo caminho que captura mais peças). Toque na pedra que vai capturar.'
        : 'Sua vez: toque numa pedra e depois na casa de destino.'
      : candidates.some((path) => path.length > prefix.length + 1)
        ? 'Continue a captura: toque na próxima casa destacada.'
        : 'Toque na casa destacada para concluir o lance.';

  return (
    <BoardGameShell
      table={table}
      title="Damas"
      situation={situation}
      reasonText={(reason) => REASONS[reason] ?? reason}
      busy={busy}
      error={error}
      onResign={() => onAction({ type: 'RESIGN' })}
      onBackToLobby={onBackToLobby}
    >
      <Board
        pieces={pieces}
        flipped={game.myColor === 'b'}
        selected={prefix[prefix.length - 1] ?? null}
        targets={myTurn ? targets : []}
        lastMove={game.lastMove ?? []}
        onSquare={myTurn ? onSquare : undefined}
      />
    </BoardGameShell>
  );
}

/** O lance captura alguma peca? (ha uma peca entre a origem e a primeira casa de destino) */
function isCapture(board: Array<DamasPiece | null>, path?: number[]) {
  if (!path) return false;
  const [from, to] = path;
  const dr = Math.sign((to >> 3) - (from >> 3));
  const dc = Math.sign((to & 7) - (from & 7));
  for (let r = (from >> 3) + dr, c = (from & 7) + dc; r * 8 + c !== to; r += dr, c += dc) {
    if (board[r * 8 + c]) return true;
  }
  return false;
}

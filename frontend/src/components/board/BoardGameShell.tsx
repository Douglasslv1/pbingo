import { ReactNode, useState } from 'react';
import { formatBrl } from '../../format';
import { useCountdown } from '../../hooks/useCountdown';
import { useGameConfig } from '../../hooks/useGameConfig';
import { useTurnAlert } from '../../hooks/useTurnAlert';
import type { BoardColor, BoardResult, GameTableView } from '../../types';
import GameTable from '../tables/GameTable';
import VictoryOverlay from '../tables/VictoryOverlay';

interface Props {
  table: GameTableView<{ myColor: BoardColor; turn: BoardColor; status: string; result: BoardResult | null }>;
  title: string;
  /** Frase do momento ("Sua vez: ..."), escrita pelo jogo. */
  situation: string;
  /** Explicacao do resultado (ex.: "xeque-mate"), escrita pelo jogo. */
  reasonText: (reason: string) => string;
  /** Grito do fim da partida por motivo (ex.: CHECKMATE: "Xeque-mate!"). */
  shouts?: Record<string, string>;
  busy: boolean;
  error: string | null;
  onResign: () => void;
  onBackToLobby: () => void;
  children: ReactNode;
}

const COLOR_NAME: Record<BoardColor, string> = { w: 'brancas', b: 'pretas' };
const SHOUTS: Record<string, string> = { TIMEOUT: 'Tempo esgotado!', RESIGN: 'Desistência!' };

/**
 * Moldura de uma partida de tabuleiro: jogadores e cores, cronometro de quem joga, frase da
 * situacao, desistencia (com confirmacao) e resultado. O tabuleiro vem do jogo.
 */
export default function BoardGameShell({ table, title, situation, reasonText, shouts, busy, error, onResign, onBackToLobby, children }: Props) {
  const [confirmResign, setConfirmResign] = useState(false);
  const game = table.game!;
  const playing = table.status === 'PLAYING' && game.status === 'PLAYING';
  const myTurn = playing && game.turn === game.myColor;
  const countdown = useCountdown(playing ? table.turnDeadline : null);
  const { soundOn, toggleSound } = useTurnAlert(myTurn);
  const turnSeconds = useGameConfig()?.boardTurnSeconds ?? 60;
  const urgent = countdown !== null && countdown <= 10;

  const me = table.players.find((player) => player.isMe);
  const opponent = table.players.find((player) => !player.isMe);
  const opponentColor: BoardColor = game.myColor === 'w' ? 'b' : 'w';
  const free = Number(table.prizePool) === 0;

  const mySeat = me?.seat ?? 0;
  const seats = [0, 1].map((seat) =>
    seat === mySeat
      ? { name: 'Você', titles: me?.titles, tag: COLOR_NAME[game.myColor] }
      : { name: opponent?.name ?? '...', titles: opponent?.titles, tag: COLOR_NAME[opponentColor] },
  );
  const result = game.result;
  const won = result && (result.winner === null ? null : result.winner === game.myColor);
  const detail =
    result &&
    (result.winner === null
      ? reasonText(result.reason)
      : `${won ? 'Você' : (opponent?.name ?? 'O adversário')} venceu: ${reasonText(result.reason)}.`);

  return (
    <div className="card domino-game board-game">
      <div className="domino-header">
        <span className="label">
          {title} · {free ? 'partida gratuita' : `prêmio ${formatBrl(table.prizePool)}`}
        </span>
        <button type="button" className="link" onClick={toggleSound} aria-pressed={soundOn}>
          {soundOn ? 'Som: ligado' : 'Som: desligado'}
        </button>
      </div>

      <GameTable
        seats={seats}
        mySeat={mySeat}
        turnSeat={playing ? (game.turn === game.myColor ? mySeat : 1 - mySeat) : null}
        countdown={countdown}
      >
        {children}
      </GameTable>

      {game.status === 'FINISHED' && result ? (
        <div className="domino-result">
          <VictoryOverlay
            won={won}
            headline={shouts?.[result.reason] ?? SHOUTS[result.reason] ?? (won ? 'Vitória!' : won === false ? 'Derrota' : 'Empate!')}
            detail={detail!}
          />
          <h3>
            {won === null
              ? 'Empate'
              : won
                ? `Você venceu!${me?.prizeAmount && Number(me.prizeAmount) > 0 ? ` +${formatBrl(me.prizeAmount)}` : ''}`
                : 'Fim de partida'}
          </h3>
          <p>{detail}</p>
          <button type="button" onClick={onBackToLobby}>
            Jogar de novo
          </button>
        </div>
      ) : (
        <>
          {myTurn && countdown !== null && (
            <div className={urgent ? 'turn-bar urgent' : 'turn-bar'} aria-hidden="true">
              <div style={{ width: `${Math.min((countdown / turnSeconds) * 100, 100)}%` }} />
            </div>
          )}
          <p className={myTurn ? 'domino-turn mine' : 'domino-turn'}>{situation}</p>
          {error && <p className="error">{error}</p>}
          <div className="truco-actions">
            {confirmResign ? (
              <>
                <button type="button" className="danger" onClick={onResign} disabled={busy}>
                  Confirmar: desistir da partida
                </button>
                <button type="button" className="link" onClick={() => setConfirmResign(false)}>
                  Continuar jogando
                </button>
              </>
            ) : (
              <button type="button" className="link" onClick={() => setConfirmResign(true)}>
                Desistir
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}

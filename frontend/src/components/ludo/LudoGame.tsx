import { formatBrl } from '../../format';
import { useCountdown } from '../../hooks/useCountdown';
import { useGameConfig } from '../../hooks/useGameConfig';
import { useTurnAlert } from '../../hooks/useTurnAlert';
import type { LudoAction, LudoTableView } from '../../types';
import GameTable from '../tables/GameTable';
import VictoryOverlay from '../tables/VictoryOverlay';
import LudoBoard from './LudoBoard';
import LudoDice from './LudoDice';
import { COLOR_NAMES, FINISH } from './ludoGeometry';

interface Props {
  table: LudoTableView;
  busy: boolean;
  error: string | null;
  onAction: (action: LudoAction) => void;
  onComeBack: () => void;
  onBackToLobby: () => void;
}

export default function LudoGame({ table, busy, error, onAction, onComeBack, onBackToLobby }: Props) {
  const game = table.game;
  const playing = table.status === 'PLAYING' && game?.status === 'PLAYING';
  const myTurn = playing && game?.turn === table.mySeat;
  const countdown = useCountdown(playing ? table.turnDeadline : null);
  const { soundOn, toggleSound } = useTurnAlert(myTurn);
  const turnSeconds = useGameConfig()?.ludoTurnSeconds ?? 30;
  if (!game || table.mySeat === null) return null;

  const mySeat = table.mySeat;
  const player = (seat: number) => table.players.find((p) => p.seat === seat);
  const nameOf = (seat: number) => (player(seat)?.isMe ? 'Você' : (player(seat)?.name ?? `Lugar ${seat + 1}`));
  const urgent = countdown !== null && countdown <= 10;
  const iAmAway = player(mySeat)?.away ?? false;
  const home = (seat: number) => game.pieces[seat].filter((progress) => progress === FINISH).length;
  const winner = game.result?.winner ?? null;

  const seats = game.pieces.map((_, seat) => ({
    name: nameOf(seat),
    tag: COLOR_NAMES[game.colors[seat]],
    away: player(seat)?.away,
    hand: (
      <span className="label">
        {home(seat)}/4 no centro{game.energy && ` · ⚡ ${game.energy[seat]}`}
      </span>
    ),
    className: `ludo-seat ludo-color-${game.colors[seat]}`,
  }));

  const roll = game.lastRoll;
  const situation = !playing
    ? ''
    : myTurn
      ? game.phase === 'ROLL'
        ? 'Sua vez: jogue o dado.'
        : `Você tirou ${game.dice}: toque numa peça destacada.`
      : `Vez de ${nameOf(game.turn)}...`;

  return (
    <div className="card domino-game ludo-game">
      <div className="domino-header">
        <span className="label">
          Ludo {game.mode === 'ARENA' ? 'Arena' : 'Clássico'} · {game.pieces.length === 2 ? 'mano a mano' : '4 jogadores'} ·{' '}
          {Number(table.prizePool) === 0 ? 'partida gratuita' : `prêmio ${formatBrl(table.prizePool)}`}
        </span>
        <button type="button" className="link" onClick={toggleSound} aria-pressed={soundOn}>
          {soundOn ? 'Som: ligado' : 'Som: desligado'}
        </button>
      </div>

      <GameTable seats={seats} mySeat={mySeat} turnSeat={playing ? game.turn : null} countdown={countdown}>
        <LudoBoard
          game={game}
          mySeat={mySeat}
          playable={myTurn && !busy ? game.legalPieces : []}
          onPiece={(piece) => onAction({ type: 'MOVE', piece })}
        />
      </GameTable>

      {winner !== null ? (
        <div className="domino-result">
          <VictoryOverlay
            won={winner === mySeat}
            headline={winner === mySeat ? 'Vitória!' : 'Derrota'}
            detail={`${nameOf(winner)} levou as 4 peças ao centro.`}
          />
          <h3>{winner === mySeat ? 'Você venceu!' : 'Fim de partida'}</h3>
          <p>{`${nameOf(winner)} levou as 4 peças ao centro.`}</p>
          <p className="label ludo-fairness">
            Semente dos dados: <code>{game.seed}</code>. O código mostrado durante a partida é o SHA-256 dela: com os dois,
            qualquer um confere que nenhum dado foi alterado.
          </p>
          <button type="button" onClick={onBackToLobby}>
            Jogar de novo
          </button>
        </div>
      ) : (
        <>
          {iAmAway && (
            <div className="banner away-banner">
              <span>Você ficou ausente e o sistema está jogando por você.</span>
              <button type="button" onClick={onComeBack} disabled={busy}>
                Voltei
              </button>
            </div>
          )}

          {myTurn && countdown !== null && (
            <div className={urgent ? 'turn-bar urgent' : 'turn-bar'} aria-hidden="true">
              <div style={{ width: `${Math.min((countdown / turnSeconds) * 100, 100)}%` }} />
            </div>
          )}

          <div className="ludo-controls">
            <LudoDice
              value={roll?.value ?? null}
              rollId={game.rolls}
              rolling={busy && myTurn && game.phase === 'ROLL'}
              color={roll ? game.colors[roll.seat] : null}
              onRoll={myTurn && game.phase === 'ROLL' ? () => onAction({ type: 'ROLL' }) : undefined}
            />
            <div>
              <p className={myTurn ? 'domino-turn mine' : 'domino-turn'}>{situation}</p>
              {roll && <p className="label">Último dado: {nameOf(roll.seat)} tirou {roll.value}.</p>}
            </div>
          </div>
          {game.energy && (
            <div className="ludo-energy">
              <span>⚡ Energia</span>
              <div className="ludo-energy-bar" aria-hidden="true">
                {Array.from({ length: game.maxEnergy }, (_, i) => (
                  <span key={i} className={i < game.energy![mySeat] ? 'on' : undefined} />
                ))}
              </div>
              <strong>
                {game.energy[mySeat]}/{game.maxEnergy}
              </strong>
            </div>
          )}
          {error && <p className="error">{error}</p>}
          <p className="label ludo-fairness" title={game.commitment}>
            Dados verificáveis · código {game.commitment.slice(0, 12)}
          </p>
        </>
      )}
    </div>
  );
}

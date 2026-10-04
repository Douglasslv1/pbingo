import { useState } from 'react';
import { formatBrl } from '../../format';
import type { DominoAction, DominoSide, DominoTableView, DominoTile as Tile } from '../../types';
import { useCountdown } from '../../hooks/useCountdown';
import { useTurnAlert } from '../../hooks/useTurnAlert';
import { useGameConfig } from '../../hooks/useGameConfig';
import DominoBoard from './DominoBoard';
import DominoTile, { DominoTileBack } from './DominoTile';
import { MODE_LABELS, TEAM_LABELS } from './dominoLabels';
import GameTable from '../tables/GameTable';
import VictoryOverlay from '../tables/VictoryOverlay';

interface Props {
  table: DominoTableView;
  busy: boolean;
  error: string | null;
  onAction: (action: DominoAction) => void;
  onComeBack: () => void;
  onBackToLobby: () => void;
}

const sameTile = (a: Tile, b: Tile) => a[0] === b[0] && a[1] === b[1];
const pipsOf = (hand: Tile[]) => hand.reduce((sum, tile) => sum + tile[0] + tile[1], 0);

export default function DominoGame({ table, busy, error, onAction, onComeBack, onBackToLobby }: Props) {
  const [selected, setSelected] = useState<Tile | null>(null);
  const countdown = useCountdown(table.status === 'PLAYING' ? table.turnDeadline : null);
  const { soundOn, toggleSound } = useTurnAlert(
    table.status === 'PLAYING' && table.game?.status === 'PLAYING' && table.game.currentSeat === table.mySeat,
  );
  const turnSeconds = useGameConfig()?.dominoTurnSeconds ?? 30;
  const game = table.game;
  if (!game || table.mySeat === null) return null;

  const mySeat = table.mySeat;
  const nameOf = (seat: number) => {
    const player = table.players.find((p) => p.seat === seat);
    return player?.isMe ? 'Você' : (player?.name ?? `Lugar ${seat + 1}`);
  };
  const finished = game.status === 'FINISHED';
  const myTurn = !finished && game.currentSeat === mySeat;
  const iAmAway = table.players.find((p) => p.isMe)?.away ?? false;
  const urgent = countdown !== null && countdown <= 10;

  const plays = game.legalActions.filter((a): a is Extract<DominoAction, { type: 'PLAY' }> => a.type === 'PLAY');
  const sidesFor = (tile: Tile): DominoSide[] => plays.filter((play) => sameTile(play.tile, tile)).map((p) => p.side);
  const selectedSides = selected ? sidesFor(selected) : [];
  const otherAction = game.legalActions.find((a) => a.type !== 'PLAY');

  function playTile(tile: Tile, side: DominoSide) {
    setSelected(null);
    onAction({ type: 'PLAY', tile, side });
  }

  function handleTileClick(tile: Tile) {
    const sides = sidesFor(tile);
    if (sides.length === 1) {
      playTile(tile, sides[0]);
    } else if (sides.length > 1) {
      setSelected(selected && sameTile(selected, tile) ? null : tile);
    }
  }

  const seats = game.handSizes.map((size, seat) => ({
    name: nameOf(seat),
    titles: table.players.find((p) => p.seat === seat)?.titles,
    away: table.players.find((p) => p.seat === seat)?.away,
    hand: seat !== mySeat && (
      <div className="domino-backs" aria-label={`${size} pedras`}>
        {Array.from({ length: size }, (_, i) => (
          <DominoTileBack key={i} />
        ))}
      </div>
    ),
  }));

  return (
    <div className="card domino-game">
      <div className="domino-header">
        <span className="label">
          {MODE_LABELS[table.mode]} · {TEAM_LABELS[table.teamMode]} · prêmio {formatBrl(table.prizePool)}
        </span>
        <span className="domino-header-actions">
          {table.mode === 'BURRINHO' && <span className="label">Monte: {game.boneyardSize}</span>}
          <button type="button" className="link" onClick={toggleSound} aria-pressed={soundOn}>
            {soundOn ? 'Som: ligado' : 'Som: desligado'}
          </button>
        </span>
      </div>

      <GameTable
        seats={seats}
        mySeat={mySeat}
        turnSeat={finished ? null : game.currentSeat}
        countdown={countdown}
        pairs={table.teamMode === 'PAIRS'}
      >
        <DominoBoard
          line={game.line}
          anchorIndex={game.anchorIndex}
          targetSides={myTurn && selected ? selectedSides : []}
          onPlaySide={(side) => selected && playTile(selected, side)}
        />
      </GameTable>

      {finished && game.result ? (
        <DominoResult table={table} nameOf={nameOf} onBackToLobby={onBackToLobby} />
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

          <p className={myTurn ? 'domino-turn mine' : 'domino-turn'}>
            {myTurn
              ? selected
                ? 'Escolha a ponta: toque numa ponta destacada ou nos botões abaixo'
                : `Sua vez: toque numa pedra destacada${countdown !== null ? ` (${countdown}s)` : ''}`
              : `Vez de ${nameOf(game.currentSeat)}...`}
          </p>

          {myTurn && selected && selectedSides.length > 1 && game.ends && (
            <div className="domino-side-choice">
              <button type="button" onClick={() => playTile(selected, 'LEFT')} disabled={busy}>
                Na ponta {game.ends.left} (início)
              </button>
              <button type="button" onClick={() => playTile(selected, 'RIGHT')} disabled={busy}>
                Na ponta {game.ends.right} (fim)
              </button>
            </div>
          )}

          {myTurn && otherAction && (
            <button type="button" onClick={() => onAction(otherAction)} disabled={busy}>
              {otherAction.type === 'DRAW' ? 'Comprar pedra' : 'Passar a vez'}
            </button>
          )}
        </>
      )}

      {error && <p className="error">{error}</p>}

      {!finished && (
        <div className="domino-hand">
          <span className="label">Suas pedras ({game.hand.length})</span>
          <div className="domino-hand-tiles">
            {game.hand.map((tile) => {
              const playable = myTurn && sidesFor(tile).length > 0;
              return (
                <DominoTile
                  key={`${tile[0]}-${tile[1]}`}
                  first={tile[0]}
                  second={tile[1]}
                  vertical
                  size={34}
                  selected={selected !== null && sameTile(selected, tile)}
                  highlighted={playable && !selected}
                  dimmed={myTurn && !playable}
                  onClick={playable && !busy ? () => handleTileClick(tile) : undefined}
                />
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function DominoResult({
  table,
  nameOf,
  onBackToLobby,
}: {
  table: DominoTableView;
  nameOf: (seat: number) => string;
  onBackToLobby: () => void;
}) {
  const game = table.game!;
  const result = game.result!;
  const me = table.players.find((player) => player.isMe);
  const iWon = table.mySeat !== null && result.winnerSeats.includes(table.mySeat);
  const winners = result.winnerSeats.map(nameOf).join(' e ');
  const won = result.reason === 'DOMINO' ? 'batendo' : 'com menos pontos na mão';
  const detail = `${winners} ${result.winnerSeats.length > 1 ? 'venceram' : 'venceu'} ${won}.`;

  return (
    <div className="domino-result">
      <VictoryOverlay won={iWon} headline={result.reason === 'DOMINO' ? 'Bateu!' : 'Trancou!'} detail={detail} />
      <h3>{iWon ? `Você venceu! +${formatBrl(me?.prizeAmount ?? 0)}` : 'Fim de partida'}</h3>
      <p>{result.reason === 'DOMINO' ? detail : `Jogo trancado: ${detail}`}</p>

      {game.revealedHands && (
        <div className="domino-revealed">
          {game.revealedHands.map((hand, seat) => (
            <div key={seat} className="domino-revealed-row">
              <span>
                {nameOf(seat)} · {pipsOf(hand)} pontos
                {result.winnerSeats.includes(seat) && ' · vencedor'}
              </span>
              <div className="domino-backs">
                {hand.map((tile) => (
                  <DominoTile key={`${tile[0]}-${tile[1]}`} first={tile[0]} second={tile[1]} vertical size={16} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <button type="button" onClick={onBackToLobby}>
        Jogar de novo
      </button>
    </div>
  );
}

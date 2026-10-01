import { useState } from 'react';
import { formatBrl } from '../../format';
import { useCountdown } from '../../hooks/useCountdown';
import { useGameConfig } from '../../hooks/useGameConfig';
import { useTurnAlert } from '../../hooks/useTurnAlert';
import type { TrucoAction, TrucoGameView, TrucoPlay, TrucoTableView } from '../../types';
import PlayingCard from './PlayingCard';
import { cardName, NEXT_VALUE, rankOf, SUIT_SYMBOL, SUITS, VALUE_NAME } from './trucoLabels';

interface Props {
  table: TrucoTableView;
  busy: boolean;
  error: string | null;
  onAction: (action: TrucoAction) => void;
  onComeBack: () => void;
  onBackToLobby: () => void;
}

const points = (value: number) => `${value} ${value === 1 ? 'ponto' : 'pontos'}`;

export default function TrucoGame({ table, busy, error, onAction, onComeBack, onBackToLobby }: Props) {
  const [covered, setCovered] = useState(false);
  const game = table.game;
  const myAction = table.status === 'PLAYING' && game?.status === 'PLAYING' && game.actingSeat === table.mySeat;
  const countdown = useCountdown(table.status === 'PLAYING' ? table.turnDeadline : null);
  const { soundOn, toggleSound } = useTurnAlert(myAction);
  const turnSeconds = useGameConfig()?.trucoTurnSeconds ?? 30;
  if (!game || table.mySeat === null) return null;

  const mySeat = table.mySeat;
  const seats = game.handSizes.length;
  const pairs = game.teamMode === 'PAIRS';
  const player = (seat: number) => table.players.find((p) => p.seat === seat);
  const nameOf = (seat: number) => (player(seat)?.isMe ? 'Você' : (player(seat)?.name ?? `Lugar ${seat + 1}`));
  /** Nome do time do ponto de vista do jogador: "nós/eles" nas duplas, nomes no mano a mano. */
  const teamName = (team: 0 | 1) =>
    team === game.myTeam ? (pairs ? 'nós' : 'você') : pairs ? 'eles' : nameOf((mySeat + 1) % 2);
  const finished = game.status === 'FINISHED';
  const urgent = countdown !== null && countdown <= 10;
  const iAmAway = player(mySeat)?.away ?? false;
  const has = (type: TrucoAction['type']) => game.legalActions.some((action) => action.type === type);
  const canPlay = has('PLAY');
  const canCover = game.legalActions.some((action) => action.type === 'PLAY' && action.covered);
  const others = Array.from({ length: seats - 1 }, (_, index) => (mySeat + index + 1) % seats);
  const isPartner = (seat: number) => pairs && seat % 2 === mySeat % 2;

  function play(index: number) {
    onAction({ type: 'PLAY', index, ...(covered && canCover ? { covered: true } : {}) });
    setCovered(false);
  }

  // Mesa vazia: mostra a ultima rodada (desta mao ou da anterior) para ninguem perder a carta do adversario
  const lastRound = game.rounds.at(-1) ?? game.lastHand?.rounds.at(-1) ?? null;
  const shownPlays: TrucoPlay[] = game.table.length > 0 ? game.table : (lastRound?.plays ?? []);
  const showingPrevious = game.table.length === 0 && lastRound !== null;
  const newHand = game.rounds.length === 0 && game.table.length === 0;

  return (
    <div className="card domino-game truco-game">
      <div className="domino-header">
        <span className="label">
          Truco · {pairs ? 'Duplas' : 'Mano a mano'} · prêmio {formatBrl(table.prizePool)}
        </span>
        <button type="button" className="link" onClick={toggleSound} aria-pressed={soundOn}>
          {soundOn ? 'Som: ligado' : 'Som: desligado'}
        </button>
      </div>

      <div className="truco-score" aria-label="Placar">
        {([game.myTeam, (1 - game.myTeam) as 0 | 1] as const).map((team) => (
          <div key={team} className={team === game.myTeam ? 'mine' : undefined}>
            <span className="label">{teamName(team)}</span>
            <strong>{game.score[team]}</strong>
          </div>
        ))}
        <div className="truco-value">
          <span className="label">Esta mão vale</span>
          <strong>{points(game.value)}</strong>
          {game.value > 1 && <span className="label">({VALUE_NAME[game.value]})</span>}
        </div>
      </div>

      <div className="truco-vira">
        <PlayingCard card={game.vira} size="small" />
        <p>
          Vira: <strong>{cardName(game.vira)}</strong>. Manilha: <strong>{game.manilha}</strong> - as quatro cartas{' '}
          {game.manilha} ganham de todas, nesta ordem: {[...SUITS].reverse().map((suit) => SUIT_SYMBOL[suit]).join(' > ')}.
        </p>
      </div>

      <ol className="truco-rounds" aria-label="Rodadas desta mão">
        {[0, 1, 2].map((index) => {
          const round = game.rounds[index];
          const text = !round ? '-' : round.winner === null ? 'empate' : teamName(round.winner);
          const tone = !round || round.winner === null ? '' : round.winner === game.myTeam ? 'won' : 'lost';
          return (
            <li key={index} className={tone}>
              <span className="label">{index + 1}ª rodada</span>
              <strong>{text}</strong>
            </li>
          );
        })}
      </ol>

      <div className="domino-opponents">
        {others.map((seat) => (
          <div key={seat} className={!finished && game.actingSeat === seat ? 'domino-opponent turn' : 'domino-opponent'}>
            <strong>
              {nameOf(seat)}
              {isPartner(seat) && <span className="partner-badge">parceiro</span>}
            </strong>
            {player(seat)?.away && <span className="away-badge">ausente</span>}
            {!finished && game.actingSeat === seat && countdown !== null && (
              <span className={urgent ? 'turn-timer urgent' : 'turn-timer'}>{countdown}s</span>
            )}
            <div className="truco-backs" aria-label={`${game.handSizes[seat]} cartas`}>
              {Array.from({ length: game.handSizes[seat] }, (_, i) => (
                <PlayingCard key={i} card={null} size="small" />
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className={showingPrevious ? 'truco-table previous' : 'truco-table'}>
        {showingPrevious && (
          <span className="label truco-table-title">
            {newHand ? 'Última rodada da mão anterior' : 'Rodada anterior'}
            {lastRound.winner === null ? ': empate' : `: venceu ${teamName(lastRound.winner)}`}
          </span>
        )}
        {shownPlays.length === 0 && <p className="label">Mesa vazia. As cartas jogadas aparecem aqui.</p>}
        {shownPlays.map((play) => (
          <div key={play.seat} className="truco-play">
            <PlayingCard
              card={play.card}
              manilha={play.card !== null && rankOf(play.card) === game.manilha}
              label={play.covered ? 'Carta coberta' : undefined}
            />
            <span className="label">
              {nameOf(play.seat)}
              {play.covered && ' (coberta)'}
            </span>
          </div>
        ))}
      </div>

      {finished ? (
        <TrucoResult table={table} game={game} teamName={teamName} onBackToLobby={onBackToLobby} />
      ) : (
        <>
          {newHand && game.lastHand && <p className="banner">{describeLastHand(game.lastHand, teamName)}</p>}
          {game.blind && (
            <p className="banner">
              Mão de ferro: os dois times estão com 11 pontos. Ninguém vê as próprias cartas - escolha uma às cegas. Sem
              truco, e quem vencer esta mão vence a partida.
            </p>
          )}

          {iAmAway && (
            <div className="banner away-banner">
              <span>Você ficou ausente e o sistema está jogando por você.</span>
              <button type="button" onClick={onComeBack} disabled={busy}>
                Voltei
              </button>
            </div>
          )}

          {myAction && countdown !== null && (
            <div className={urgent ? 'turn-bar urgent' : 'turn-bar'} aria-hidden="true">
              <div style={{ width: `${Math.min((countdown / turnSeconds) * 100, 100)}%` }} />
            </div>
          )}

          <p className={myAction ? 'domino-turn mine' : 'domino-turn'}>
            {myAction && countdown !== null
              ? `${describeSituation(game, mySeat, nameOf, teamName).replace(/\.$/, '')} (${countdown}s).`
              : describeSituation(game, mySeat, nameOf, teamName)}
          </p>

          <div className="truco-actions">
            {game.elevenDecision?.seat === mySeat && (
              <>
                <button type="button" onClick={() => onAction({ type: 'ACCEPT' })} disabled={busy}>
                  Jogar a mão (vale 3 pontos)
                </button>
                <button type="button" className="secondary" onClick={() => onAction({ type: 'RUN' })} disabled={busy}>
                  Correr (o adversário ganha 1 ponto)
                </button>
              </>
            )}
            {game.pendingRaise?.responderSeat === mySeat && (
              <>
                <button type="button" onClick={() => onAction({ type: 'ACCEPT' })} disabled={busy}>
                  Aceitar (a mão vale {game.pendingRaise.value})
                </button>
                <button type="button" className="secondary" onClick={() => onAction({ type: 'RUN' })} disabled={busy}>
                  Correr (o adversário ganha {points(game.value)})
                </button>
                {has('RAISE') && (
                  <button type="button" className="truco-call" onClick={() => onAction({ type: 'RAISE' })} disabled={busy}>
                    Pedir {VALUE_NAME[NEXT_VALUE[game.pendingRaise.value]]} (vale {NEXT_VALUE[game.pendingRaise.value]})
                  </button>
                )}
              </>
            )}
            {has('TRUCO') && (
              <button type="button" className="truco-call" onClick={() => onAction({ type: 'TRUCO' })} disabled={busy}>
                {game.value === 1 ? 'TRUCO!' : `Pedir ${VALUE_NAME[NEXT_VALUE[game.value]]}`} (a mão passa a valer{' '}
                {NEXT_VALUE[game.value]})
              </button>
            )}
          </div>
        </>
      )}

      {error && <p className="error">{error}</p>}

      {game.partnerHand && !finished && (
        <div className="truco-hand partner">
          <span className="label">Cartas do seu parceiro (mão de onze)</span>
          <div className="truco-hand-cards">
            {game.partnerHand.map((card) => (
              <PlayingCard key={card} card={card} manilha={rankOf(card) === game.manilha} />
            ))}
          </div>
        </div>
      )}

      {!finished && (
        <div className="truco-hand">
          <span className="label">Suas cartas</span>
          <div className="truco-hand-cards">
            {game.hand.map((card, index) => (
              <PlayingCard
                key={card ?? `blind-${index}`}
                card={card}
                size="large"
                manilha={card !== null && rankOf(card) === game.manilha}
                highlighted={canPlay && !busy}
                dimmed={myAction && !canPlay}
                label={card ? undefined : `Carta escondida ${index + 1}`}
                onClick={canPlay && !busy ? () => play(index) : undefined}
              />
            ))}
          </div>
          {canCover && (
            <label className="truco-cover">
              <input type="checkbox" checked={covered} onChange={(event) => setCovered(event.target.checked)} />
              Jogar a próxima carta coberta (virada para baixo: não vale nada e ninguém vê qual é)
            </label>
          )}
        </div>
      )}
    </div>
  );
}

type TeamName = (team: 0 | 1) => string;

/** Frase que explica o momento da partida e o que o jogador pode fazer. */
function describeSituation(game: TrucoGameView, mySeat: number, nameOf: (seat: number) => string, teamName: TeamName) {
  const eleven = game.elevenDecision;
  if (eleven) {
    if (eleven.team !== game.myTeam) {
      return `Mão de onze: ${nameOf(eleven.seat)} vê as cartas e decide se joga (a mão vale 3) ou corre (vocês ganham 1 ponto).`;
    }
    return eleven.seat === mySeat
      ? 'Mão de onze! Vocês estão com 11 pontos. Veja as cartas e decida: jogar (a mão vale 3, sem truco) ou correr (o adversário ganha 1 ponto).'
      : `Mão de onze! ${nameOf(eleven.seat)} decide se vocês jogam esta mão.`;
  }

  const raise = game.pendingRaise;
  if (raise) {
    const asked = VALUE_NAME[raise.value].toUpperCase();
    if (raise.responderSeat === mySeat) {
      return `${nameOf(raise.requesterSeat)} pediu ${asked}! Aceite (a mão passa a valer ${raise.value}), corra (o adversário ganha ${points(game.value)}) ou aumente.`;
    }
    return `${nameOf(raise.requesterSeat)} pediu ${asked}. Aguardando ${nameOf(raise.responderSeat)} responder.`;
  }

  if (game.actingSeat === mySeat) {
    if (game.blind) return 'Sua vez: escolha uma carta às cegas.';
    const canRaise = game.legalActions.some((action) => action.type === 'TRUCO');
    return `Sua vez: toque numa carta para jogar${canRaise ? ' ou peça truco antes' : ''}.`;
  }
  return `Vez de ${nameOf(game.actingSeat)}...`;
}

/** Resumo da mao que acabou de terminar (a nova ja foi distribuida). */
function describeLastHand(hand: NonNullable<TrucoGameView['lastHand']>, teamName: TeamName): string {
  if (hand.winner === null) return 'Mão anterior: as três rodadas empataram e ninguém marcou ponto.';
  const loser = teamName((1 - hand.winner) as 0 | 1);
  const ran = `${loser} ${loser === 'nós' ? 'corremos' : loser === 'eles' ? 'correram' : 'correu'}`;
  const why =
    hand.reason === 'RUN' ? ` (${ran} do pedido)` : hand.reason === 'ELEVEN_RUN' ? ` (${ran} na mão de onze)` : '';
  return `Mão anterior: +${points(hand.points)} para ${teamName(hand.winner)}${why}.`;
}

function TrucoResult({
  table,
  game,
  teamName,
  onBackToLobby,
}: {
  table: TrucoTableView;
  game: TrucoGameView;
  teamName: TeamName;
  onBackToLobby: () => void;
}) {
  const iWon = game.winner === game.myTeam;
  const pairs = game.teamMode === 'PAIRS';
  const prize = table.players.find((player) => player.isMe)?.prizeAmount;
  const mine = game.score[game.myTeam];
  const theirs = game.score[1 - game.myTeam];
  const winner = iWon ? (pairs ? 'Vocês' : 'Você') : teamName(game.winner!).replace(/^./, (c) => c.toUpperCase());

  return (
    <div className="domino-result">
      <h3>{iWon ? `Vitória! ${Number(prize) > 0 ? `+${formatBrl(prize ?? 0)}` : ''}` : 'Fim de partida'}</h3>
      <p>
        {winner} {pairs ? 'venceram' : 'venceu'} por {iWon ? mine : theirs} × {iWon ? theirs : mine}.
      </p>
      {game.lastHand && <p className="label">{describeLastHand(game.lastHand, teamName)}</p>}
      <button type="button" onClick={onBackToLobby}>
        Jogar de novo
      </button>
    </div>
  );
}

import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, ApiError } from '../api';
import AppHeader from '../components/AppHeader';
import { useAuth } from '../hooks/useAuth';
import { getSocket } from '../socket';
import type { TournamentDetail, TournamentPlayer, TournamentSummary } from '../types';
import { formatDateTime } from '../withdrawalFormat';

export const TOURNAMENT_GAMES: Record<TournamentSummary['game'], string> = {
  DOMINO: 'Dominó mano a mano',
  TRUCO: 'Truco mano a mano',
  DAMAS: 'Damas',
  XADREZ: 'Xadrez',
  LUDO: 'Ludo mano a mano',
};

const STATUS_LABELS: Record<TournamentSummary['status'], string> = {
  OPEN: 'Inscrições abertas',
  RUNNING: 'Em andamento',
  FINISHED: 'Encerrado',
  CANCELLED: 'Cancelado',
};

const MEDALS = ['🥇', '🥈', '🥉'];

function roundLabel(index: number, total: number): string {
  const fromEnd = total - index;
  if (fromEnd === 1) return 'Final';
  if (fromEnd === 2) return 'Semifinal';
  if (fromEnd === 3) return 'Quartas';
  return `Rodada ${index + 1}`;
}

const prizeLine = (prizes: number[]) => `1º ${prizes[0]} · 2º ${prizes[1]} · 3º e 4º ${prizes[2]} Venox`;

function PlayerName({ player, won, empty }: { player: TournamentPlayer | null; won: boolean; empty: string }) {
  if (!player) return <span className="bracket-player empty">{empty}</span>;
  return (
    <span className={`bracket-player${won ? ' won' : ''}${player.isMe ? ' me' : ''}`}>
      {player.name}
      {player.isMe && <span className="partner-badge">você</span>}
    </span>
  );
}

function Bracket({ tournament }: { tournament: TournamentDetail }) {
  const gamePath = `/${tournament.game.toLowerCase()}`;
  return (
    <div className="bracket">
      {tournament.rounds.map((matches, index) => (
        <div className="bracket-round" key={index}>
          <h3>{roundLabel(index, tournament.rounds.length)}</h3>
          {matches.map((match) => {
            const mine = match.players.some((player) => player?.isMe);
            return (
              <div className={`bracket-match${match.live ? ' live' : ''}`} key={match.slot}>
                {match.players.map((player, seat) => (
                  <PlayerName
                    key={seat}
                    player={player}
                    won={match.winner === seat}
                    empty={index === 0 ? 'isento' : 'a definir'}
                  />
                ))}
                {match.live && (mine ? <Link to={gamePath}>Jogar agora</Link> : <span className="hint">ao vivo</span>)}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

/** Torneios mata-mata pagos em Venox: inscricao, chave ao vivo e podio. */
export default function TournamentsPage() {
  const { auth } = useAuth();
  const token = auth?.token;
  const [list, setList] = useState<TournamentSummary[]>([]);
  const [selected, setSelected] = useState<TournamentDetail | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const selectedId = selected?.id;

  const load = useCallback(() => {
    api
      .getTournaments(token)
      .then(setList)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Erro ao carregar os torneios'));
    if (selectedId) api.getTournament(selectedId, token).then(setSelected).catch(() => undefined);
  }, [token, selectedId]);

  useEffect(load, [load]);
  useEffect(() => {
    const socket = getSocket();
    socket.on('tournament:changed', load);
    return () => {
      socket.off('tournament:changed', load);
    };
  }, [load]);

  const open = (id: string) => api.getTournament(id, token).then(setSelected).catch(() => undefined);

  const act = (id: string, join: boolean) => {
    if (!token) return;
    setBusy(true);
    setError(null);
    (join ? api.joinTournament(token, id) : api.leaveTournament(token, id))
      .then((detail) => {
        setSelected(detail);
        load();
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Erro ao processar a inscrição'))
      .finally(() => setBusy(false));
  };

  return (
    <div className="app-shell">
      <AppHeader />
      <main>
        <div className="card">
          <h1>Torneios</h1>
          <p className="hint intro-hint">
            Inscreva-se com Venox, a moeda que você ganha jogando: 10 por vitória e 2 por visita diária. Mata-mata: quem
            vence avança. Os prêmios saem do pote das inscrições, e a casa fica com 10%. Se faltar jogador na sua vez,
            vale a regra de tempo da mesa. Com menos de 4 inscritos, o torneio é cancelado e o Venox volta para você.
          </p>
          {error && <p className="error">{error}</p>}
          {list.length === 0 && <p className="hint">Nenhum torneio no momento. Volte em breve!</p>}
          <div className="tournament-list">
            {list.map((tournament) => (
              <div className={`tournament-item${tournament.id === selectedId ? ' selected' : ''}`} key={tournament.id}>
                <div>
                  <strong>{tournament.name}</strong>
                  <span className="hint">
                    {' '}
                    · {TOURNAMENT_GAMES[tournament.game]} · {STATUS_LABELS[tournament.status]}
                  </span>
                </div>
                <div className="hint">
                  {formatDateTime(tournament.startsAt)} · {tournament.players}/{tournament.size} inscritos · inscrição{' '}
                  {tournament.entryFee} Venox
                </div>
                <div className="hint">
                  {tournament.status === 'OPEN'
                    ? `Prêmio se lotar: ${prizeLine(tournament.fullPrizes)}`
                    : tournament.status !== 'CANCELLED' && `Prêmio: ${prizeLine(tournament.prizes)}`}
                </div>
                <div className="tournament-actions">
                  <button type="button" className="tab" onClick={() => open(tournament.id)}>
                    {tournament.status === 'OPEN' ? 'Ver inscritos' : 'Ver chave'}
                  </button>
                  {tournament.status === 'OPEN' &&
                    (!token ? (
                      <Link to="/app">Entre para se inscrever</Link>
                    ) : tournament.joined ? (
                      <button type="button" className="danger" disabled={busy} onClick={() => act(tournament.id, false)}>
                        Desistir
                      </button>
                    ) : (
                      <button
                        type="button"
                        disabled={busy || tournament.players >= tournament.size}
                        onClick={() => act(tournament.id, true)}
                      >
                        Inscrever ({tournament.entryFee} Venox)
                      </button>
                    ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {selected && (
          <div className="card">
            <h2>{selected.name}</h2>
            {selected.podium.length > 0 && (
              <ol className="tournament-podium">
                {selected.podium.map((player) => (
                  <li key={player.name}>
                    {MEDALS[player.placement - 1]} {player.name}
                    {player.isMe && <span className="partner-badge">você</span>} · {player.prize} Venox
                  </li>
                ))}
              </ol>
            )}
            {selected.rounds.length > 0 ? (
              <Bracket tournament={selected} />
            ) : (
              <>
                <p className="hint">
                  {selected.players} de {selected.size} inscritos. A chave é montada no horário de início, e os primeiros a
                  se inscrever passam direto da primeira rodada quando faltar adversário.
                </p>
                <ul className="tournament-entrants">
                  {selected.entrants.map((player) => (
                    <li key={player.name}>
                      {player.name}
                      {player.isMe && <span className="partner-badge">você</span>}
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

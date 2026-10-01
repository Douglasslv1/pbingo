import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, ApiError } from '../api';
import AppHeader from '../components/AppHeader';
import { useAuth } from '../hooks/useAuth';
import { useGameConfig } from '../hooks/useGameConfig';
import type { Ranking, RankingEntry, RankingGame } from '../types';

const GAMES: Array<{ value: RankingGame; label: string; unit: string }> = [
  { value: 'truco', label: 'Truco', unit: 'partidas' },
  { value: 'domino', label: 'Dominó', unit: 'partidas' },
  { value: 'damas', label: 'Damas', unit: 'partidas' },
  { value: 'xadrez', label: 'Xadrez', unit: 'partidas' },
  { value: 'bingo', label: 'Números da sorte', unit: 'rodadas' },
];
const MEDALS = ['🥇', '🥈', '🥉'];

function Row({ entry }: { entry: RankingEntry }) {
  const classes = [entry.isMe && 'me', entry.position <= 3 && 'podium'].filter(Boolean).join(' ');
  return (
    <tr className={classes || undefined}>
      <td className="ranking-position">{MEDALS[entry.position - 1] ?? `${entry.position}º`}</td>
      <td className="ranking-name">
        {entry.name}
        {entry.isMe && <span className="partner-badge">você</span>}
      </td>
      <td>{entry.wins}</td>
      <td>{entry.matches}</td>
      <td>{entry.winRate}%</td>
    </tr>
  );
}

/** Ranking publico por jogo: so apelidos, vitorias e partidas (nunca nomes reais nem premios). */
export default function RankingPage() {
  const { auth } = useAuth();
  const config = useGameConfig();
  const [game, setGame] = useState<RankingGame>('truco');
  const [period, setPeriod] = useState<'month' | 'all'>('month');
  const [ranking, setRanking] = useState<Ranking | null>(null);
  const [error, setError] = useState<string | null>(null);
  const token = auth?.token;
  const enabled: Partial<Record<RankingGame, boolean | undefined>> = {
    truco: config?.trucoEnabled,
    domino: config?.dominoEnabled,
    damas: config?.damasEnabled,
    xadrez: config?.xadrezEnabled,
  };
  const games = GAMES.filter((option) => enabled[option.value] !== false);
  const unit = GAMES.find((option) => option.value === game)!.unit;

  useEffect(() => {
    setError(null);
    api
      .getRanking(game, period, token)
      .then(setRanking)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Erro ao carregar o ranking'));
  }, [game, period, token]);

  const meOutsideTop = ranking?.me && !ranking.entries.some((entry) => entry.isMe) ? ranking.me : null;

  return (
    <div className="app-shell">
      <AppHeader />
      <main>
        <div className="card">
          <h1>Ranking</h1>
          <div className="tabs">
            {games.map((option) => (
              <button
                key={option.value}
                type="button"
                className={game === option.value ? 'tab active' : 'tab'}
                onClick={() => setGame(option.value)}
              >
                {option.label}
              </button>
            ))}
          </div>
          <div className="tabs ranking-period">
            <button type="button" className={period === 'month' ? 'tab active' : 'tab'} onClick={() => setPeriod('month')}>
              Este mês
            </button>
            <button type="button" className={period === 'all' ? 'tab active' : 'tab'} onClick={() => setPeriod('all')}>
              Geral
            </button>
          </div>

          {ranking?.testSeason && (
            <p className="banner">
              Temporada de testes: este jogo está gratuito. O ranking recomeça quando as mesas passarem a ser pagas.
            </p>
          )}
          {error && <p className="error">{error}</p>}
          {ranking && ranking.entries.length === 0 && (
            <p className="label">
              Ninguém no ranking {period === 'month' ? 'deste mês' : ''} ainda. Jogue {ranking.minMatches} {unit} para
              aparecer aqui!
            </p>
          )}

          {ranking && ranking.entries.length > 0 && (
            <table className="ranking-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Jogador</th>
                  <th>
                    <abbr title="Vitórias">Vit.</abbr>
                  </th>
                  <th>
                    <abbr title={unit === 'rodadas' ? 'Rodadas' : 'Partidas'}>{unit === 'rodadas' ? 'Rod.' : 'Part.'}</abbr>
                  </th>
                  <th>
                    <abbr title="Aproveitamento (% de vitórias)">%</abbr>
                  </th>
                </tr>
              </thead>
              <tbody>
                {ranking.entries.map((entry) => (
                  <Row key={entry.position} entry={entry} />
                ))}
                {meOutsideTop && <Row entry={meOutsideTop} />}
              </tbody>
            </table>
          )}

          {auth && ranking && !ranking.me && (
            <p className="label">
              Você ainda não está neste ranking: é preciso ter pelo menos {ranking.minMatches} {unit} no período.
            </p>
          )}
          {auth && auth.user.nickname === null && (
            <p className="hint">
              Sem apelido, você aparece como Jogador #número. <Link to="/perfil">Escolha seu apelido</Link>.
            </p>
          )}
        </div>

        <div className="card">
          <h2>Como funciona</h2>
          <ul className="ranking-rules">
            <li>Quem tem mais vitórias fica à frente; no empate, vale o maior % de vitórias, e depois quem jogou mais.</li>
            <li>
              Para aparecer é preciso ter jogado pelo menos {ranking?.minMatches ?? 5} {unit} no período.
            </li>
            <li>O ranking Este mês recomeça todo dia 1º (horário de Brasília). O Geral conta desde o início.</li>
            {ranking?.maxDailyWinsVsSame && (
              <li>
                Para o ranking ser justo, contam no máximo {ranking.maxDailyWinsVsSame} vitórias por dia contra o mesmo
                adversário (ou a mesma dupla).
              </li>
            )}
            <li>Aqui aparecem só os apelidos - nunca nomes reais nem valores de prêmios.</li>
          </ul>
        </div>
      </main>
    </div>
  );
}

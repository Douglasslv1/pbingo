import { Link, useLocation } from 'react-router-dom';
import { usePlayerStatus } from '../hooks/usePlayerStatus';

/** Aviso em qualquer pagina quando a partida do jogador no torneio esta com mesa aberta. */
export default function TournamentBanner() {
  const { activeTournament: active } = usePlayerStatus();
  const { pathname } = useLocation();

  const gamePath = active && `/${active.game.toLowerCase()}`;
  if (!active?.live || pathname === gamePath) return null;
  return (
    <div className="tournament-banner" role="status">
      🏆 Sua partida no torneio <strong>{active.name}</strong> começou!
      <Link to={gamePath!}>Jogar agora</Link>
    </div>
  );
}

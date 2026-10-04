import { useCallback, useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { api } from '../api';
import { getSocket } from '../socket';
import type { ActiveTournament } from '../types';

/** Aviso em qualquer pagina quando a partida do jogador no torneio esta com mesa aberta. */
export default function TournamentBanner({ token }: { token: string }) {
  const [active, setActive] = useState<ActiveTournament | null>(null);
  const { pathname } = useLocation();

  const refresh = useCallback(() => {
    api.getActiveTournament(token).then(setActive).catch(() => undefined);
  }, [token]);

  useEffect(refresh, [refresh, pathname]);
  useEffect(() => {
    const socket = getSocket();
    socket.on('tournament:changed', refresh);
    return () => {
      socket.off('tournament:changed', refresh);
    };
  }, [refresh]);

  const gamePath = active && `/${active.game.toLowerCase()}`;
  if (!active?.live || pathname === gamePath) return null;
  return (
    <div className="tournament-banner" role="status">
      🏆 Sua partida no torneio <strong>{active.name}</strong> começou!
      <Link to={gamePath!}>Jogar agora</Link>
    </div>
  );
}

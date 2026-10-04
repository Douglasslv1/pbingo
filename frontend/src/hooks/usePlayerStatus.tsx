import { createContext, ReactNode, useCallback, useContext, useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { api } from '../api';
import { getSocket } from '../socket';
import type { ActiveTournament, Venox } from '../types';
import { useAuth } from './useAuth';

interface PlayerStatusValue {
  venox: Venox | null;
  activeTournament: ActiveTournament | null;
  claimDaily: () => Promise<void>;
}

const PlayerStatusContext = createContext<PlayerStatusValue | null>(null);

/**
 * Saldo de Venox e torneio ativo do jogador, acima das rotas: o cabecalho de cada pagina so le
 * este estado, entao trocar de pagina nao zera o saldo (ele so e atualizado em segundo plano).
 */
export function PlayerStatusProvider({ children }: { children: ReactNode }) {
  const { auth } = useAuth();
  const token = auth?.token;
  const { pathname } = useLocation();
  const [venox, setVenox] = useState<Venox | null>(null);
  const [activeTournament, setActiveTournament] = useState<ActiveTournament | null>(null);

  const refresh = useCallback(() => {
    if (!token) return;
    api.getVenox(token).then(setVenox).catch(() => undefined);
    api.getActiveTournament(token).then(setActiveTournament).catch(() => undefined);
  }, [token]);

  // Sem login (ou ao sair), nada de saldo antigo na tela
  useEffect(() => {
    setVenox(null);
    setActiveTournament(null);
  }, [token]);

  // Atualiza ao trocar de pagina e quando uma partida ou torneio muda (vitoria, inscricao, chave)
  useEffect(refresh, [refresh, pathname]);
  useEffect(() => {
    const socket = getSocket();
    socket.on('venox:changed', refresh);
    socket.on('tournament:changed', refresh);
    return () => {
      socket.off('venox:changed', refresh);
      socket.off('tournament:changed', refresh);
    };
  }, [refresh]);

  const claimDaily = useCallback(async () => {
    if (!token) return;
    setVenox(await api.claimDailyVenox(token));
  }, [token]);

  return (
    <PlayerStatusContext.Provider value={{ venox, activeTournament, claimDaily }}>{children}</PlayerStatusContext.Provider>
  );
}

export function usePlayerStatus(): PlayerStatusValue {
  const ctx = useContext(PlayerStatusContext);
  if (!ctx) {
    throw new Error('usePlayerStatus deve ser usado dentro de PlayerStatusProvider');
  }
  return ctx;
}

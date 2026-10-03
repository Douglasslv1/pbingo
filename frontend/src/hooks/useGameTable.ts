import { useCallback, useEffect, useState } from 'react';
import { api } from '../api';
import { getSocket } from '../socket';
import type { GameTableView, TableGame } from '../types';
import { useAuth } from './useAuth';

/**
 * Mesa do jogador em um jogo (domino ou truco): carregada pela API e mantida atualizada pelo
 * WebSocket. Uma mesa encerrada continua na tela ate o jogador voltar ao salao.
 */
export function useGameTable<V extends GameTableView<unknown>>(game: TableGame) {
  const { auth } = useAuth();
  const [table, setTable] = useState<V | null>(null);
  const [loading, setLoading] = useState(true);
  /** Caiu a conexao em tempo real (a tela avisa enquanto reconecta). */
  const [offline, setOffline] = useState(false);
  const token = auth?.token;

  const refresh = useCallback(async () => {
    if (!token) return;
    const active = await api.getMyTable<V>(game, token);
    // Sem mesa ativa, mantem a encerrada que esta na tela (resultado da ultima partida)
    setTable((current) => active ?? (current && ['FINISHED', 'CANCELLED'].includes(current.status) ? current : null));
  }, [game, token]);

  useEffect(() => {
    setLoading(true);
    refresh()
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [refresh]);

  useEffect(() => {
    const socket = getSocket();

    // O servidor so envia a visao das mesas em que o jogador esta sentado
    function onTable(view: V) {
      setTable(view);
    }
    function onLeft(payload: { tableId: string }) {
      setTable((current) => (current?.id === payload.tableId ? null : current));
    }
    // Ao reconectar, busca o estado atual para nao perder jogadas feitas enquanto estava fora
    function onReconnect() {
      setOffline(false);
      refresh().catch(() => {});
    }
    function onDisconnect() {
      setOffline(true);
    }

    socket.on(`${game}:table`, onTable);
    socket.on(`${game}:left`, onLeft);
    socket.on('connect', onReconnect);
    socket.on('disconnect', onDisconnect);
    return () => {
      socket.off('disconnect', onDisconnect);
      socket.off(`${game}:table`, onTable);
      socket.off(`${game}:left`, onLeft);
      socket.off('connect', onReconnect);
    };
  }, [game, refresh]);

  return { table, setTable, loading, offline, refresh };
}

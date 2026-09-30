import { useCallback, useEffect, useState } from 'react';
import { api } from '../api';
import { getSocket } from '../socket';
import type { DominoTableView } from '../types';
import { useAuth } from './useAuth';

/**
 * Mesa de domino do jogador: carregada pela API e mantida atualizada pelo WebSocket.
 * Uma mesa encerrada continua na tela ate o jogador voltar ao salao.
 */
export function useDominoTable() {
  const { auth } = useAuth();
  const [table, setTable] = useState<DominoTableView | null>(null);
  const [loading, setLoading] = useState(true);
  const token = auth?.token;

  const refresh = useCallback(async () => {
    if (!token) return;
    const active = await api.getMyDominoTable(token);
    // Sem mesa ativa, mantem a encerrada que esta na tela (resultado da ultima partida)
    setTable((current) => active ?? (current && ['FINISHED', 'CANCELLED'].includes(current.status) ? current : null));
  }, [token]);

  useEffect(() => {
    setLoading(true);
    refresh()
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [refresh]);

  useEffect(() => {
    const socket = getSocket();

    // O servidor so envia a visao das mesas em que o jogador esta sentado
    function onTable(view: DominoTableView) {
      setTable(view);
    }
    function onLeft(payload: { tableId: string }) {
      setTable((current) => (current?.id === payload.tableId ? null : current));
    }
    // Ao reconectar, busca o estado atual para nao perder jogadas feitas enquanto estava fora
    function onReconnect() {
      refresh().catch(() => {});
    }

    socket.on('domino:table', onTable);
    socket.on('domino:left', onLeft);
    socket.on('connect', onReconnect);
    return () => {
      socket.off('domino:table', onTable);
      socket.off('domino:left', onLeft);
      socket.off('connect', onReconnect);
    };
  }, [refresh]);

  return { table, setTable, loading, refresh };
}

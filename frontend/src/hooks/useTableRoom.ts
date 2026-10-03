import { useEffect, useState } from 'react';
import { api, ApiError } from '../api';
import type { GameTableView, TableGame } from '../types';
import { useAuth } from './useAuth';
import { useGameTable } from './useGameTable';

/**
 * Tudo que a pagina de um jogo de mesa faz: saldo de chaves, entrar e sair da fila, jogar e
 * voltar de ausente. `predict` mostra a jogada na hora, antes da resposta do servidor.
 */
export function useTableRoom<V extends GameTableView<unknown>, A>(game: TableGame, predict?: (table: V, action: A) => V | null) {
  const { auth } = useAuth();
  const { table, setTable, loading, offline, refresh } = useGameTable<V>(game);
  const [keysBalance, setKeysBalance] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const token = auth!.token;

  // Saldo de chaves no salao (muda ao entrar, sair ou ter a mesa cancelada)
  useEffect(() => {
    api
      .getWallet(token)
      .then((wallet) => setKeysBalance(wallet.credits.balance))
      .catch(() => setKeysBalance(null));
  }, [token, table?.id, table?.status]);

  async function run(action: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro de conexão com o servidor');
    } finally {
      setBusy(false);
    }
  }

  return {
    table,
    loading,
    offline,
    busy,
    error,
    keysBalance,
    join: (choice: Record<string, unknown>) => run(async () => setTable(await api.joinTable<V>(game, token, choice))),
    leave: () =>
      run(async () => {
        await api.leaveTable(game, token);
        setTable(null);
      }),
    comeBack: () =>
      run(async () => {
        if (table) setTable(await api.comeBackToTable<V>(game, token, table.id));
      }),
    act: (action: A) =>
      run(async () => {
        if (!table) return;
        const predicted = predict?.(table, action);
        if (predicted) setTable(predicted);
        try {
          setTable(await api.playTable<V>(game, token, table.id, action));
        } catch (err) {
          // Jogada recusada: volta ao estado real da mesa
          await refresh().catch(() => setTable(table));
          throw err;
        }
      }),
    backToLobby: () => setTable(null),
  };
}

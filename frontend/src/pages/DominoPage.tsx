import { useEffect, useState } from 'react';
import { api, ApiError } from '../api';
import AcceptTermsCard from '../components/AcceptTermsCard';
import AppHeader from '../components/AppHeader';
import AuthForm from '../components/AuthForm';
import DominoGame from '../components/domino/DominoGame';
import DominoLobby from '../components/domino/DominoLobby';
import DominoWaiting from '../components/domino/DominoWaiting';
import { useAuth } from '../hooks/useAuth';
import { useDominoTable } from '../hooks/useDominoTable';
import type { DominoAction, DominoMode, DominoTeamMode } from '../types';

function DominoRoom() {
  const { auth } = useAuth();
  const { table, setTable, loading } = useDominoTable();
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
      setError(err instanceof ApiError ? err.message : 'Erro de conexao com o servidor');
    } finally {
      setBusy(false);
    }
  }

  const join = (mode: DominoMode, teamMode: DominoTeamMode) =>
    run(async () => setTable(await api.joinDominoQueue(token, mode, teamMode)));
  const leave = () =>
    run(async () => {
      await api.leaveDominoQueue(token);
      setTable(null);
    });
  const play = (action: DominoAction) =>
    run(async () => {
      if (table) setTable(await api.playDomino(token, table.id, action));
    });

  if (loading) {
    return <div className="card">Carregando...</div>;
  }

  if (table?.status === 'WAITING') {
    return <DominoWaiting table={table} leaving={busy} onLeave={leave} />;
  }
  if (table && (table.status === 'PLAYING' || table.status === 'FINISHED')) {
    return <DominoGame table={table} busy={busy} error={error} onAction={play} onBackToLobby={() => setTable(null)} />;
  }

  return (
    <>
      {table?.status === 'CANCELLED' && (
        <div className="banner">A mesa foi cancelada por falta de jogadores. Sua chave foi devolvida.</div>
      )}
      {error && <p className="error">{error}</p>}
      <DominoLobby keysBalance={keysBalance} joining={busy} onJoin={join} />
    </>
  );
}

export default function DominoPage() {
  const { auth } = useAuth();

  return (
    <div className="app-shell">
      <AppHeader />
      <main>
        {!auth ? <AuthForm /> : auth.user.termsAccepted === false ? <AcceptTermsCard /> : <DominoRoom />}
      </main>
    </div>
  );
}

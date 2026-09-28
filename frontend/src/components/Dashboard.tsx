import { useCallback, useEffect, useState } from 'react';
import { api } from '../api';
import { useAuth } from '../hooks/useAuth';
import { getSocket } from '../socket';
import type { RoundView, Ticket, Wallet } from '../types';
import { DrawEvent } from './BallRoulette';
import RoundPanel from './RoundPanel';
import WalletPanel from './WalletPanel';

export default function Dashboard() {
  const { auth, logout } = useAuth();
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [round, setRound] = useState<RoundView | null>(null);
  const [myTickets, setMyTickets] = useState<Ticket[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [joining, setJoining] = useState(false);
  const [lastDrawn, setLastDrawn] = useState<DrawEvent | null>(null);

  const refreshWallet = useCallback(async () => {
    if (!auth) return;
    const w = await api.getWallet(auth.token);
    setWallet(w);
  }, [auth]);

  const refreshMyTickets = useCallback(
    async (roundId: string) => {
      if (!auth) return;
      const tickets = await api.getMyTickets(auth.token, roundId);
      setMyTickets(tickets);
    },
    [auth],
  );

  const refreshRound = useCallback(async () => {
    const r = await api.getCurrentRound();
    setRound(r);
    if (r) {
      await refreshMyTickets(r.id);
      if (r.drawnNumbers.length > 0) {
        setLastDrawn({ number: r.drawnNumbers[r.drawnNumbers.length - 1], seq: 0, animate: false });
      } else {
        setLastDrawn(null);
      }
    } else {
      setMyTickets([]);
      setLastDrawn(null);
    }
  }, [refreshMyTickets]);

  useEffect(() => {
    refreshWallet();
    refreshRound();
  }, [refreshWallet, refreshRound]);

  useEffect(() => {
    if (!auth) return;
    const currentUserId = auth.user.id;
    const socket = getSocket();

    function onWaiting(payload: { roundId: string; endsAt: string }) {
      setRound({
        id: payload.roundId,
        status: 'WAITING',
        accumulatedPrize: '0',
        drawnNumbers: [],
        startedAt: new Date().toISOString(),
        waitingEndsAt: payload.endsAt,
      });
      setMyTickets([]);
      setMessage(null);
      setLastDrawn(null);
    }

    function onStarted(payload: { roundId: string }) {
      setRound((prev) => (prev && prev.id === payload.roundId ? { ...prev, status: 'IN_PROGRESS', waitingEndsAt: null } : prev));
    }

    function onNumberDrawn(payload: { roundId: string; number: number; drawnNumbers: number[] }) {
      setRound((prev) => (prev && prev.id === payload.roundId ? { ...prev, drawnNumbers: payload.drawnNumbers } : prev));
      setLastDrawn((prev) => ({ number: payload.number, seq: (prev?.seq ?? 0) + 1, animate: true }));
    }

    function onPlayerJoined(payload: { roundId: string; accumulatedPrize: string }) {
      setRound((prev) => (prev && prev.id === payload.roundId ? { ...prev, accumulatedPrize: payload.accumulatedPrize } : prev));
    }

    function onFinished(payload: { roundId: string; winnerUserId: string | null; prize: number | null }) {
      setRound((prev) => (prev && prev.id === payload.roundId ? { ...prev, status: 'FINISHED' } : prev));

      if (payload.winnerUserId && payload.winnerUserId === currentUserId) {
        setMessage(`Parabens! Voce ganhou R$ ${Number(payload.prize).toFixed(2)}!`);
        refreshWallet();
      } else if (payload.winnerUserId) {
        setMessage('Rodada encerrada. Um jogador venceu.');
      } else {
        setMessage('Rodada encerrada sem ganhador.');
      }
    }

    socket.on('round:waiting', onWaiting);
    socket.on('round:started', onStarted);
    socket.on('number:drawn', onNumberDrawn);
    socket.on('round:player_joined', onPlayerJoined);
    socket.on('round:finished', onFinished);

    return () => {
      socket.off('round:waiting', onWaiting);
      socket.off('round:started', onStarted);
      socket.off('number:drawn', onNumberDrawn);
      socket.off('round:player_joined', onPlayerJoined);
      socket.off('round:finished', onFinished);
    };
  }, [auth, refreshWallet]);

  async function handleJoinRound() {
    if (!auth || !round) return;
    setJoining(true);
    setMessage(null);
    try {
      const result = await api.joinRound(auth.token);
      await refreshWallet();
      await refreshMyTickets(result.roundId);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Erro ao comprar cartela');
    } finally {
      setJoining(false);
    }
  }

  if (!auth) return null;

  return (
    <div className="dashboard">
      <div className="dashboard-header">
        <span>Ola, {auth.user.name}</span>
        <button type="button" className="link" onClick={logout}>
          Sair
        </button>
      </div>

      {message && <div className="banner">{message}</div>}

      <WalletPanel wallet={wallet} onWalletChange={refreshWallet} />
      <RoundPanel round={round} myTickets={myTickets} onJoin={handleJoinRound} joining={joining} lastDrawn={lastDrawn} />
    </div>
  );
}

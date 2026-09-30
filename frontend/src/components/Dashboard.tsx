import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../api';
import { formatBrl } from '../format';
import { useAuth } from '../hooks/useAuth';
import { getSocket } from '../socket';
import type { RoundView, Ticket, Wallet } from '../types';
import { DrawEvent } from './BallRoulette';
import HistoryPanel from './HistoryPanel';
import RoundPanel from './RoundPanel';
import WalletPanel from './WalletPanel';

export default function Dashboard() {
  const { auth } = useAuth();
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [round, setRound] = useState<RoundView | null>(null);
  const [myTickets, setMyTickets] = useState<Ticket[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [joining, setJoining] = useState(false);
  const [lastDrawn, setLastDrawn] = useState<DrawEvent | null>(null);
  // Os handlers do WebSocket sao registrados uma vez; refs dao a eles o estado atual
  const roundIdRef = useRef<string | null>(null);
  const myTicketsRef = useRef<Ticket[]>([]);
  roundIdRef.current = round?.id ?? null;
  myTicketsRef.current = myTickets;

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

    function onWaiting(payload: RoundView) {
      setRound(payload);
      // A sala pode ser reanunciada (ex.: servidor reiniciado): so limpa o estado se for uma rodada nova
      if (payload.id !== roundIdRef.current) {
        setMyTickets([]);
        setMessage(null);
        setLastDrawn(null);
      }
    }

    function onStarted(payload: { roundId: string }) {
      setRound((prev) => (prev && prev.id === payload.roundId ? { ...prev, status: 'IN_PROGRESS', waitingEndsAt: null } : prev));
    }

    function onNumberDrawn(payload: { roundId: string; number: number; drawnNumbers: number[] }) {
      setRound((prev) => (prev && prev.id === payload.roundId ? { ...prev, drawnNumbers: payload.drawnNumbers } : prev));
      setLastDrawn((prev) => ({ number: payload.number, seq: (prev?.seq ?? 0) + 1, animate: true }));
    }

    function onPlayersChanged(payload: { roundId: string; accumulatedPrize: string; playersCount: number }) {
      setRound((prev) =>
        prev && prev.id === payload.roundId
          ? { ...prev, accumulatedPrize: payload.accumulatedPrize, playersCount: payload.playersCount }
          : prev,
      );
    }

    function onCancelled(payload: { roundId: string; playersCount: number; minPlayers: number }) {
      setRound((prev) => (prev && prev.id === payload.roundId ? { ...prev, status: 'CANCELLED' } : prev));
      if (myTicketsRef.current.length > 0) {
        setMessage(
          `Rodada cancelada: eram necessários ${payload.minPlayers} jogadores e só ${payload.playersCount} entraram. Sua chave foi devolvida.`,
        );
        refreshWallet();
      } else {
        setMessage('Rodada cancelada por falta de jogadores. A próxima sala já vai abrir.');
      }
    }

    function onFinished(payload: {
      roundId: string;
      winners: Array<{ userId: string; ticketId: string; prize: number }>;
    }) {
      setRound((prev) => (prev && prev.id === payload.roundId ? { ...prev, status: 'FINISHED' } : prev));

      const myWinnings = payload.winners.filter((winner) => winner.userId === currentUserId);
      const isTie = payload.winners.length > 1;

      if (myWinnings.length > 0) {
        const myPrize = myWinnings.reduce((sum, winner) => sum + winner.prize, 0);
        const tieNote = isTie ? ` (prêmio dividido entre ${payload.winners.length} cartelas)` : '';
        setMessage(`Parabéns! Você ganhou ${formatBrl(myPrize)}!${tieNote}`);
        refreshWallet();
      } else if (isTie) {
        setMessage(`Rodada encerrada. ${payload.winners.length} cartelas venceram e dividiram o prêmio.`);
      } else if (payload.winners.length === 1) {
        setMessage('Rodada encerrada. Um jogador venceu.');
      } else {
        setMessage('Rodada encerrada sem ganhador.');
      }
    }

    socket.on('round:waiting', onWaiting);
    socket.on('round:started', onStarted);
    socket.on('number:drawn', onNumberDrawn);
    socket.on('round:players_changed', onPlayersChanged);
    socket.on('round:cancelled', onCancelled);
    socket.on('round:finished', onFinished);

    return () => {
      socket.off('round:waiting', onWaiting);
      socket.off('round:started', onStarted);
      socket.off('number:drawn', onNumberDrawn);
      socket.off('round:players_changed', onPlayersChanged);
      socket.off('round:cancelled', onCancelled);
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

  async function handleLeaveRound() {
    if (!auth) return;
    setJoining(true);
    setMessage(null);
    try {
      await api.leaveRound(auth.token);
      setMyTickets([]);
      await refreshWallet();
      setMessage('Você saiu da rodada e sua chave foi devolvida.');
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Erro ao sair da rodada');
    } finally {
      setJoining(false);
    }
  }

  if (!auth) return null;

  return (
    <div className="dashboard">
      <p className="greeting">Olá, {auth.user.name}</p>

      {message && <div className="banner">{message}</div>}

      <WalletPanel wallet={wallet} onWalletChange={refreshWallet} />
      <RoundPanel
        round={round}
        myTickets={myTickets}
        onJoin={handleJoinRound}
        onLeave={handleLeaveRound}
        joining={joining}
        lastDrawn={lastDrawn}
      />
      <HistoryPanel />
    </div>
  );
}

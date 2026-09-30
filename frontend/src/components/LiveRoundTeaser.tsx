import { useEffect, useState } from 'react';
import { api } from '../api';
import { formatCountdown, formatTime } from '../format';
import { useCountdown } from '../hooks/useCountdown';
import { getSocket } from '../socket';
import type { RoundView } from '../types';

export default function LiveRoundTeaser() {
  const [round, setRound] = useState<RoundView | null>(null);
  const countdown = useCountdown(round?.status === 'WAITING' ? round.waitingEndsAt : null);

  useEffect(() => {
    api
      .getCurrentRound()
      .then(setRound)
      .catch(() => {});

    const socket = getSocket();

    function onWaiting(payload: RoundView) {
      setRound(payload);
    }

    function onPlayersChanged(payload: { roundId: string; accumulatedPrize: string; playersCount: number }) {
      setRound((prev) =>
        prev && prev.id === payload.roundId
          ? { ...prev, accumulatedPrize: payload.accumulatedPrize, playersCount: payload.playersCount }
          : prev,
      );
    }

    function onCancelled(payload: { roundId: string }) {
      setRound((prev) => (prev && prev.id === payload.roundId ? { ...prev, status: 'CANCELLED' } : prev));
    }

    function onStarted(payload: { roundId: string }) {
      setRound((prev) => (prev && prev.id === payload.roundId ? { ...prev, status: 'IN_PROGRESS', waitingEndsAt: null } : prev));
    }

    function onNumberDrawn(payload: { roundId: string; number: number; drawnNumbers: number[] }) {
      setRound((prev) => (prev && prev.id === payload.roundId ? { ...prev, drawnNumbers: payload.drawnNumbers } : prev));
    }

    function onFinished(payload: { roundId: string }) {
      setRound((prev) => (prev && prev.id === payload.roundId ? { ...prev, status: 'FINISHED' } : prev));
    }

    socket.on('round:waiting', onWaiting);
    socket.on('round:started', onStarted);
    socket.on('number:drawn', onNumberDrawn);
    socket.on('round:finished', onFinished);
    socket.on('round:players_changed', onPlayersChanged);
    socket.on('round:cancelled', onCancelled);

    return () => {
      socket.off('round:players_changed', onPlayersChanged);
      socket.off('round:cancelled', onCancelled);
      socket.off('round:waiting', onWaiting);
      socket.off('round:started', onStarted);
      socket.off('number:drawn', onNumberDrawn);
      socket.off('round:finished', onFinished);
    };
  }, []);

  const lastNumber = round?.drawnNumbers[round.drawnNumbers.length - 1];

  return (
    <div className="live-teaser">
      <span className="live-dot" />
      {!round && <span>Conectando aos Números da sorte ao vivo...</span>}
      {round?.status === 'WAITING' && (
        <span>
          Números da sorte: próxima rodada às {round.waitingEndsAt ? formatTime(round.waitingEndsAt) : '...'}
          {countdown !== null && ` (em ${formatCountdown(countdown)})`} - {round.playersCount}/{round.minPlayers}{' '}
          jogadores
        </span>
      )}
      {round?.status === 'IN_PROGRESS' && (
        <span>Números da sorte: sorteio ao vivo{lastNumber ? ` · último número ${lastNumber}` : ''}</span>
      )}
      {round?.status === 'FINISHED' && <span>Números da sorte: rodada encerrada - a próxima abre em instantes</span>}
      {round?.status === 'CANCELLED' && <span>Números da sorte: rodada cancelada por falta de jogadores - nova sala abrindo</span>}
    </div>
  );
}

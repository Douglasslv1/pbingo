import { useEffect, useState } from 'react';
import { api } from '../api';
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

    function onWaiting(payload: { roundId: string; endsAt: string }) {
      setRound({
        id: payload.roundId,
        status: 'WAITING',
        accumulatedPrize: '0',
        drawnNumbers: [],
        startedAt: new Date().toISOString(),
        waitingEndsAt: payload.endsAt,
      });
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

    return () => {
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
      {!round && <span>Conectando na rodada ao vivo...</span>}
      {round?.status === 'WAITING' && <span>Rodada aberta agora - fecha em {countdown ?? '...'}s</span>}
      {round?.status === 'IN_PROGRESS' && (
        <span>Sorteio em andamento{lastNumber ? ` - ultimo numero: ${lastNumber}` : ''}</span>
      )}
      {round?.status === 'FINISHED' && <span>Rodada encerrada - proxima comeca em instantes</span>}
    </div>
  );
}

import { useCallback, useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { api } from '../api';
import { getSocket } from '../socket';
import type { Venox } from '../types';

/** Saldo de Venox no cabecalho, com o resgate da visita diaria enquanto ele estiver disponivel. */
export default function VenoxBadge({ token }: { token: string }) {
  const [venox, setVenox] = useState<Venox | null>(null);
  const [claiming, setClaiming] = useState(false);
  const { pathname } = useLocation();

  const refresh = useCallback(() => {
    api.getVenox(token).then(setVenox).catch(() => undefined);
  }, [token]);

  // Atualiza ao trocar de pagina e quando uma partida termina (vitoria rende Venox)
  useEffect(refresh, [refresh, pathname]);
  useEffect(() => {
    const socket = getSocket();
    socket.on('venox:changed', refresh);
    return () => {
      socket.off('venox:changed', refresh);
    };
  }, [refresh]);

  const claim = () => {
    setClaiming(true);
    api
      .claimDailyVenox(token)
      .then(setVenox)
      .catch(() => undefined)
      .finally(() => setClaiming(false));
  };

  if (!venox) return null;
  return (
    <span className="venox-badge" title={`Venox: ${venox.perWin} por vitória e ${venox.dailyAmount} por visita diária`}>
      <span className="venox-balance">{venox.balance} Venox</span>
      {!venox.dailyClaimed && (
        <button type="button" className="venox-claim" onClick={claim} disabled={claiming}>
          +{venox.dailyAmount} diário
        </button>
      )}
    </span>
  );
}

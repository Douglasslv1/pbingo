import { useState } from 'react';
import { usePlayerStatus } from '../hooks/usePlayerStatus';

/** Saldo de Venox no cabecalho, com o resgate da visita diaria enquanto ele estiver disponivel. */
export default function VenoxBadge() {
  const { venox, claimDaily } = usePlayerStatus();
  const [claiming, setClaiming] = useState(false);

  const claim = () => {
    setClaiming(true);
    claimDaily()
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

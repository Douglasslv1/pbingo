import { useState } from 'react';
import { Link } from 'react-router-dom';
import { formatBrl } from '../../format';
import { useGameConfig } from '../../hooks/useGameConfig';
import type { TrucoTeamMode } from '../../types';
import OptionCards from '../tables/OptionCards';
import StakePicker from '../tables/StakePicker';
import TrucoRules from './TrucoRules';

interface Props {
  keysBalance: number | null;
  joining: boolean;
  onJoin: (choice: { teamMode: TrucoTeamMode; stake: number }) => void;
}

const TEAM_MODES = [
  { value: 'DUEL' as const, title: 'Mano a mano', description: '2 jogadores, um contra o outro. Quem vencer leva o prêmio.' },
  {
    value: 'PAIRS' as const,
    title: 'Duplas',
    description: '4 jogadores, parceiro sentado à sua frente. A dupla vencedora divide o prêmio.',
  },
];

export default function TrucoLobby({ keysBalance, joining, onJoin }: Props) {
  const config = useGameConfig();
  const [teamMode, setTeamMode] = useState<TrucoTeamMode>('DUEL');
  const [stake, setStake] = useState(1);
  const [showRules, setShowRules] = useState(false);

  const keyPrice = config ? config.creditPriceBrl * config.ticketPriceCredits : null;
  const hasKeys = keysBalance === null || keysBalance >= stake;

  return (
    <div className="card">
      <h2>Truco Paulista</h2>
      <p className="hint intro-hint">
        Partida até 12 pontos, com manilha pela vira. Cada jogador tem {config?.trucoTurnSeconds ?? 30}s para agir. A
        partida começa assim que a mesa completar; se não completar em alguns minutos, suas chaves voltam.
      </p>

      <button type="button" className="link" onClick={() => setShowRules(!showRules)} aria-expanded={showRules}>
        {showRules ? 'Esconder as regras' : 'Ver as regras completas (recomendado antes de jogar)'}
      </button>
      {showRules && <TrucoRules />}

      <OptionCards label="Formato" options={TEAM_MODES} value={teamMode} onChange={setTeamMode} />
      <StakePicker
        value={stake}
        onChange={setStake}
        seats={teamMode === 'PAIRS' ? 4 : 2}
        winners={teamMode === 'PAIRS' ? 2 : 1}
      />

      {hasKeys ? (
        <button type="button" onClick={() => onJoin({ teamMode, stake })} disabled={joining}>
          {joining
            ? 'Entrando...'
            : `Entrar na mesa (${stake} ${stake === 1 ? 'chave' : 'chaves'}${keyPrice ? ` = ${formatBrl(stake * keyPrice)}` : ''})`}
        </button>
      ) : (
        <p className="hint">
          Chaves insuficientes para esta mesa. <Link to="/app">Compre chaves via Pix</Link> para jogar.
        </p>
      )}
      {keysBalance !== null && <p className="label domino-keys">Suas chaves: {keysBalance}</p>}
    </div>
  );
}

import { useState } from 'react';
import { Link } from 'react-router-dom';
import { formatBrl } from '../../format';
import { useGameConfig } from '../../hooks/useGameConfig';
import type { DominoMode, DominoTeamMode } from '../../types';
import OptionCards from '../tables/OptionCards';
import StakePicker from '../tables/StakePicker';
import { seatsFor } from './dominoLabels';

interface Props {
  keysBalance: number | null;
  joining: boolean;
  onJoin: (choice: { mode: DominoMode; teamMode: DominoTeamMode; stake: number }) => void;
}

const MODES = [
  {
    value: 'SIX_TILES' as const,
    title: '6 peças',
    description: 'Cada um recebe 6 pedras e as 4 que sobram ficam dormindo. Sem pedra que encaixe, passa a vez.',
  },
  {
    value: 'BURRINHO' as const,
    title: 'Burrinho',
    description: 'Cada um recebe 6 pedras e as 4 que sobram viram o monte. Sem pedra que encaixe, compra até poder jogar.',
  },
];

const TEAM_MODES = [
  { value: 'INDIVIDUAL' as const, title: 'Individual', description: 'Cada um por si. Quem bater leva o prêmio.' },
  { value: 'PAIRS' as const, title: 'Duplas', description: 'Parceiro sentado à sua frente. A dupla vencedora divide o prêmio.' },
  { value: 'DUEL' as const, title: 'Mano a mano', description: 'Só 2 jogadores, partida mais curta. Apenas no 6 peças.' },
];

export default function DominoLobby({ keysBalance, joining, onJoin }: Props) {
  const config = useGameConfig();
  const [mode, setMode] = useState<DominoMode>('SIX_TILES');
  const [teamMode, setTeamMode] = useState<DominoTeamMode>('INDIVIDUAL');
  const [stake, setStake] = useState(1);

  const free = config?.dominoFree ?? false;
  const seats = seatsFor(teamMode);
  const keyPrice = config ? config.creditPriceBrl * config.ticketPriceCredits : null;
  const entry = free ? 'grátis' : `${stake} ${stake === 1 ? 'chave' : 'chaves'}${keyPrice ? ` = ${formatBrl(stake * keyPrice)}` : ''}`;
  const hasKeys = free || keysBalance === null || keysBalance >= stake;

  const pickMode = (value: DominoMode) => {
    setMode(value);
    if (value === 'BURRINHO' && teamMode === 'DUEL') setTeamMode('INDIVIDUAL');
  };

  return (
    <div className="card">
      <h2>Dominó</h2>
      <p className="hint intro-hint">
        Mesas de 4 jogadores (2 no mano a mano). A partida começa assim que a mesa completar.
        {free
          ? ' Durante os testes a entrada é grátis e não há prêmio.'
          : ' Se a mesa não completar em alguns minutos, suas chaves voltam.'}
      </p>

      <OptionCards label="Modalidade" options={MODES} value={mode} onChange={pickMode} />
      <OptionCards
        label="Formato"
        options={TEAM_MODES.map((option) => ({ ...option, disabled: option.value === 'DUEL' && mode === 'BURRINHO' }))}
        value={teamMode}
        onChange={setTeamMode}
      />
      {!free && <StakePicker value={stake} onChange={setStake} seats={seats} winners={teamMode === 'PAIRS' ? 2 : 1} />}

      {hasKeys ? (
        <button type="button" onClick={() => onJoin({ mode, teamMode, stake })} disabled={joining}>
          {joining ? 'Entrando...' : `Entrar na mesa (${entry})`}
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

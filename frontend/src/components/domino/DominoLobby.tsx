import { useState } from 'react';
import { Link } from 'react-router-dom';
import { formatBrl } from '../../format';
import { useGameConfig } from '../../hooks/useGameConfig';
import type { DominoMode, DominoTeamMode } from '../../types';
import { seatsFor } from './dominoLabels';

interface Props {
  keysBalance: number | null;
  joining: boolean;
  onJoin: (mode: DominoMode, teamMode: DominoTeamMode) => void;
}

const MODES: Array<{ value: DominoMode; title: string; description: string }> = [
  {
    value: 'SIX_TILES',
    title: '6 peças',
    description: 'Cada um recebe 6 pedras e as 4 que sobram ficam dormindo. Sem pedra que encaixe, passa a vez.',
  },
  {
    value: 'BURRINHO',
    title: 'Burrinho',
    description: 'Cada um recebe 6 pedras e as 4 que sobram viram o monte. Sem pedra que encaixe, compra até poder jogar.',
  },
];

const TEAM_MODES: Array<{ value: DominoTeamMode; title: string; description: string }> = [
  { value: 'INDIVIDUAL', title: 'Individual', description: 'Cada um por si. Quem bater leva o prêmio.' },
  { value: 'PAIRS', title: 'Duplas', description: 'Parceiro sentado à sua frente. A dupla vencedora divide o prêmio.' },
  { value: 'DUEL', title: 'Mano a mano', description: 'Só 2 jogadores, partida mais curta. Apenas no 6 peças.' },
];

export default function DominoLobby({ keysBalance, joining, onJoin }: Props) {
  const config = useGameConfig();
  const [mode, setMode] = useState<DominoMode>('SIX_TILES');
  const [teamMode, setTeamMode] = useState<DominoTeamMode>('INDIVIDUAL');

  const free = config?.dominoFree ?? false;
  const pot = config ? config.prizeContributionPerTicket * seatsFor(teamMode) : null;
  const prizeText =
    pot === null || free
      ? ''
      : teamMode === 'PAIRS'
        ? `${formatBrl(pot / 2)} para cada vencedor da dupla`
        : `${formatBrl(pot)} para quem vencer`;
  const ticketPrice = config ? formatBrl(config.creditPriceBrl * config.ticketPriceCredits) : null;
  const entry = free ? 'grátis' : `1 chave${ticketPrice ? ` = ${ticketPrice}` : ''}`;
  const hasKeys = free || keysBalance === null || keysBalance > 0;

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
          : ` Você entra com 1 chave${ticketPrice ? ` (${ticketPrice})` : ''}; se a mesa não completar em alguns minutos, ela volta.`}
      </p>

      <span className="label">Modalidade</span>
      <div className="option-cards">
        {MODES.map((option) => (
          <button
            key={option.value}
            type="button"
            className={mode === option.value ? 'option-card active' : 'option-card'}
            onClick={() => pickMode(option.value)}
            aria-pressed={mode === option.value}
          >
            <strong>{option.title}</strong>
            <span>{option.description}</span>
          </button>
        ))}
      </div>

      <span className="label">Formato</span>
      <div className="option-cards">
        {TEAM_MODES.map((option) => (
          <button
            key={option.value}
            type="button"
            className={teamMode === option.value ? 'option-card active' : 'option-card'}
            onClick={() => setTeamMode(option.value)}
            aria-pressed={teamMode === option.value}
            disabled={option.value === 'DUEL' && mode === 'BURRINHO'}
          >
            <strong>{option.title}</strong>
            <span>{option.description}</span>
          </button>
        ))}
      </div>

      {prizeText && (
        <p className="domino-prize">
          Prêmio: <strong>{prizeText}</strong>
        </p>
      )}

      {hasKeys ? (
        <button type="button" onClick={() => onJoin(mode, teamMode)} disabled={joining}>
          {joining ? 'Entrando...' : `Entrar na mesa (${entry})`}
        </button>
      ) : (
        <p className="hint">
          Você não tem chaves. <Link to="/app">Compre chaves via Pix</Link> para jogar.
        </p>
      )}
      {keysBalance !== null && <p className="label domino-keys">Suas chaves: {keysBalance}</p>}
    </div>
  );
}

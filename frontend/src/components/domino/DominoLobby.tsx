import { useState } from 'react';
import { Link } from 'react-router-dom';
import { formatBrl } from '../../format';
import { useGameConfig } from '../../hooks/useGameConfig';
import type { DominoMode, DominoTeamMode } from '../../types';

interface Props {
  keysBalance: number | null;
  joining: boolean;
  onJoin: (mode: DominoMode, teamMode: DominoTeamMode) => void;
}

const MODES: Array<{ value: DominoMode; title: string; description: string }> = [
  {
    value: 'SIX_TILES',
    title: '6 pecas',
    description: 'Cada um recebe 6 pedras e as 4 que sobram ficam dormindo. Sem pedra que encaixe, passa a vez.',
  },
  {
    value: 'BURRINHO',
    title: 'Burrinho',
    description: 'Cada um recebe 6 pedras e as 4 que sobram viram o monte. Sem pedra que encaixe, compra ate poder jogar.',
  },
];

const TEAM_MODES: Array<{ value: DominoTeamMode; title: string; description: string }> = [
  { value: 'INDIVIDUAL', title: 'Individual', description: 'Cada um por si. Quem bater leva o premio.' },
  { value: 'PAIRS', title: 'Duplas', description: 'Parceiro sentado a sua frente. A dupla vencedora divide o premio.' },
];

export default function DominoLobby({ keysBalance, joining, onJoin }: Props) {
  const config = useGameConfig();
  const [mode, setMode] = useState<DominoMode>('SIX_TILES');
  const [teamMode, setTeamMode] = useState<DominoTeamMode>('INDIVIDUAL');

  const pot = config ? config.prizeContributionPerTicket * 4 : null;
  const prizeText =
    pot === null ? '' : teamMode === 'PAIRS' ? `${formatBrl(pot / 2)} para cada vencedor da dupla` : `${formatBrl(pot)} para quem vencer`;
  const ticketPrice = config ? formatBrl(config.creditPriceBrl * config.ticketPriceCredits) : null;
  const hasKeys = keysBalance === null || keysBalance > 0;

  return (
    <div className="card">
      <h2>Domino</h2>
      <p className="hint intro-hint">
        Mesas de 4 jogadores. Voce entra com 1 chave{ticketPrice ? ` (${ticketPrice})` : ''} e a partida comeca assim que a mesa
        completar. Se nao completar em alguns minutos, sua chave volta.
      </p>

      <span className="label">Modalidade</span>
      <div className="option-cards">
        {MODES.map((option) => (
          <button
            key={option.value}
            type="button"
            className={mode === option.value ? 'option-card active' : 'option-card'}
            onClick={() => setMode(option.value)}
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
          >
            <strong>{option.title}</strong>
            <span>{option.description}</span>
          </button>
        ))}
      </div>

      {prizeText && (
        <p className="domino-prize">
          Premio: <strong>{prizeText}</strong>
        </p>
      )}

      {hasKeys ? (
        <button type="button" onClick={() => onJoin(mode, teamMode)} disabled={joining}>
          {joining ? 'Entrando...' : `Entrar na mesa (1 chave${ticketPrice ? ` = ${ticketPrice}` : ''})`}
        </button>
      ) : (
        <p className="hint">
          Voce nao tem chaves. <Link to="/app">Compre chaves via Pix</Link> para jogar.
        </p>
      )}
      {keysBalance !== null && <p className="label domino-keys">Suas chaves: {keysBalance}</p>}
    </div>
  );
}

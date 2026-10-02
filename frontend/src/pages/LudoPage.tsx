import { useState } from 'react';
import GamePage from '../components/GamePage';
import HistoryPanel from '../components/HistoryPanel';
import LudoGame from '../components/ludo/LudoGame';
import LudoRules from '../components/ludo/LudoRules';
import OptionCards from '../components/tables/OptionCards';
import TableWaiting from '../components/tables/TableWaiting';
import { useGameConfig } from '../hooks/useGameConfig';
import { useTableRoom } from '../hooks/useTableRoom';
import type { LudoAction, LudoMode, LudoTableView, LudoTeamMode } from '../types';

const MODES = [
  { value: 'CLASSICO' as const, title: 'Clássico', description: 'O Ludo de sempre: dado, peças e capturas.' },
  {
    value: 'ARENA' as const,
    title: 'Arena',
    description: 'Ganhe energia ⚡ capturando e nas casas de energia, e gaste em habilidades: escudo, impulso, puxão e mais.',
  },
];

const TEAM_MODES = [
  { value: 'DUEL' as const, title: 'Mano a mano', description: '2 jogadores em cores opostas. Partida mais rápida.' },
  { value: 'INDIVIDUAL' as const, title: '4 jogadores', description: 'Cada um por si, uma cor em cada canto do tabuleiro.' },
];

function LudoRoom() {
  const config = useGameConfig();
  const room = useTableRoom<LudoTableView, LudoAction>('ludo');
  const [mode, setMode] = useState<LudoMode>('CLASSICO');
  const [teamMode, setTeamMode] = useState<LudoTeamMode>('DUEL');
  const [showRules, setShowRules] = useState(false);
  const { table } = room;
  const free = config?.ludoFree ?? true;

  if (room.loading) return <div className="card">Carregando...</div>;

  if (table?.status === 'WAITING') {
    return (
      <TableWaiting
        table={table}
        subtitle={`Ludo ${MODES.find((option) => option.value === table.mode)?.title} · ${TEAM_MODES.find((option) => option.value === table.teamMode)?.title}`}
        seatCount={table.teamMode === 'DUEL' ? 2 : 4}
        pairs={false}
        free={free}
        leaving={room.busy}
        onLeave={room.leave}
      />
    );
  }
  if (table && (table.status === 'PLAYING' || table.status === 'FINISHED')) {
    return (
      <LudoGame
        table={table}
        busy={room.busy}
        error={room.error}
        onAction={room.act}
        onComeBack={room.comeBack}
        onBackToLobby={room.backToLobby}
      />
    );
  }

  return (
    <>
      {table?.status === 'CANCELLED' && <div className="banner">A mesa foi cancelada: ninguém apareceu a tempo.</div>}
      {room.error && <p className="error">{room.error}</p>}
      <div className="card">
        <h2>Ludo</h2>
        <p className="hint intro-hint">
          Jogue o dado, tire suas peças da base e leve as 4 ao centro antes dos outros. {config?.ludoTurnSeconds ?? 30}s por
          jogada.{free && ' Durante os testes a partida é grátis e não há prêmio.'}
        </p>
        <button type="button" className="link" onClick={() => setShowRules(!showRules)} aria-expanded={showRules}>
          {showRules ? 'Esconder as regras' : 'Ver as regras completas'}
        </button>
        {showRules && <LudoRules />}

        <OptionCards label="Modalidade" options={MODES} value={mode} onChange={setMode} />
        <OptionCards label="Formato" options={TEAM_MODES} value={teamMode} onChange={setTeamMode} />
        <button type="button" onClick={() => room.join({ mode, teamMode })} disabled={room.busy}>
          {room.busy ? 'Entrando...' : `Entrar na mesa${free ? ' (grátis)' : ''}`}
        </button>
      </div>
      <HistoryPanel initialTab="ludo" />
    </>
  );
}

export default function LudoPage() {
  return (
    <GamePage>
      <LudoRoom />
    </GamePage>
  );
}

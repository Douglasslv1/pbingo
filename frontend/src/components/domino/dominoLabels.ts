import type { DominoMode, DominoTeamMode } from '../../types';

export const MODE_LABELS: Record<DominoMode, string> = {
  SIX_TILES: '6 peças',
  BURRINHO: 'Burrinho',
};

export const TEAM_LABELS: Record<DominoTeamMode, string> = {
  INDIVIDUAL: 'Individual',
  PAIRS: 'Duplas',
  DUEL: 'Mano a mano',
};

export const seatsFor = (teamMode: DominoTeamMode): number => (teamMode === 'DUEL' ? 2 : 4);

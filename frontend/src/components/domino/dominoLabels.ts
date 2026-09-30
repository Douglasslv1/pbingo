import type { DominoMode, DominoTeamMode } from '../../types';

export const MODE_LABELS: Record<DominoMode, string> = {
  SIX_TILES: '6 pecas',
  BURRINHO: 'Burrinho',
};

export const TEAM_LABELS: Record<DominoTeamMode, string> = {
  INDIVIDUAL: 'Individual',
  PAIRS: 'Duplas',
};

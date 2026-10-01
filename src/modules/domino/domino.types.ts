/** Pedra de domino: sempre com o menor valor primeiro (ex.: [2, 5]). */
export type Tile = readonly [number, number];

/** SIX_TILES: as 4 pedras que sobram "dormem". BURRINHO: sobram 4 para compra. */
export type DominoMode = 'SIX_TILES' | 'BURRINHO';

/** PAIRS: parceiros sentados em frente (lugares 0 e 2 contra 1 e 3). DUEL: mano a mano, so no 6 pecas. */
export type TeamMode = 'INDIVIDUAL' | 'PAIRS' | 'DUEL';

export type Side = 'LEFT' | 'RIGHT';

export type DominoAction = { type: 'PLAY'; tile: Tile; side: Side } | { type: 'DRAW' } | { type: 'PASS' };

/** Pedra na mesa ja virada: `left` encosta na pedra a esquerda, `right` na pedra a direita. */
export interface PlacedTile {
  tile: Tile;
  left: number;
  right: number;
}

export interface DominoResult {
  reason: 'DOMINO' | 'BLOCKED';
  /** Lugares que dividem o premio (mais de um em dupla ou empate). */
  winnerSeats: number[];
  /** Soma dos pontos que sobraram na mao de cada lugar. */
  pips: number[];
}

export interface DominoState {
  mode: DominoMode;
  teamMode: TeamMode;
  hands: Tile[][];
  /** Monte de compra (burrinho) ou pedras que dormem (6 pecas). */
  boneyard: Tile[];
  line: PlacedTile[];
  /** Primeira pedra jogada: fica fixa no centro da mesa (ausente em partidas antigas). */
  firstTile?: Tile;
  currentSeat: number;
  /** A primeira jogada precisa ser esta pedra (a maior carroca distribuida). */
  openingTile: Tile | null;
  consecutivePasses: number;
  moveCount: number;
  status: 'PLAYING' | 'FINISHED';
  result: DominoResult | null;
}

export const seatsFor = (teamMode: TeamMode): number => (teamMode === 'DUEL' ? 2 : 4);
export const TILES_PER_HAND = 6;

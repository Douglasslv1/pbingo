import type { AbilityId } from './ludo.abilities';
import { LUDO_CONFIG, LUDO_MODES, LudoMode } from './ludo.config';
import type { LudoState } from './ludo.engine';
import { COLOR_OFFSET, FINISH, LAST_TRACK, randomAt, TRACK_LENGTH } from './ludo.engine';

export type LudoTile = keyof typeof LUDO_CONFIG.tiles;
export type LudoEventId = keyof typeof LUDO_CONFIG.events;

/** O que a casa especial fez com a peca que parou nela (alem da energia, que fica na conta do movimento). */
export type LudoSpecial =
  | { tile: 'PORTAL'; to: number }
  | { tile: 'CHEST'; ability: AbilityId }
  | { tile: 'EVENT'; event: LudoEventId };

const tileEnabled = (mode: LudoMode, tile: LudoTile) =>
  tile === 'ENERGY' ? LUDO_MODES[mode].energyEnabled : tile === 'EVENT' ? LUDO_MODES[mode].eventsEnabled : LUDO_MODES[mode].specialTilesEnabled;

/** Casas especiais da modalidade, por casa do tabuleiro (0..51): as mesmas em cada quarto da volta. */
export const boardTiles = (mode: LudoMode): Record<number, LudoTile> =>
  Object.fromEntries(
    (Object.entries(LUDO_CONFIG.tiles) as Array<[LudoTile, number[]]>)
      .filter(([tile]) => tileEnabled(mode, tile))
      .flatMap(([tile, offsets]) =>
        Array.from({ length: TRACK_LENGTH / COLOR_OFFSET }).flatMap((_, quarter) =>
          offsets.map((offset) => [quarter * COLOR_OFFSET + offset, tile]),
        ),
      ),
  );

const raise = (values: number[], amount: number, max: number) => values.map((value) => Math.min(value + amount, max));

/** Eventos sorteados nas casas de evento: neutros, valem para todos. */
const EVENTS: Record<LudoEventId, { validate(state: LudoState): boolean; execute(state: LudoState): LudoState }> = {
  /** Avanco geral: as pecas na volta andam juntas, sem capturar ninguem e sem chegar ao centro. */
  ADVANCE: {
    validate: () => true,
    execute: (state) => ({
      ...state,
      pieces: state.pieces.map((progresses) =>
        progresses.map((progress) =>
          progress >= 0 && progress <= LAST_TRACK ? Math.min(progress + LUDO_CONFIG.events.ADVANCE.squares, FINISH - 1) : progress,
        ),
      ),
    }),
  },
  ENERGY: {
    validate: (state) => LUDO_MODES[state.mode].energyEnabled,
    execute: (state) => ({ ...state, energy: raise(state.energy, LUDO_CONFIG.events.ENERGY.energy, LUDO_CONFIG.maxEnergy) }),
  },
  CHARGE: {
    validate: (state) => LUDO_MODES[state.mode].ultimatesEnabled,
    execute: (state) => ({ ...state, ultimate: raise(state.ultimate, LUDO_CONFIG.events.CHARGE.charge, LUDO_CONFIG.ultimateMax) }),
  },
};

/** Sorteio com a semente da partida (como os dados), usando o proximo numero da sequencia. */
function draw<T>(state: LudoState, items: T[], weight: (item: T) => number = () => 1): T {
  let value = randomAt(state.seed, state.rolls, items.reduce((total, item) => total + weight(item), 0));
  return items.find((item) => (value -= weight(item)) < 0)!;
}

/** Aplica a casa especial onde a peca parou: portal, bau ou evento. */
export function landOn(state: LudoState, seat: number, piece: number, square: number | null): { state: LudoState; special: LudoSpecial | null } {
  const tiles = boardTiles(state.mode);
  const tile = square === null ? undefined : tiles[square];
  if (tile === 'PORTAL') {
    // Vai ao proximo portal, sem passar da entrada da reta final; la nao captura ninguem
    const distance = Array.from({ length: TRACK_LENGTH - 1 }, (_, i) => i + 1).find((d) => tiles[(square! + d) % TRACK_LENGTH] === 'PORTAL')!;
    const to = state.pieces[seat][piece] + distance;
    if (to > LAST_TRACK) return { state, special: null };
    const pieces = state.pieces.map((progresses, owner) => progresses.map((progress, i) => (owner === seat && i === piece ? to : progress)));
    return { state: { ...state, pieces }, special: { tile, to } };
  }
  if (tile === 'CHEST' && !state.chest[seat]) {
    const ability = draw(state, LUDO_CONFIG.chestAbilities as AbilityId[]);
    const chest = state.chest.map((held, i) => (i === seat ? ability : held));
    return { state: { ...state, chest, rolls: state.rolls + 1 }, special: { tile, ability } };
  }
  if (tile === 'EVENT') {
    const valid = (Object.keys(EVENTS) as LudoEventId[]).filter((id) => EVENTS[id].validate(state));
    const event = draw(state, valid, (id) => LUDO_CONFIG.events[id].weight);
    return { state: EVENTS[event].execute({ ...state, rolls: state.rolls + 1 }), special: { tile, event } };
  }
  return { state, special: null };
}

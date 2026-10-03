import { playTones } from '../../sounds';
import type { LudoGameView, LudoLogEntry } from '../../types';

const SOUNDS: Record<string, [Array<[number, number]>, OscillatorType]> = {
  win: [[[523, 0], [659, 0.12], [784, 0.24], [1047, 0.36]], 'triangle'],
  lose: [[[392, 0], [330, 0.15], [262, 0.3]], 'triangle'],
  ultimate: [[[392, 0], [523, 0.08], [659, 0.16], [784, 0.24]], 'sawtooth'],
  capture: [[[330, 0], [220, 0.1]], 'sawtooth'],
  special: [[[880, 0], [1175, 0.1]], 'sine'],
  ability: [[[600, 0], [900, 0.08]], 'sine'],
  move: [[[520, 0]], 'triangle'],
  roll: [[[300, 0], [380, 0.05], [460, 0.1]], 'square'],
};

/** Toca o som da jogada mais importante entre as que acabaram de acontecer. */
export function playLudoSound(game: LudoGameView, mySeat: number, fresh: LudoLogEntry[]): void {
  const moves = fresh.flatMap((entry) => (entry.type === 'MOVE' ? [entry] : []));
  const abilities = fresh.flatMap((entry) => (entry.type === 'ABILITY' ? [entry] : []));
  const sound =
    game.result !== null
      ? game.result.winner === mySeat
        ? 'win'
        : 'lose'
      : abilities.some((entry) => game.abilities.find((ability) => ability.id === entry.ability)?.ultimate)
        ? 'ultimate'
        : moves.some((entry) => entry.captured.length > 0)
          ? 'capture'
          : moves.some((entry) => entry.special)
            ? 'special'
            : abilities.length > 0
              ? 'ability'
              : moves.length > 0
                ? 'move'
                : fresh.some((entry) => entry.type === 'ROLL')
                  ? 'roll'
                  : null;
  if (sound) playTones(SOUNDS[sound][0], SOUNDS[sound][1], sound === 'roll' ? 0.08 : 0.15);
}

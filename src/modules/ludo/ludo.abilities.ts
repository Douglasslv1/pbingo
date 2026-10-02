import { LUDO_CONFIG } from './ludo.config';
import type { LudoState } from './ludo.engine';
import { isSafeSquare, LAST_TRACK, legalPieces, LudoRuleError, rerollDice, squareOf } from './ludo.engine';

export type AbilityId = keyof typeof LUDO_CONFIG.abilities;

/** Alvo escolhido: pecas (proprias, ou do lugar `targetSeat`). Habilidades sem alvo usam {}. */
export interface AbilityTarget {
  pieces?: number[];
  targetSeat?: number;
}

export interface Ability {
  id: AbilityId;
  name: string;
  description: string;
  target: 'NONE' | 'OWN_PIECE' | 'OPPONENT_PIECE' | 'OWN_PIECE_PAIR';
  /** Fases da vez em que pode ser usada: antes de rolar o dado e/ou antes de mover. */
  phases: Array<LudoState['phase']>;
  /** Todos os alvos validos agora (vazio: nao pode ser usada). */
  options(state: LudoState, seat: number): AbilityTarget[];
  execute(state: LudoState, seat: number, target: AbilityTarget): LudoState;
}

const cost = (id: AbilityId) => LUDO_CONFIG.abilities[id].cost;
const onTrack = (progress: number) => progress >= 0 && progress <= LAST_TRACK;
const hasEffect = (state: LudoState, type: string, seat: number, piece: number) =>
  state.effects.some((effect) => effect.type === type && effect.seat === seat && effect.piece === piece);

/** Pecas proprias na volta do tabuleiro (fora da base, da reta final e do centro). */
const ownTrackPieces = (state: LudoState, seat: number) =>
  state.pieces[seat].flatMap((progress, piece) => (onTrack(progress) ? [piece] : []));

const withPieces = (state: LudoState, seat: number, change: (mine: number[]) => void): LudoState['pieces'] =>
  state.pieces.map((progresses, owner) => {
    const copy = [...progresses];
    if (owner === seat) change(copy);
    return copy;
  });

/** Volta uma peca algumas casas, sem passar da casa de saida e sem capturar ninguem. */
export const retreat = (progress: number, squares: number) => Math.max(progress - squares, 0);

const SHIELD: Ability = {
  id: 'SHIELD',
  name: 'Escudo',
  description: 'Protege uma peça sua contra captura até a sua próxima vez.',
  target: 'OWN_PIECE',
  phases: ['ROLL', 'MOVE'],
  options: (state, seat) =>
    ownTrackPieces(state, seat).filter((piece) => !hasEffect(state, 'SHIELD', seat, piece)).map((piece) => ({ pieces: [piece] })),
  execute: (state, seat, { pieces }) => ({ ...state, effects: [...state.effects, { type: 'SHIELD', seat, piece: pieces![0] }] }),
};

const BOOST: Ability = {
  id: 'BOOST',
  name: 'Impulso',
  description: `Soma ${LUDO_CONFIG.abilities.BOOST.squares} casas ao dado deste movimento (não vale para sair da base).`,
  target: 'NONE',
  phases: ['MOVE'],
  options: (state) => (legalPieces({ ...state, bonus: LUDO_CONFIG.abilities.BOOST.squares }).length > 0 ? [{}] : []),
  execute: (state) => ({ ...state, bonus: LUDO_CONFIG.abilities.BOOST.squares }),
};

const PULL: Ability = {
  id: 'PULL',
  name: 'Puxão',
  description: `Faz uma peça adversária voltar ${LUDO_CONFIG.abilities.PULL.squares} casas. Não vale em casa segura nem em peça com escudo.`,
  target: 'OPPONENT_PIECE',
  phases: ['ROLL', 'MOVE'],
  options: (state, seat) =>
    state.pieces.flatMap((progresses, other) =>
      other === seat
        ? []
        : progresses.flatMap((progress, piece) =>
            onTrack(progress) &&
            !isSafeSquare(squareOf(state.colors[other], progress)!) &&
            !hasEffect(state, 'SHIELD', other, piece)
              ? [{ targetSeat: other, pieces: [piece] }]
              : [],
          ),
    ),
  execute: (state, _seat, { targetSeat, pieces }) => ({
    ...state,
    pieces: withPieces(state, targetSeat!, (mine) => (mine[pieces![0]] = retreat(mine[pieces![0]], LUDO_CONFIG.abilities.PULL.squares))),
  }),
};

const SWAP: Ability = {
  id: 'SWAP',
  name: 'Troca',
  description: 'Troca de lugar duas peças suas que estão na volta do tabuleiro.',
  target: 'OWN_PIECE_PAIR',
  phases: ['ROLL', 'MOVE'],
  options: (state, seat) => {
    const mine = ownTrackPieces(state, seat);
    const progress = state.pieces[seat];
    return mine.flatMap((a, i) => mine.slice(i + 1).filter((b) => progress[a] !== progress[b]).map((b) => ({ pieces: [a, b] })));
  },
  execute: (state, seat, { pieces }) => ({
    ...state,
    pieces: withPieces(state, seat, (mine) => {
      const [a, b] = pieces!;
      [mine[a], mine[b]] = [mine[b], mine[a]];
    }),
  }),
};

const SECOND_CHANCE: Ability = {
  id: 'SECOND_CHANCE',
  name: 'Segunda chance',
  description: 'Joga o dado de novo. O novo número substitui o anterior.',
  target: 'NONE',
  phases: ['MOVE'],
  options: () => [{}],
  execute: (state, seat) => rerollDice(state, seat),
};

const ESCAPE: Ability = {
  id: 'ESCAPE',
  name: 'Fuga',
  description: `Arma uma peça: se ela for capturada, volta ${LUDO_CONFIG.abilities.ESCAPE.squares} casas em vez de ir para a base. Vale até ser usada.`,
  target: 'OWN_PIECE',
  phases: ['ROLL', 'MOVE'],
  options: (state, seat) =>
    ownTrackPieces(state, seat).filter((piece) => !hasEffect(state, 'ESCAPE', seat, piece)).map((piece) => ({ pieces: [piece] })),
  execute: (state, seat, { pieces }) => ({ ...state, effects: [...state.effects, { type: 'ESCAPE', seat, piece: pieces![0] }] }),
};

export const ABILITIES: Record<AbilityId, Ability> = { SHIELD, BOOST, PULL, SWAP, SECOND_CHANCE, ESCAPE };

/** Alvos de cada habilidade que o jogador da vez pode usar agora (com energia e na fase certa). */
export function abilityOptions(state: LudoState, seat: number): Partial<Record<AbilityId, AbilityTarget[]>> {
  if (state.status !== 'PLAYING' || state.turn !== seat || state.abilityUsed) return {};
  return Object.fromEntries(
    Object.values(ABILITIES)
      .filter((ability) => ability.phases.includes(state.phase) && state.energy[seat] >= cost(ability.id))
      .map((ability) => [ability.id, ability.options(state, seat)] as const)
      .filter(([, options]) => options.length > 0),
  );
}

const sameTarget = (a: AbilityTarget, b: AbilityTarget) =>
  a.targetSeat === b.targetSeat && [...(a.pieces ?? [])].sort().join() === [...(b.pieces ?? [])].sort().join();

/** Usa uma habilidade: confere fase, energia e alvo, cobra a energia e marca a vez como ja usada. */
export function useAbility(state: LudoState, seat: number, id: AbilityId, target: AbilityTarget): LudoState {
  if (state.abilityUsed) throw new LudoRuleError('Você já usou uma habilidade nesta vez');
  const ability = ABILITIES[id];
  if (!ability.phases.includes(state.phase)) {
    throw new LudoRuleError(state.phase === 'ROLL' ? `${ability.name}: jogue o dado primeiro` : `${ability.name}: só antes de jogar o dado`);
  }
  if (state.energy[seat] < cost(id)) throw new LudoRuleError(`Energia insuficiente para ${ability.name}`);
  if (!ability.options(state, seat).some((option) => sameTarget(option, target))) {
    throw new LudoRuleError(`Alvo inválido para ${ability.name}`);
  }
  const paid: LudoState = {
    ...state,
    energy: state.energy.map((value, i) => (i === seat ? value - cost(id) : value)),
    abilityUsed: true,
    lastAbility: { seat, ability: id, ...target, move: state.moveCount + 1 },
  };
  return ability.execute(paid, seat, target);
}

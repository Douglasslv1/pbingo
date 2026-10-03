import type { CharacterId } from './ludo.characters';
import { LUDO_CONFIG } from './ludo.config';
import type { LudoEffect, LudoState } from './ludo.engine';
import {
  COLOR_OFFSET,
  dieAt,
  isSafeSquare,
  LAST_TRACK,
  legalPieces,
  LudoRuleError,
  rerollDice,
  squareOf,
  TRACK_LENGTH,
} from './ludo.engine';

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
  /** OWN_AND_OPPONENT: `pieces` = [peca propria, peca do lugar `targetSeat`]. */
  target: 'NONE' | 'OWN_PIECE' | 'OPPONENT_PIECE' | 'OWN_PIECE_PAIR' | 'OWN_AND_OPPONENT';
  /** Fases da vez em que pode ser usada: antes de rolar o dado e/ou antes de mover. */
  phases: Array<LudoState['phase']>;
  /** Poder de personagem: so quem o escolheu usa, uma vez por partida e sem energia. */
  character?: CharacterId;
  /** Ultimate do personagem: exige a carga cheia (e a zera), em vez de ser de uso unico. */
  ultimate?: boolean;
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

/** Pecas adversarias que podem ser alvo: na volta, fora das casas seguras e sem escudo. */
const opponentTargets = (state: LudoState, seat: number) =>
  state.pieces.flatMap((progresses, other) =>
    other === seat
      ? []
      : progresses.flatMap((progress, piece) => {
          const square = squareOf(state.colors[other], progress);
          return square !== null && !isSafeSquare(square) && !hasEffect(state, 'SHIELD', other, piece)
            ? [{ seat: other, piece, square }]
            : [];
        }),
  );

/** Progresso de uma peca da cor `color` que esta na casa `square` do tabuleiro. */
const progressAt = (color: number, square: number) => (square - color * COLOR_OFFSET + TRACK_LENGTH) % TRACK_LENGTH;

const withPieces = (state: LudoState, seat: number, change: (mine: number[]) => void): LudoState['pieces'] =>
  state.pieces.map((progresses, owner) => {
    const copy = [...progresses];
    if (owner === seat) change(copy);
    return copy;
  });

/** Volta uma peca algumas casas, sem passar da casa de saida e sem capturar ninguem. */
export const retreat = (progress: number, squares: number) => Math.max(progress - squares, 0);

/** Arma um efeito numa peca propria na volta (Escudo, Fuga, Fortificar). */
const armPiece = (type: LudoEffect['type']): Pick<Ability, 'options' | 'execute'> => ({
  options: (state, seat) =>
    ownTrackPieces(state, seat).filter((piece) => !hasEffect(state, type, seat, piece)).map((piece) => ({ pieces: [piece] })),
  execute: (state, seat, { pieces }) => ({ ...state, effects: [...state.effects, { type, seat, piece: pieces![0] }] }),
});

/** Casas a mais no movimento deste dado (Impulso, Arrancada). */
const addSquares = (squares: number): Pick<Ability, 'options' | 'execute'> => ({
  options: (state) => (legalPieces({ ...state, bonus: state.bonus + squares }).length > 0 ? [{}] : []),
  execute: (state) => ({ ...state, bonus: state.bonus + squares }),
});

const SHIELD: Ability = {
  id: 'SHIELD',
  name: 'Escudo',
  description: 'Protege uma peça sua contra captura até a sua próxima vez.',
  target: 'OWN_PIECE',
  phases: ['ROLL', 'MOVE'],
  ...armPiece('SHIELD'),
};

const BOOST: Ability = {
  id: 'BOOST',
  name: 'Impulso',
  description: `Soma ${LUDO_CONFIG.abilities.BOOST.squares} casas ao dado deste movimento (não vale para sair da base).`,
  target: 'NONE',
  phases: ['MOVE'],
  ...addSquares(LUDO_CONFIG.abilities.BOOST.squares),
};

const PULL: Ability = {
  id: 'PULL',
  name: 'Puxão',
  description: `Faz uma peça adversária voltar ${LUDO_CONFIG.abilities.PULL.squares} casas. Não vale em casa segura nem em peça com escudo.`,
  target: 'OPPONENT_PIECE',
  phases: ['ROLL', 'MOVE'],
  options: (state, seat) => opponentTargets(state, seat).map(({ seat: other, piece }) => ({ targetSeat: other, pieces: [piece] })),
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
  ...armPiece('ESCAPE'),
};

const DASH: Ability = {
  id: 'DASH',
  name: 'Arrancada',
  description: `Corredor: soma ${LUDO_CONFIG.abilities.DASH.squares} casas ao dado deste movimento (não vale para sair da base). Uma vez por partida.`,
  target: 'NONE',
  phases: ['MOVE'],
  character: 'RUNNER',
  ...addSquares(LUDO_CONFIG.abilities.DASH.squares),
};

const FORTIFY: Ability = {
  id: 'FORTIFY',
  name: 'Fortificar',
  description: 'Guardião: arma uma peça; a próxima captura dela é ignorada e ela fica onde está. Uma vez por partida.',
  target: 'OWN_PIECE',
  phases: ['ROLL', 'MOVE'],
  character: 'GUARDIAN',
  ...armPiece('FORTIFY'),
};

const TRICK: Ability = {
  ...SWAP,
  id: 'TRICK',
  name: 'Truque',
  description: 'Trapaceiro: troca de lugar duas peças suas que estão na volta do tabuleiro, sem gastar energia. Uma vez por partida.',
  character: 'TRICKSTER',
};

const MAX_SPEED: Ability = {
  id: 'MAX_SPEED',
  name: 'Velocidade máxima',
  description: 'Ultimate do Corredor: joga dois dados e você escolhe qual usar.',
  target: 'NONE',
  phases: ['ROLL'],
  character: 'RUNNER',
  ultimate: true,
  options: () => [{}],
  execute: (state) => ({
    ...state,
    rolls: state.rolls + 2,
    diceChoices: [dieAt(state.seed, state.rolls), dieAt(state.seed, state.rolls + 1)],
    phase: 'CHOOSE',
  }),
};

const FORTRESS: Ability = {
  id: 'FORTRESS',
  name: 'Fortaleza',
  description: 'Ultimate do Guardião: todas as suas peças na volta do tabuleiro ganham escudo até a sua próxima vez.',
  target: 'NONE',
  phases: ['ROLL', 'MOVE'],
  character: 'GUARDIAN',
  ultimate: true,
  options: (state, seat) => (SHIELD.options(state, seat).length > 0 ? [{}] : []),
  execute: (state, seat) =>
    SHIELD.options(state, seat).reduce((next, target) => SHIELD.execute(next, seat, target), state),
};

const HUNT: Ability = {
  id: 'HUNT',
  name: 'Caçada',
  description: `Ultimate do Caçador: nesta vez, cada captura dá +${LUDO_CONFIG.abilities.HUNT.squares} casas no movimento seguinte (até ${LUDO_CONFIG.abilities.HUNT.captures} capturas).`,
  target: 'NONE',
  phases: ['ROLL', 'MOVE'],
  character: 'HUNTER',
  ultimate: true,
  options: () => [{}],
  execute: (state) => ({ ...state, hunt: LUDO_CONFIG.abilities.HUNT.captures }),
};

const CHAOS: Ability = {
  id: 'CHAOS',
  name: 'Caos',
  description:
    'Ultimate do Trapaceiro: troca de lugar uma peça sua com uma adversária, ambas na volta do tabuleiro. Não vale em casa segura, em peça com escudo nem se uma delas passaria da entrada da reta final.',
  target: 'OWN_AND_OPPONENT',
  phases: ['ROLL', 'MOVE'],
  character: 'TRICKSTER',
  ultimate: true,
  options: (state, seat) =>
    ownTrackPieces(state, seat).flatMap((own) => {
      const ownSquare = squareOf(state.colors[seat], state.pieces[seat][own])!;
      return opponentTargets(state, seat)
        .filter(
          ({ seat: other, square }) =>
            square !== ownSquare &&
            progressAt(state.colors[seat], square) <= LAST_TRACK &&
            progressAt(state.colors[other], ownSquare) <= LAST_TRACK,
        )
        .map(({ seat: other, piece }) => ({ targetSeat: other, pieces: [own, piece] }));
    }),
  execute: (state, seat, { targetSeat, pieces }) => {
    const [own, theirs] = pieces!;
    const other = targetSeat!;
    const next = state.pieces.map((progresses) => [...progresses]);
    next[seat][own] = progressAt(state.colors[seat], squareOf(state.colors[other], state.pieces[other][theirs])!);
    next[other][theirs] = progressAt(state.colors[other], squareOf(state.colors[seat], state.pieces[seat][own])!);
    return { ...state, pieces: next };
  },
};

export const ABILITIES: Record<AbilityId, Ability> = {
  SHIELD,
  BOOST,
  PULL,
  SWAP,
  SECOND_CHANCE,
  ESCAPE,
  DASH,
  FORTIFY,
  TRICK,
  MAX_SPEED,
  FORTRESS,
  HUNT,
  CHAOS,
};

/** Pode pagar a habilidade: energia, poder de personagem ainda nao usado ou ultimate carregada. */
function affordable(state: LudoState, seat: number, ability: Ability): boolean {
  if (ability.character && state.characters[seat] !== ability.character) return false;
  if (ability.ultimate) return state.ultimate[seat] >= LUDO_CONFIG.ultimateMax;
  return ability.character ? !state.powerUsed[seat] : state.energy[seat] >= cost(ability.id);
}

/** Alvos de cada habilidade que o jogador da vez pode usar agora (com energia e na fase certa). */
export function abilityOptions(state: LudoState, seat: number): Partial<Record<AbilityId, AbilityTarget[]>> {
  if (state.status !== 'PLAYING' || state.turn !== seat || state.abilityUsed) return {};
  return Object.fromEntries(
    Object.values(ABILITIES)
      .filter((ability) => ability.phases.includes(state.phase) && affordable(state, seat, ability))
      .map((ability) => [ability.id, ability.options(state, seat)] as const)
      .filter(([, options]) => options.length > 0),
  );
}

/** Pecas proprias (Troca) valem em qualquer ordem; com `targetSeat` a ordem importa (Caos: a sua, depois a adversaria). */
const targetKey = (target: AbilityTarget) =>
  target.targetSeat === undefined ? [...(target.pieces ?? [])].sort().join() : (target.pieces ?? []).join();
const sameTarget = (a: AbilityTarget, b: AbilityTarget) => a.targetSeat === b.targetSeat && targetKey(a) === targetKey(b);

/** Usa uma habilidade: confere fase, energia e alvo, cobra a energia e marca a vez como ja usada. */
export function useAbility(state: LudoState, seat: number, id: AbilityId, target: AbilityTarget): LudoState {
  if (state.abilityUsed) throw new LudoRuleError('Você já usou uma habilidade nesta vez');
  const ability = ABILITIES[id];
  if (!ability.phases.includes(state.phase)) {
    throw new LudoRuleError(state.phase === 'ROLL' ? `${ability.name}: jogue o dado primeiro` : `${ability.name}: só antes de jogar o dado`);
  }
  if (!affordable(state, seat, ability)) {
    throw new LudoRuleError(
      state.characters[seat] === ability.character && ability.ultimate
        ? `${ability.name}: a ultimate ainda não está carregada`
        : ability.character
          ? `${ability.name} não está disponível`
          : `Energia insuficiente para ${ability.name}`,
    );
  }
  if (!ability.options(state, seat).some((option) => sameTarget(option, target))) {
    throw new LudoRuleError(`Alvo inválido para ${ability.name}`);
  }
  const paid: LudoState = {
    ...state,
    energy: state.energy.map((value, i) => (i === seat ? value - cost(id) : value)),
    abilityUsed: true,
    powerUsed: ability.character && !ability.ultimate ? state.powerUsed.map((used, i) => used || i === seat) : state.powerUsed,
    ultimate: ability.ultimate ? state.ultimate.map((charge, i) => (i === seat ? 0 : charge)) : state.ultimate,
    lastAbility: { seat, ability: id, ...target, move: state.moveCount + 1 },
  };
  return ability.execute(paid, seat, target);
}

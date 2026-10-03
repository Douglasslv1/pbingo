import { describe, expect, it } from 'vitest';
import { AbilityId, AbilityTarget } from '../src/modules/ludo/ludo.abilities';
import { applyAction, autoAction, BASE, dealGame, dieAt, isForced, LudoState, viewFor } from '../src/modules/ludo/ludo.engine';

const SEED = 'semente-de-teste';
const EMPTY = [BASE, BASE, BASE, BASE];

/** Arena mano a mano no ponto de mover (ou de rolar), com pecas e energia escolhidas a mao. */
function arena(pieces: number[][], { dice = 3, energy = [10, 10], phase = 'MOVE' as LudoState['phase'], turn = 0 } = {}): LudoState {
  return { ...dealGame(2, 'ARENA', SEED), pieces, energy, phase, turn, dice: phase === 'MOVE' ? dice : null };
}

const use = (state: LudoState, ability: AbilityId, target: AbilityTarget = {}) =>
  applyAction(state, state.turn, { type: 'ABILITY', ability, ...target });
const move = (state: LudoState, piece: number) => applyAction(state, state.turn, { type: 'MOVE', piece });

/** Primeira semente cujo dado numero 0 e o valor pedido. */
function seedRolling(value: number): string {
  for (let i = 0; ; i++) if (dieAt(`s${i}`, 0) === value) return `s${i}`;
}

describe('Ludo Arena: habilidades', () => {
  it('o Classico nao tem habilidades', () => {
    const classic = { ...arena([[10, ...EMPTY.slice(1)], EMPTY]), mode: 'CLASSICO' as const };
    expect(() => use(classic, 'BOOST')).toThrow('Esta modalidade não tem habilidades');
    expect(viewFor(classic, 0)).toMatchObject({ abilities: [], abilityOptions: {} });
  });

  it('cobra a energia, recusa sem energia suficiente e so uma habilidade por vez', () => {
    const state = arena([[10, 20, BASE, BASE], EMPTY], { energy: [3, 0] });
    expect(() => use(state, 'SECOND_CHANCE')).toThrow('Energia insuficiente para Segunda chance');

    const shielded = use(state, 'SHIELD', { pieces: [0] });
    expect(shielded.energy).toEqual([1, 0]);
    expect(() => use({ ...shielded, energy: [10, 0] }, 'ESCAPE', { pieces: [1] })).toThrow('Você já usou uma habilidade nesta vez');
    // Depois de mover, a vez passa e o adversario pode usar a dele
    expect(move(shielded, 0)).toMatchObject({ turn: 1, abilityUsed: false });
  });

  it('a visao mostra so os alvos validos de quem esta na vez', () => {
    const state = arena([[10, BASE, BASE, BASE], [36, BASE, BASE, BASE]]);
    const mine = viewFor(state, 0);
    expect(mine.abilities.map((ability) => ability.id)).toEqual([
      'SHIELD',
      'BOOST',
      'PULL',
      'SWAP',
      'SECOND_CHANCE',
      'ESCAPE',
      'DASH',
      'FORTIFY',
      'TRICK',
    ]);
    expect(mine.abilityOptions).toEqual({
      SHIELD: [{ pieces: [0] }],
      BOOST: [{}],
      PULL: [{ targetSeat: 1, pieces: [0] }],
      SECOND_CHANCE: [{}],
      ESCAPE: [{ pieces: [0] }],
    });
    expect(viewFor(state, 1).abilityOptions).toEqual({});
  });

  it('Escudo: a peca nao e capturada e o escudo acaba quando a vez do dono chega', () => {
    const shielded = use(arena([[7, BASE, BASE, BASE], [36, BASE, BASE, BASE]], { turn: 1, phase: 'ROLL' }), 'SHIELD', { pieces: [0] });
    const attack = { ...shielded, turn: 0, phase: 'MOVE' as const, dice: 3, abilityUsed: false };
    const after = move(attack, 0);
    expect(after.pieces[1][0]).toBe(36);
    expect(after.lastMove?.captured).toEqual([]);
    // A vez passou para o dono do escudo: ele acaba
    expect(after).toMatchObject({ turn: 1, effects: [] });
  });

  it('Impulso: +2 casas no movimento, so depois do dado, e nao ajuda a sair da base', () => {
    const state = arena([[10, BASE, BASE, BASE], EMPTY]);
    expect(() => use({ ...state, phase: 'ROLL', dice: null }, 'BOOST')).toThrow('Impulso: jogue o dado primeiro');
    const boosted = use(state, 'BOOST');
    expect(boosted).toMatchObject({ bonus: 2, energy: [8, 10] });
    expect(move(boosted, 0).pieces[0][0]).toBe(15);
    expect(use(arena([[BASE, 10, BASE, BASE], EMPTY], { dice: 6 }), 'BOOST').bonus).toBe(2);
    expect(move(use(arena([[BASE, 10, BASE, BASE], EMPTY], { dice: 6 }), 'BOOST'), 0).pieces[0][0]).toBe(0);
  });

  it('Puxao: a peca adversaria volta 2 casas; nao vale em casa segura, com escudo nem na propria peca', () => {
    const pulled = use(arena([[10, BASE, BASE, BASE], [36, BASE, BASE, BASE]]), 'PULL', { targetSeat: 1, pieces: [0] });
    expect(pulled.pieces[1][0]).toBe(34);
    expect(pulled.lastAbility).toEqual({ seat: 0, ability: 'PULL', targetSeat: 1, pieces: [0], move: 1 });

    // Progresso 34 da cor 2 e a casa 8 (estrela, segura)
    expect(() => use(arena([[10, BASE, BASE, BASE], [34, BASE, BASE, BASE]]), 'PULL', { targetSeat: 1, pieces: [0] })).toThrow('Alvo inválido');
    const shielded = { ...arena([[10, BASE, BASE, BASE], [36, BASE, BASE, BASE]]), effects: [{ type: 'SHIELD' as const, seat: 1, piece: 0 }] };
    expect(() => use(shielded, 'PULL', { targetSeat: 1, pieces: [0] })).toThrow('Alvo inválido');
    expect(() => use(arena([[10, BASE, BASE, BASE], EMPTY]), 'PULL', { targetSeat: 0, pieces: [0] })).toThrow('Alvo inválido');
  });

  it('Troca: duas pecas proprias na volta trocam de lugar; base e reta final nao entram', () => {
    const swapped = use(arena([[10, 30, BASE, 52], EMPTY]), 'SWAP', { pieces: [1, 0] });
    expect(swapped.pieces[0]).toEqual([30, 10, BASE, 52]);
    expect(() => use(arena([[10, 30, BASE, 52], EMPTY]), 'SWAP', { pieces: [0, 2] })).toThrow('Alvo inválido');
    expect(() => use(arena([[10, 30, BASE, 52], EMPTY]), 'SWAP', { pieces: [0, 3] })).toThrow('Alvo inválido');
  });

  it('Segunda chance: o novo dado da semente substitui o anterior', () => {
    const state = { ...arena([[10, BASE, BASE, BASE], EMPTY], { dice: 1 }), rolls: 5 };
    const after = use(state, 'SECOND_CHANCE');
    expect(after.lastRoll).toEqual({ seat: 0, value: dieAt(SEED, 5) });
    expect(after.rolls).toBe(6);
    expect(after.energy[0]).toBe(6);
  });

  it('Fuga: a peca capturada volta 3 casas em vez de ir para a base e a fuga e gasta', () => {
    const armed = { ...arena([[7, BASE, BASE, BASE], [36, BASE, BASE, BASE]]), effects: [{ type: 'ESCAPE' as const, seat: 1, piece: 0 }] };
    const after = move(armed, 0);
    expect(after.pieces[1][0]).toBe(33);
    expect(after.lastMove).toMatchObject({ captured: [], escaped: [{ seat: 1, piece: 0, from: 36, to: 33 }] });
    expect(after.effects).toEqual([]);
    // Sem captura de verdade: nao ha energia de captura nem jogada extra
    expect(after).toMatchObject({ turn: 1, energy: [10, 10] });
  });

  it('dado sem jogada: com habilidade possivel a vez espera o jogador, que pode passar', () => {
    const stuck = { ...dealGame(2, 'ARENA', seedRolling(3)), phase: 'ROLL' as const, energy: [4, 0] };
    const rolled = applyAction(stuck, 0, { type: 'ROLL' });
    expect(rolled).toMatchObject({ turn: 0, phase: 'MOVE', dice: 3 });
    expect(isForced(rolled)).toBe(false);
    expect(autoAction(rolled)).toEqual({ type: 'PASS' });
    expect(applyAction(rolled, 0, { type: 'PASS' })).toMatchObject({ turn: 1, phase: 'ROLL' });

    // Sem energia, passa sozinha como no Classico
    expect(applyAction({ ...stuck, energy: [0, 0] }, 0, { type: 'ROLL' })).toMatchObject({ turn: 1, phase: 'ROLL' });
    expect(() => applyAction(arena([[10, BASE, BASE, BASE], EMPTY]), 0, { type: 'PASS' })).toThrow('Você tem peça para mover');
  });

  it('com uma so peca para mover, o servidor so joga sozinho se nao houver habilidade possivel', () => {
    expect(isForced(arena([[10, BASE, BASE, BASE], EMPTY], { energy: [0, 0] }))).toBe(true);
    expect(isForced(arena([[10, BASE, BASE, BASE], EMPTY], { energy: [2, 0] }))).toBe(false);
  });
});

describe('Ludo Arena: personagens', () => {
  const withCharacters = (state: LudoState, characters: LudoState['characters']) => ({ ...state, characters });

  it('cada um escolhe o personagem pela ordem dos lugares antes do primeiro dado', () => {
    const start = dealGame(2, 'ARENA', SEED);
    expect(start).toMatchObject({ phase: 'PICK', turn: 0, characters: [null, null] });
    expect(dealGame(2, 'CLASSICO', SEED).phase).toBe('ROLL');
    expect(() => applyAction(start, 0, { type: 'ROLL' })).toThrow('Escolha seu personagem primeiro');
    expect(() => applyAction(start, 1, { type: 'PICK', character: 'HUNTER' })).toThrow('Não é a sua vez');

    const first = applyAction(start, 0, { type: 'PICK', character: 'RUNNER' });
    expect(first).toMatchObject({ phase: 'PICK', turn: 1 });
    // Tempo esgotado: o sistema escolhe pelo lugar
    expect(autoAction(first)).toEqual({ type: 'PICK', character: 'GUARDIAN' });
    const ready = applyAction(first, 1, autoAction(first));
    expect(ready).toMatchObject({ phase: 'ROLL', turn: 0, characters: ['RUNNER', 'GUARDIAN'] });
    expect(() => applyAction(ready, 0, { type: 'PICK', character: 'HUNTER' })).toThrow('A escolha de personagens já terminou');
  });

  it('o poder e so de quem escolheu o personagem, sem energia e uma vez por partida', () => {
    const state = withCharacters(arena([[10, BASE, BASE, BASE], EMPTY], { energy: [0, 0] }), ['RUNNER', 'HUNTER']);
    expect(viewFor(state, 0).abilityOptions).toEqual({ DASH: [{}] });
    expect(() => use(state, 'TRICK', { pieces: [0, 1] })).toThrow('Truque não está disponível');

    const dashed = use(state, 'DASH');
    expect(dashed).toMatchObject({ bonus: 3, energy: [0, 0], powerUsed: [true, false] });
    expect(move(dashed, 0).pieces[0][0]).toBe(16);
    expect(() => use({ ...dashed, abilityUsed: false }, 'DASH')).toThrow('Arrancada não está disponível');
  });

  it('Guardiao: a peca fortificada ignora uma captura e fica onde esta', () => {
    const state = {
      ...arena([[7, BASE, BASE, BASE], [36, BASE, BASE, BASE]]),
      effects: [
        { type: 'FORTIFY' as const, seat: 1, piece: 0 },
        { type: 'ESCAPE' as const, seat: 1, piece: 0 },
      ],
    };
    const after = move(state, 0);
    expect(after.pieces[1][0]).toBe(36);
    expect(after.lastMove).toMatchObject({ captured: [], escaped: [], fortified: [{ seat: 1, piece: 0 }] });
    // O fortificar e gasto; a fuga continua armada
    expect(after.effects).toEqual([{ type: 'ESCAPE', seat: 1, piece: 0 }]);
  });

  it('Cacador: +1 de energia a mais por captura', () => {
    const state = withCharacters(arena([[7, BASE, BASE, BASE], [36, BASE, BASE, BASE]], { energy: [0, 0] }), ['HUNTER', 'RUNNER']);
    expect(move(state, 0).energy).toEqual([2, 1]);
  });
});

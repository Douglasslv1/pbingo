import { describe, expect, it } from 'vitest';
import {
  applyAction,
  autoAction,
  BASE,
  commitmentOf,
  dealGame,
  dieAt,
  FINISH,
  hasSingleChoice,
  isSafeSquare,
  legalPieces,
  LudoRuleError,
  LudoState,
  squareOf,
  viewFor,
} from '../src/modules/ludo/ludo.engine';

const SEED = 'semente-de-teste';

/** Partida no ponto de mover, com o dado e as pecas escolhidos a mao. */
function position(pieces: number[][], dice: number, turn = 0): LudoState {
  return { ...dealGame(pieces.length, SEED), pieces, turn, phase: 'MOVE', dice };
}

const move = (state: LudoState, piece: number) => applyAction(state, state.turn, { type: 'MOVE', piece });

/** Primeira semente cujo dado numero 0 e o valor pedido (para testar a rolagem pela API do motor). */
function seedRolling(value: number): string {
  for (let i = 0; ; i++) if (dieAt(`s${i}`, 0) === value) return `s${i}`;
}

describe('Ludo', () => {
  it('comeca com todas as pecas na base; mano a mano usa cores opostas', () => {
    expect(dealGame(2).colors).toEqual([0, 2]);
    const state = dealGame(4);
    expect(state.colors).toEqual([0, 1, 2, 3]);
    expect(state.pieces.flat().every((progress) => progress === BASE)).toBe(true);
    expect(state).toMatchObject({ turn: 0, phase: 'ROLL' });
    expect(() => dealGame(3)).toThrow(LudoRuleError);
  });

  it('o dado sai da semente: sempre de 1 a 6, reprodutivel e bem distribuido', () => {
    const rolls = Array.from({ length: 6000 }, (_, i) => dieAt(SEED, i));
    expect(rolls.every((value) => value >= 1 && value <= 6)).toBe(true);
    expect(dieAt(SEED, 7)).toBe(rolls[7]);
    for (let face = 1; face <= 6; face++) {
      const count = rolls.filter((value) => value === face).length;
      expect(count).toBeGreaterThan(850);
      expect(count).toBeLessThan(1150);
    }
  });

  it('a semente fica secreta ate o fim; o hash dela e publico desde o inicio', () => {
    const state = dealGame(2, SEED);
    const view = viewFor(state, 0);
    expect(view.seed).toBeNull();
    expect(view.commitment).toBe(commitmentOf(SEED));
    expect(viewFor({ ...state, status: 'FINISHED', result: { winner: 0 } }, 1).seed).toBe(SEED);
  });

  it('so sai da base com 6', () => {
    expect(legalPieces(position([[BASE, BASE, BASE, BASE], [BASE, BASE, BASE, BASE]], 5))).toEqual([]);
    expect(legalPieces(position([[BASE, BASE, BASE, BASE], [BASE, BASE, BASE, BASE]], 6))).toEqual([0, 1, 2, 3]);
    const out = move(position([[BASE, BASE, BASE, BASE], [BASE, BASE, BASE, BASE]], 6), 2);
    expect(out.pieces[0]).toEqual([BASE, BASE, 0, BASE]);
  });

  it('dado sem nenhuma jogada possivel passa a vez sozinho', () => {
    const state = { ...dealGame(2, seedRolling(3)) };
    const after = applyAction(state, 0, { type: 'ROLL' });
    expect(after).toMatchObject({ turn: 1, phase: 'ROLL', lastRoll: { seat: 0, value: 3 }, rolls: 1, moveCount: 1 });
  });

  it('com jogada possivel, o dado espera a escolha da peca', () => {
    const state = { ...dealGame(2, seedRolling(4)), pieces: [[10, BASE, BASE, BASE], [BASE, BASE, BASE, BASE]] };
    const after = applyAction(state, 0, { type: 'ROLL' });
    expect(after).toMatchObject({ turn: 0, phase: 'MOVE', dice: 4 });
    expect(legalPieces(after)).toEqual([0]);
    expect(hasSingleChoice(after)).toBe(true);
  });

  it('movimento normal passa a vez; 6 da direito a jogar de novo', () => {
    const normal = move(position([[10, BASE, BASE, BASE], [BASE, BASE, BASE, BASE]], 4), 0);
    expect(normal).toMatchObject({ turn: 1, phase: 'ROLL' });
    expect(normal.pieces[0][0]).toBe(14);
    const six = move(position([[10, BASE, BASE, BASE], [BASE, BASE, BASE, BASE]], 6), 0);
    expect(six).toMatchObject({ turn: 0, phase: 'ROLL' });
  });

  it('tres 6 seguidos perdem a vez', () => {
    const state = { ...dealGame(2, seedRolling(6)), pieces: [[10, BASE, BASE, BASE], [BASE, BASE, BASE, BASE]], sixes: 2 };
    expect(applyAction(state, 0, { type: 'ROLL' })).toMatchObject({ turn: 1, phase: 'ROLL', sixes: 0 });
  });

  it('entra na reta final da propria cor e precisa do numero exato para chegar ao centro', () => {
    const into = move(position([[48, BASE, BASE, BASE], [BASE, BASE, BASE, BASE]], 5), 0);
    expect(into.pieces[0][0]).toBe(53);
    expect(squareOf(0, 53)).toBeNull();
    expect(legalPieces(position([[53, BASE, BASE, BASE], [BASE, BASE, BASE, BASE]], 4))).toEqual([]);
    const home = move(position([[53, 20, BASE, BASE], [BASE, BASE, BASE, BASE]], 3), 0);
    expect(home.pieces[0][0]).toBe(FINISH);
    // Chegar ao centro da direito a jogar de novo
    expect(home).toMatchObject({ turn: 0, phase: 'ROLL' });
  });

  it('peca que chegou ao centro nao anda mais', () => {
    expect(legalPieces(position([[FINISH, 10, BASE, BASE], [BASE, BASE, BASE, BASE]], 2))).toEqual([1]);
  });

  it('captura manda a peca adversaria para a base e da direito a jogar de novo', () => {
    // Cor 0 na casa 10 e cor 2 (mano a mano) na mesma casa: progresso 10 - 26 + 52 = 36
    const state = position([[7, BASE, BASE, BASE], [36, BASE, BASE, BASE]], 3);
    expect(squareOf(0, 10)).toBe(squareOf(2, 36));
    const after = move(state, 0);
    expect(after.pieces[1][0]).toBe(BASE);
    expect(after.lastMove).toEqual({ seat: 0, piece: 0, from: 7, to: 10, captured: [{ seat: 1, piece: 0, from: 36 }] });
    expect(after).toMatchObject({ turn: 0, phase: 'ROLL' });
  });

  it('nao captura em casa segura nem duas pecas da mesma cor juntas', () => {
    // Estrela da cor 0 (casa 8) e segura
    expect(isSafeSquare(8)).toBe(true);
    const safe = move(position([[5, BASE, BASE, BASE], [34, BASE, BASE, BASE]], 3), 0);
    expect(safe.pieces[1][0]).toBe(34);
    expect(safe.turn).toBe(1);

    const pair = move(position([[7, BASE, BASE, BASE], [36, 36, BASE, BASE]], 3), 0);
    expect(pair.pieces[1]).toEqual([36, 36, BASE, BASE]);
  });

  it('a casa de saida de cada cor e segura', () => {
    expect([0, 13, 26, 39].every(isSafeSquare)).toBe(true);
    expect(isSafeSquare(10)).toBe(false);
  });

  it('vence quem leva as 4 pecas ao centro', () => {
    const after = move(position([[FINISH, FINISH, FINISH, 54], [BASE, BASE, BASE, BASE]], 2), 3);
    expect(after).toMatchObject({ status: 'FINISHED', result: { winner: 0 } });
    expect(() => applyAction(after, 1, { type: 'ROLL' })).toThrow('A partida já terminou');
  });

  it('recusa acao fora da vez ou fora da fase', () => {
    const state = dealGame(2, SEED);
    expect(() => applyAction(state, 1, { type: 'ROLL' })).toThrow('Não é a sua vez');
    expect(() => applyAction(state, 0, { type: 'MOVE', piece: 0 })).toThrow('Jogue o dado primeiro');
    const moving = position([[10, 20, BASE, BASE], [BASE, BASE, BASE, BASE]], 2);
    expect(() => applyAction(moving, 0, { type: 'ROLL' })).toThrow('Escolha a peça');
    expect(() => move(moving, 2)).toThrow('Esta peça não pode andar');
  });

  it('pecas na mesma posicao contam como uma so escolha', () => {
    expect(hasSingleChoice(position([[BASE, BASE, BASE, BASE], [BASE, BASE, BASE, BASE]], 6))).toBe(true);
    expect(hasSingleChoice(position([[BASE, 10, BASE, BASE], [BASE, BASE, BASE, BASE]], 6))).toBe(false);
  });

  it('jogada automatica: rola o dado ou move a peca mais adiantada', () => {
    expect(autoAction(dealGame(2, SEED))).toEqual({ type: 'ROLL' });
    expect(autoAction(position([[10, 30, BASE, BASE], [BASE, BASE, BASE, BASE]], 2))).toEqual({ type: 'MOVE', piece: 1 });
  });
});

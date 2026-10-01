import { describe, expect, it } from 'vitest';
import {
  applyAction,
  autoAction,
  createDeck,
  dealGame,
  DominoRuleError,
  hasOnlyForcedAction,
  legalActions,
  lineEnds,
  shuffle,
  viewFor,
} from '../src/modules/domino/domino.engine';
import { DominoAction, DominoState, Tile } from '../src/modules/domino/domino.types';

/** Estado montado a mao para testar uma situacao exata. */
function makeState(overrides: Partial<DominoState>): DominoState {
  return {
    mode: 'SIX_TILES',
    teamMode: 'INDIVIDUAL',
    hands: [[], [], [], []],
    boneyard: [],
    line: [],
    currentSeat: 0,
    openingTile: null,
    consecutivePasses: 0,
    moveCount: 0,
    status: 'PLAYING',
    result: null,
    ...overrides,
  };
}

const play = (tile: Tile, side: 'LEFT' | 'RIGHT' = 'LEFT'): DominoAction => ({ type: 'PLAY', tile, side });

/** Joga uma partida inteira so com jogadas automaticas. */
function playOut(state: DominoState): DominoState {
  let current = state;
  let guard = 0;
  while (current.status === 'PLAYING') {
    current = applyAction(current, current.currentSeat, autoAction(current, current.currentSeat));
    guard += 1;
    if (guard > 500) throw new Error('partida nao terminou');
  }
  return current;
}

describe('Pedras e distribuicao', () => {
  it('o jogo tem 28 pedras diferentes, de 0-0 a 6-6', () => {
    const deck = createDeck();
    expect(deck).toHaveLength(28);
    expect(new Set(deck.map((tile) => tile.join('-'))).size).toBe(28);
  });

  it('embaralhar nao perde nem duplica pedras', () => {
    const shuffled = shuffle(createDeck());
    expect(shuffled.map((t) => t.join('-')).sort()).toEqual(createDeck().map((t) => t.join('-')).sort());
  });

  it('distribui 6 pedras para cada um e deixa 4 no monte', () => {
    const state = dealGame('BURRINHO', 'INDIVIDUAL');
    expect(state.hands.map((hand) => hand.length)).toEqual([6, 6, 6, 6]);
    expect(state.boneyard).toHaveLength(4);
  });

  it('sai quem tem a maior carroca distribuida, obrigado a joga-la', () => {
    for (let i = 0; i < 50; i += 1) {
      const state = dealGame('SIX_TILES', 'INDIVIDUAL');
      const dealtDoubles = state.hands.flat().filter((tile) => tile[0] === tile[1]);
      const highest = Math.max(...dealtDoubles.map((tile) => tile[0]));

      expect(state.openingTile).toEqual([highest, highest]);
      expect(state.hands[state.currentSeat]).toContainEqual([highest, highest]);
      expect(legalActions(state, state.currentSeat)).toEqual([play([highest, highest])]);
    }
  });

  it('mano a mano: 2 maos de 6, 16 dormem e, sem carroca nas maos, sai a pedra de mais pontos', () => {
    for (let i = 0; i < 200; i += 1) {
      const state = dealGame('SIX_TILES', 'DUEL');
      expect(state.hands.map((hand) => hand.length)).toEqual([6, 6]);
      expect(state.boneyard).toHaveLength(16);

      const dealt = state.hands.flat();
      const doubles = dealt.filter((tile) => tile[0] === tile[1]);
      const pool = doubles.length > 0 ? doubles : dealt;
      const best = Math.max(...pool.map((tile) => tile[0] + tile[1]));
      expect(state.openingTile![0] + state.openingTile![1]).toBe(best);
      expect(state.hands[state.currentSeat]).toContainEqual(state.openingTile);
    }
  });

  it('mano a mano: a vez alterna entre os 2 e o jogo tranca quando os 2 passam', () => {
    let state = makeState({ teamMode: 'DUEL', hands: [[[0, 1]], [[2, 3]]], line: [{ tile: [5, 5], left: 5, right: 5 }] });
    state = applyAction(state, 0, { type: 'PASS' });
    expect(state.currentSeat).toBe(1);
    state = applyAction(state, 1, { type: 'PASS' });
    expect(state.result).toEqual({ reason: 'BLOCKED', winnerSeats: [0], pips: [1, 5] });
  });
});

describe('Jogadas', () => {
  it('encaixa a pedra na ponta certa, virando quando precisa', () => {
    let state = makeState({ hands: [[[6, 6], [4, 4]], [[3, 6], [1, 1]], [[1, 6], [0, 0]], [[2, 2]]], openingTile: [6, 6] });

    state = applyAction(state, 0, play([6, 6]));
    state = applyAction(state, 1, play([3, 6], 'LEFT'));
    state = applyAction(state, 2, play([1, 6], 'RIGHT'));

    expect(viewFor(state, 0).anchorIndex).toBe(1);
    expect(state.line.map((placed) => [placed.left, placed.right])).toEqual([
      [3, 6],
      [6, 6],
      [6, 1],
    ]);
    expect(lineEnds(state)).toEqual({ left: 3, right: 1 });
  });

  it('aceita a pedra escrita em qualquer ordem ([6, 3] e o mesmo que [3, 6])', () => {
    const state = makeState({ hands: [[], [[3, 6], [0, 0]], [], []], line: [{ tile: [6, 6], left: 6, right: 6 }], currentSeat: 1 });
    const next = applyAction(state, 1, play([6, 3] as unknown as Tile, 'RIGHT'));
    expect(next.hands[1]).toEqual([[0, 0]]);
  });

  it('recusa jogar fora da vez, pedra que nao encaixa ou pedra que nao esta na mao', () => {
    const state = makeState({
      hands: [[[1, 2], [4, 4]], [[5, 5]], [], []],
      line: [{ tile: [2, 3], left: 2, right: 3 }],
    });

    expect(() => applyAction(state, 1, play([5, 5]))).toThrow(DominoRuleError);
    expect(() => applyAction(state, 0, play([4, 4]))).toThrow(/Jogada inválida/);
    expect(() => applyAction(state, 0, play([2, 6]))).toThrow(/Jogada inválida/);
  });

  it('no 6 pecas, quem nao tem pedra que encaixa so pode passar', () => {
    const state = makeState({ hands: [[[0, 1]], [], [], []], line: [{ tile: [5, 5], left: 5, right: 5 }], boneyard: [[5, 6]] });
    expect(legalActions(state, 0)).toEqual([{ type: 'PASS' }]);
    expect(hasOnlyForcedAction(state)).toBe(true);
  });

  it('no burrinho, compra ate conseguir jogar e continua na vez', () => {
    let state = makeState({
      mode: 'BURRINHO',
      hands: [[[0, 1]], [[2, 2]], [], []],
      line: [{ tile: [5, 5], left: 5, right: 5 }],
      boneyard: [[0, 2], [5, 6]],
    });

    expect(legalActions(state, 0)).toEqual([{ type: 'DRAW' }]);
    state = applyAction(state, 0, { type: 'DRAW' });
    expect(state.currentSeat).toBe(0);
    state = applyAction(state, 0, { type: 'DRAW' });

    expect(state.hands[0]).toContainEqual([5, 6]);
    expect(legalActions(state, 0)).toContainEqual(play([5, 6], 'LEFT'));
  });

  it('no burrinho com o monte vazio, passa', () => {
    const state = makeState({ mode: 'BURRINHO', hands: [[[0, 1]], [], [], []], line: [{ tile: [5, 5], left: 5, right: 5 }] });
    expect(legalActions(state, 0)).toEqual([{ type: 'PASS' }]);
  });

  it('nao altera o estado recebido', () => {
    const state = makeState({ hands: [[[6, 6], [1, 1]], [], [], []], openingTile: [6, 6] });
    const snapshot = JSON.stringify(state);
    applyAction(state, 0, play([6, 6]));
    expect(JSON.stringify(state)).toBe(snapshot);
  });
});

describe('Fim de partida', () => {
  it('batida individual: quem joga a ultima pedra vence', () => {
    const state = makeState({ hands: [[[3, 4]], [[1, 1]], [[2, 2]], [[0, 0]]], line: [{ tile: [4, 4], left: 4, right: 4 }] });
    const done = applyAction(state, 0, play([3, 4]));

    expect(done.status).toBe('FINISHED');
    expect(done.result).toEqual({ reason: 'DOMINO', winnerSeats: [0], pips: [0, 2, 4, 0] });
  });

  it('batida em duplas: o parceiro da frente tambem vence', () => {
    const state = makeState({
      teamMode: 'PAIRS',
      currentSeat: 3,
      hands: [[[1, 1]], [[2, 2]], [[5, 5]], [[3, 4]]],
      line: [{ tile: [4, 4], left: 4, right: 4 }],
    });
    const done = applyAction(state, 3, play([3, 4]));
    expect(done.result?.winnerSeats).toEqual([1, 3]);
  });

  it('jogo trancado: quatro passes seguidos e vence a menor soma de pontos', () => {
    let state = makeState({
      hands: [[[0, 1]], [[2, 3]], [[0, 0]], [[6, 6]]],
      line: [{ tile: [5, 5], left: 5, right: 5 }],
    });
    for (let seat = 0; seat < 4; seat += 1) {
      state = applyAction(state, seat, { type: 'PASS' });
    }

    expect(state.status).toBe('FINISHED');
    expect(state.result).toEqual({ reason: 'BLOCKED', winnerSeats: [2], pips: [1, 5, 0, 12] });
  });

  it('jogo trancado em duplas soma os pontos da dupla; empate divide entre todos', () => {
    const pairs = (hands: Tile[][]) => {
      let state = makeState({ teamMode: 'PAIRS', hands, line: [{ tile: [5, 5], left: 5, right: 5 }] });
      for (let seat = 0; seat < 4; seat += 1) state = applyAction(state, seat, { type: 'PASS' });
      return state.result;
    };

    // Dupla 0+2 soma 1+6=7; dupla 1+3 soma 2+2=4
    expect(pairs([[[0, 1]], [[1, 1]], [[3, 3]], [[0, 2]]])?.winnerSeats).toEqual([1, 3]);
    // Empate 4 x 4
    expect(pairs([[[0, 4]], [[1, 1]], [[0, 0]], [[0, 2]]])?.winnerSeats).toEqual([0, 1, 2, 3]);
  });

  it('um passe no meio nao tranca o jogo: a contagem zera quando alguem joga', () => {
    let state = makeState({
      hands: [[[0, 1]], [[2, 5], [1, 1]], [[0, 0]], [[6, 6]]],
      line: [{ tile: [5, 5], left: 5, right: 5 }],
    });
    state = applyAction(state, 0, { type: 'PASS' });
    state = applyAction(state, 1, play([2, 5], 'LEFT'));
    expect(state.consecutivePasses).toBe(0);
    expect(state.status).toBe('PLAYING');
  });
});

describe('Jogadas automaticas e visao de cada jogador', () => {
  it('no tempo esgotado joga a pedra de maior valor que encaixa', () => {
    const state = makeState({ hands: [[[1, 5], [5, 6], [0, 0]], [], [], []], line: [{ tile: [5, 5], left: 5, right: 5 }] });
    expect(autoAction(state, 0)).toEqual(play([5, 6], 'LEFT'));
  });

  it('partidas inteiras com jogadas automaticas sempre terminam e as pedras fecham 28', () => {
    for (const mode of ['SIX_TILES', 'BURRINHO'] as const) {
      for (const teamMode of ['INDIVIDUAL', 'PAIRS'] as const) {
        for (let i = 0; i < 100; i += 1) {
          const done = playOut(dealGame(mode, teamMode));
          const total = done.hands.flat().length + done.boneyard.length + done.line.length;

          expect(done.status).toBe('FINISHED');
          expect(total).toBe(28);
          expect(done.result?.winnerSeats.length).toBeGreaterThan(0);
        }
      }
    }
  });

  it('cada jogador ve so a propria mao ate o fim da partida', () => {
    const state = dealGame('SIX_TILES', 'PAIRS');
    const view = viewFor(state, 1);

    expect(view.hand).toEqual(state.hands[1]);
    expect(view.handSizes).toEqual([6, 6, 6, 6]);
    expect(view.revealedHands).toBeNull();
    expect(JSON.stringify(view)).not.toContain(JSON.stringify(state.boneyard));
  });
});

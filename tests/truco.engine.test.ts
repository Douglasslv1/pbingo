import { describe, expect, it } from 'vitest';
import {
  applyAction,
  autoAction,
  createDeck,
  dealGame,
  handWinner,
  legalActions,
  manilhaFor,
  strength,
  TrucoRuleError,
  viewFor,
} from '../src/modules/truco/truco.engine';
import { Card, HandState, RoundResult, Team, TrucoState } from '../src/modules/truco/truco.types';

/** Mano a mano montado a mao: vira 7 de ouros (manilha Q), o lugar 0 comeca. */
function makeState(hand: Partial<HandState> = {}, overrides: Partial<TrucoState> = {}): TrucoState {
  return {
    teamMode: 'DUEL',
    score: [0, 0],
    dealer: 1,
    handNumber: 1,
    hand: {
      vira: '7O',
      manilha: 'Q',
      hands: [
        ['3E', '4C', '5C'],
        ['2E', '4P', '6C'],
      ],
      rounds: [],
      table: [],
      currentSeat: 0,
      value: 1,
      lastRaiseTeam: null,
      pendingRaise: null,
      elevenDecision: null,
      noRaises: false,
      blind: false,
      ...hand,
    },
    lastHand: null,
    moveCount: 0,
    status: 'PLAYING',
    winner: null,
    ...overrides,
  };
}

const play = (index: number, covered = false) => ({ type: 'PLAY' as const, index, ...(covered ? { covered } : {}) });
const rounds = (...winners: Array<Team | null>): RoundResult[] => winners.map((winner) => ({ winner, plays: [] }));

/** Joga ate o fim so com acoes automaticas (sempre corre de pedidos e joga a carta mais fraca). */
function playOut(state: TrucoState): TrucoState {
  let current = state;
  for (let guard = 0; current.status === 'PLAYING'; guard += 1) {
    if (guard > 2000) throw new Error('partida nao terminou');
    const seat = viewFor(current, 0).actingSeat;
    current = applyAction(current, seat, autoAction(current, seat));
  }
  return current;
}

describe('Baralho e forca das cartas', () => {
  it('usa 40 cartas: sem 8, 9, 10 e coringas', () => {
    const deck = createDeck();
    expect(deck).toHaveLength(40);
    expect(new Set(deck).size).toBe(40);
    expect(deck.some((card) => ['8', '9', '1'].includes(card[0]))).toBe(false);
  });

  it('a manilha e o valor seguinte ao da vira, e depois do 3 volta ao 4', () => {
    expect(manilhaFor('7O')).toBe('Q');
    expect(manilhaFor('KP')).toBe('A');
    expect(manilhaFor('3C')).toBe('4');
  });

  it('manilhas ganham de tudo, na ordem ouros < espadas < copas < paus (zap)', () => {
    const order: Card[] = ['4O', 'KC', 'AE', '2O', '3P', 'QO', 'QE', 'QC', 'QP'];
    const strengths = order.map((card) => strength(card, 'Q'));
    expect([...strengths].sort((a, b) => a - b)).toEqual(strengths);
    // Fora da manilha o naipe nao importa
    expect(strength('3O', 'Q')).toBe(strength('3P', 'Q'));
  });

  it('distribui 3 cartas para cada um e a vira fica fora das maos', () => {
    for (const teamMode of ['DUEL', 'PAIRS'] as const) {
      const state = dealGame(teamMode);
      expect(state.hand.hands).toHaveLength(teamMode === 'DUEL' ? 2 : 4);
      expect(state.hand.hands.every((cards) => cards.length === 3)).toBe(true);
      expect(state.hand.hands.flat()).not.toContain(state.hand.vira);
      expect(state.hand.currentSeat).toBe((state.dealer + 1) % state.hand.hands.length);
    }
  });
});

describe('Rodadas e vencedor da mao', () => {
  it('quem ganha 2 rodadas leva a mao', () => {
    expect(handWinner(rounds(0, 0))).toBe(0);
    expect(handWinner(rounds(0, 1))).toBeUndefined();
    expect(handWinner(rounds(0, 1, 1))).toBe(1);
  });

  it('empates: na 1a decide a seguinte; na 2a ou 3a vale quem ganhou a 1a; tudo empatado ninguem pontua', () => {
    expect(handWinner(rounds(null, 1))).toBe(1);
    expect(handWinner(rounds(null, null))).toBeUndefined();
    expect(handWinner(rounds(null, null, 0))).toBe(0);
    expect(handWinner(rounds(1, null))).toBe(1);
    expect(handWinner(rounds(1, 0, null))).toBe(1);
    expect(handWinner(rounds(null, null, null))).toBeNull();
  });

  it('a carta mais forte vence a rodada e quem venceu abre a proxima', () => {
    let state = applyAction(makeState(), 0, play(0)); // 3 de espadas
    state = applyAction(state, 1, play(0)); // 2 de espadas: perde para o 3
    expect(state.hand.rounds[0].winner).toBe(0);
    expect(state.hand.currentSeat).toBe(0);
  });

  it('cartas de mesmo valor de times diferentes empatam ("cangou")', () => {
    let state = applyAction(makeState(), 0, play(1)); // 4 de copas
    state = applyAction(state, 1, play(1)); // 4 de paus
    expect(state.hand.rounds[0].winner).toBeNull();
    expect(state.hand.currentSeat).toBe(0);
  });

  it('a mao vencida soma o valor ao placar e o carteador passa adiante', () => {
    let state = makeState();
    state = applyAction(state, 0, play(0));
    state = applyAction(state, 1, play(0));
    state = applyAction(state, 0, play(0));
    state = applyAction(state, 1, play(0));
    expect(state.score).toEqual([1, 0]);
    expect(state.lastHand).toMatchObject({ winner: 0, points: 1, reason: 'ROUNDS' });
    expect(state.handNumber).toBe(2);
    expect(state.dealer).toBe(0);
  });
});

describe('Truco, seis, nove e doze', () => {
  it('pedir truco: aceito, a mao vale 3 e so o outro time pode pedir seis', () => {
    let state = applyAction(makeState(), 0, { type: 'TRUCO' });
    expect(legalActions(state, 1)).toEqual([{ type: 'ACCEPT' }, { type: 'RUN' }, { type: 'RAISE' }]);
    expect(legalActions(state, 0)).toEqual([]);

    state = applyAction(state, 1, { type: 'ACCEPT' });
    expect(state.hand.value).toBe(3);
    expect(legalActions(state, 0)).not.toContainEqual({ type: 'TRUCO' });

    state = applyAction(state, 0, play(0));
    expect(legalActions(state, 1)).toContainEqual({ type: 'TRUCO' });
  });

  it('quem corre entrega o valor que a mao tinha antes do pedido', () => {
    const ran = applyAction(applyAction(makeState(), 0, { type: 'TRUCO' }), 1, { type: 'RUN' });
    expect(ran.score).toEqual([1, 0]);
    expect(ran.lastHand).toMatchObject({ winner: 0, points: 1, reason: 'RUN' });

    let state = applyAction(makeState(), 0, { type: 'TRUCO' });
    state = applyAction(state, 1, { type: 'RAISE' }); // aceita o truco e pede seis
    expect(state.hand.value).toBe(3);
    expect(state.hand.pendingRaise).toMatchObject({ requesterSeat: 1, responderSeat: 0, value: 6 });
    state = applyAction(state, 0, { type: 'RUN' });
    expect(state.score).toEqual([0, 3]);
  });

  it('doze e o maximo: nao da para aumentar mais', () => {
    let state = applyAction(makeState(), 0, { type: 'TRUCO' });
    state = applyAction(state, 1, { type: 'RAISE' });
    state = applyAction(state, 0, { type: 'RAISE' });
    state = applyAction(state, 1, { type: 'RAISE' });
    expect(state.hand.pendingRaise?.value).toBe(12);
    expect(legalActions(state, 0)).toEqual([{ type: 'ACCEPT' }, { type: 'RUN' }]);
    state = applyAction(state, 0, { type: 'ACCEPT' });
    expect(state.hand.value).toBe(12);
    expect(legalActions(state, 0)).not.toContainEqual({ type: 'TRUCO' });
  });
});

describe('Carta coberta', () => {
  it('nao pode na 1a rodada; depois pode, e a carta coberta perde para qualquer outra', () => {
    expect(legalActions(makeState(), 0)).not.toContainEqual(play(0, true));

    let state = applyAction(makeState(), 0, play(1));
    state = applyAction(state, 1, play(2)); // 6 ganha do 4: lugar 1 abre a 2a rodada
    state = applyAction(state, 1, play(0, true)); // cobre o 2 de espadas
    state = applyAction(state, 0, play(1)); // 5 de copas
    expect(state.score).toEqual([0, 0]);
    expect(state.hand.rounds[1].winner).toBe(0);
    expect(viewFor(state, 0).rounds[1].plays[0]).toEqual({ seat: 1, card: null, covered: true });
  });
});

describe('Mao de onze e mao de ferro', () => {
  it('com 11 pontos o time decide: jogar vale 3 e ninguem pode pedir truco; correr da 1 ao adversario', () => {
    const eleven = makeState({ elevenDecision: { team: 0, seat: 0 }, noRaises: true }, { score: [11, 4] });
    expect(legalActions(eleven, 0)).toEqual([{ type: 'ACCEPT' }, { type: 'RUN' }]);
    expect(legalActions(eleven, 1)).toEqual([]);

    const played = applyAction(eleven, 0, { type: 'ACCEPT' });
    expect(played.hand.value).toBe(3);
    expect(legalActions(played, 0).some((action) => action.type === 'TRUCO')).toBe(false);

    expect(applyAction(eleven, 0, { type: 'RUN' }).score).toEqual([11, 5]);
  });

  it('nas duplas, o time na mao de onze ve as cartas do parceiro', () => {
    const state = dealGame('PAIRS');
    const eleven: TrucoState = {
      ...state,
      score: [4, 11],
      hand: { ...state.hand, elevenDecision: { team: 1, seat: 1 }, noRaises: true },
    };
    expect(viewFor(eleven, 1).partnerHand).toEqual(eleven.hand.hands[3]);
    expect(viewFor(eleven, 0).partnerHand).toBeNull();
  });

  it('a mao seguinte vira mao de onze quando um time chega a 11, e de ferro quando os dois chegam', () => {
    const eleven = applyAction(applyAction(makeState({}, { score: [10, 4] }), 0, { type: 'TRUCO' }), 1, { type: 'RUN' });
    expect(eleven.score).toEqual([11, 4]);
    expect(eleven.hand.elevenDecision?.team).toBe(0);
    expect(eleven.hand.noRaises).toBe(true);

    const iron = applyAction(applyAction(makeState({}, { score: [10, 11] }), 0, { type: 'TRUCO' }), 1, { type: 'RUN' });
    expect(iron.score).toEqual([11, 11]);
    expect(iron.hand.blind).toBe(true);
    expect(viewFor(iron, 0).hand).toEqual([null, null, null]);
    expect(legalActions(iron, iron.hand.currentSeat).some((action) => action.type === 'TRUCO')).toBe(false);
  });
});

describe('Partida completa', () => {
  it('termina quando um time chega a 12, no mano a mano e nas duplas', () => {
    for (let i = 0; i < 30; i += 1) {
      for (const teamMode of ['DUEL', 'PAIRS'] as const) {
        const final = playOut(dealGame(teamMode));
        expect(final.status).toBe('FINISHED');
        expect(final.score[final.winner!]).toBe(12);
        expect(final.score[final.winner === 0 ? 1 : 0]).toBeLessThan(12);
      }
    }
  });

  it('recusa jogada fora da vez, carta inexistente e acao depois do fim', () => {
    const state = makeState();
    expect(() => applyAction(state, 1, play(0))).toThrow(TrucoRuleError);
    expect(() => applyAction(state, 0, play(5))).toThrow(TrucoRuleError);
    expect(() => applyAction(state, 0, { type: 'ACCEPT' })).toThrow(TrucoRuleError);
    expect(() => applyAction({ ...state, status: 'FINISHED' }, 0, play(0))).toThrow('A partida já terminou');
  });
});

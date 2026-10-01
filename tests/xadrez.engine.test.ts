import { describe, expect, it } from 'vitest';
import {
  applyAction,
  dealGame,
  fromFen,
  inCheck,
  legalMoves,
  XadrezRuleError,
  XadrezState,
} from '../src/modules/xadrez/xadrez.engine';

const sq = (name: string) => (8 - Number(name[1])) * 8 + 'abcdefgh'.indexOf(name[0]);

/** Lance pela notacao de casas (ex.: "e2e4", "e7e8q"). */
function play(state: XadrezState, ...moves: string[]): XadrezState {
  return moves.reduce((current, move) => {
    const promotion = move[4]?.toUpperCase() as 'Q' | 'R' | 'B' | 'N' | undefined;
    return applyAction(current, current.turn, {
      type: 'MOVE',
      from: sq(move.slice(0, 2)),
      to: sq(move.slice(2, 4)),
      ...(promotion ? { promotion } : {}),
    });
  }, state);
}

/** Conta as posicoes alcancaveis: o teste padrao para validar um gerador de lances de xadrez. */
function perft(state: XadrezState, depth: number): number {
  if (depth === 0) return 1;
  const moves = legalMoves(state);
  if (depth === 1) return moves.length;
  return moves.reduce((sum, move) => sum + perft(applyAction(state, state.turn, { type: 'MOVE', ...move }), depth - 1), 0);
}

describe('Xadrez: gerador de lances (perft, valores de referencia)', () => {
  it('posicao inicial: 20, 400 e 8.902', () => {
    const start = dealGame();
    expect([1, 2, 3].map((depth) => perft(start, depth))).toEqual([20, 400, 8902]);
  });

  it('"Kiwipete" (roques, en passant, cravadas): 48, 2.039 e 97.862', () => {
    const kiwipete = fromFen('r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1');
    expect([1, 2, 3].map((depth) => perft(kiwipete, depth))).toEqual([48, 2039, 97862]);
  }, 60_000);

  it('finais com en passant e xeques descobertos: 14, 191, 2.812 e 43.238', () => {
    const endgame = fromFen('8/2p5/3p4/KP5r/1R3p1k/8/4P1P1/8 w - - 0 1');
    expect([1, 2, 3, 4].map((depth) => perft(endgame, depth))).toEqual([14, 191, 2812, 43238]);
  }, 60_000);

  it('promocoes e roque com peca atacada: 6, 264 e 9.467', () => {
    const promotions = fromFen('r3k2r/Pppp1ppp/1b3nbN/nP6/BBP1P3/q4N2/Pp1P2PP/R2Q1RK1 w kq - 0 1');
    expect([1, 2, 3].map((depth) => perft(promotions, depth))).toEqual([6, 264, 9467]);
  }, 60_000);

  it('posicao 5: 44, 1.486 e 62.379', () => {
    const position5 = fromFen('rnbq1k1r/pp1Pbppp/2p5/8/2B5/8/PPP1NnPP/RNBQK2R w KQ - 1 8');
    expect([1, 2, 3].map((depth) => perft(position5, depth))).toEqual([44, 1486, 62379]);
  }, 60_000);
});

describe('Xadrez: fim de partida e regras especiais', () => {
  it('xeque-mate (mate do pastor) da vitoria a quem deu o mate', () => {
    const mate = play(dealGame(), 'e2e4', 'e7e5', 'f1c4', 'b8c6', 'd1h5', 'g8f6', 'h5f7');
    expect(mate.result).toEqual({ winner: 'w', reason: 'CHECKMATE' });
    expect(inCheck(mate, 'b')).toBe(true);
  });

  it('afogamento (sem lances e sem xeque) e empate', () => {
    // Dama em b6 cobre a7, b7 e b8: o rei em a8 nao esta em xeque, mas nao tem para onde ir
    const drawn = play(fromFen('k7/8/2Q5/8/8/8/8/7K w - - 0 1'), 'c6b6');
    expect(drawn.result).toEqual({ winner: null, reason: 'STALEMATE' });
  });

  it('roque: nao pode passar por casa atacada; a torre pula para o lado do rei', () => {
    const attacked = fromFen('r3k2r/8/8/8/8/8/5r2/R3K2R w KQkq - 0 1');
    const kingMoves = legalMoves(attacked).filter((move) => move.from === sq('e1')).map((move) => move.to);
    expect(kingMoves).not.toContain(sq('g1'));

    const castled = play(fromFen('r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1'), 'e1c1');
    expect(castled.board[sq('c1')]).toBe('K');
    expect(castled.board[sq('d1')]).toBe('R');
    expect(castled.castling).toBe('kq');
  });

  it('en passant so vale logo depois do avanco duplo', () => {
    const state = play(dealGame(), 'e2e4', 'a7a6', 'e4e5', 'd7d5');
    const captured = play(state, 'e5d6');
    expect(captured.board[sq('d5')]).toBeNull();
    expect(captured.board[sq('d6')]).toBe('P');

    const late = play(state, 'h2h3', 'h7h6');
    expect(() => play(late, 'e5d6')).toThrow(XadrezRuleError);
  });

  it('promocao: o jogador escolhe a peca, e o lance sem escolha e recusado', () => {
    const state = fromFen('8/4P3/8/8/8/8/k7/7K w - - 0 1');
    expect(() => play(state, 'e7e8')).toThrow('Lance inválido');
    expect(play(state, 'e7e8n').board[sq('e8')]).toBe('N');
  });

  it('empates: material insuficiente, 50 lances e repeticao de posicao', () => {
    expect(play(fromFen('k7/8/8/8/8/8/1q6/K7 w - - 0 1'), 'a1b2').result).toEqual({ winner: null, reason: 'MATERIAL' });
    expect(play(fromFen('k7/8/8/8/8/8/8/K6R w - - 99 80'), 'h1h2').result).toEqual({ winner: null, reason: 'FIFTY_MOVES' });

    const repeated = play(dealGame(), 'g1f3', 'g8f6', 'f3g1', 'f6g8', 'g1f3', 'g8f6', 'f3g1', 'f6g8');
    expect(repeated.result).toEqual({ winner: null, reason: 'REPETITION' });
  });

  it('nao deixa o proprio rei em xeque; desistencia e tempo esgotado encerram a partida', () => {
    const pinned = fromFen('4k3/4r3/8/8/8/8/4B3/4K3 w - - 0 1');
    expect(legalMoves(pinned).some((move) => move.from === sq('e2'))).toBe(false);
    expect(applyAction(dealGame(), 'w', { type: 'RESIGN' }).result).toEqual({ winner: 'b', reason: 'RESIGN' });
    expect(applyAction(dealGame(), 'b', { type: 'TIMEOUT' }).result).toEqual({ winner: 'w', reason: 'TIMEOUT' });
  });
});

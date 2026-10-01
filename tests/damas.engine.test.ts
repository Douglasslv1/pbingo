import { describe, expect, it } from 'vitest';
import { squareName } from '../src/modules/board/board';
import {
  applyAction,
  dealGame,
  DamasPiece,
  DamasRuleError,
  DamasState,
  DRAW_QUIET_KING_PLIES,
  legalPaths,
} from '../src/modules/damas/damas.engine';

/** Casa pelo nome visto pelas brancas (ex.: "c3"). */
const sq = (name: string) => (8 - Number(name[1])) * 8 + 'abcdefgh'.indexOf(name[0]);
const names = (paths: number[][]) => paths.map((path) => path.map(squareName).join('-')).sort();

/** Tabuleiro montado a mao: { c3: 'w', d4: 'b', ... }. */
function position(pieces: Record<string, DamasPiece>, turn: 'w' | 'b' = 'w'): DamasState {
  const board: Array<DamasPiece | null> = Array(64).fill(null);
  Object.entries(pieces).forEach(([name, piece]) => (board[sq(name)] = piece));
  return { board, turn, whiteSeat: 0, quietKingPlies: 0, moveCount: 0, lastMove: null, status: 'PLAYING', result: null };
}

const move = (state: DamasState, ...squares: string[]) =>
  applyAction(state, state.turn, { type: 'MOVE', path: squares.map(sq) });

describe('Damas brasileiras', () => {
  it('comeca com 12 pedras de cada lado nas casas escuras, e as brancas tem 7 lances', () => {
    const state = dealGame();
    expect(state.board.filter((piece) => piece === 'w')).toHaveLength(12);
    expect(state.board.filter((piece) => piece === 'b')).toHaveLength(12);
    expect(state.board[sq('a1')]).toBe('w');
    expect(state.turn).toBe('w');
    expect(legalPaths(state)).toHaveLength(7);
  });

  it('a pedra anda 1 casa para frente na diagonal, nunca para tras', () => {
    expect(names(legalPaths(position({ d4: 'w' })))).toEqual(['d4-c5', 'd4-e5']);
  });

  it('a captura e obrigatoria e a pedra captura tambem para tras', () => {
    const state = position({ d4: 'w', h2: 'w', c3: 'b' });
    expect(names(legalPaths(state))).toEqual(['d4-b2']);
  });

  it('lei da maioria: e obrigatorio a sequencia que captura mais pecas', () => {
    // Por b4 a pedra captura 1; por d4 captura 2 em sequencia
    const state = position({ c3: 'w', b4: 'b', d4: 'b', d6: 'b' });
    expect(names(legalPaths(state))).toEqual(['c3-e5-c7']);
    const after = move(state, 'c3', 'e5', 'c7');
    expect(after.board[sq('d4')]).toBeNull();
    expect(after.board[sq('d6')]).toBeNull();
    expect(after.board[sq('b4')]).toBe('b');
  });

  it('a dama anda e captura a varias casas de distancia (dama voadora)', () => {
    const quiet = position({ a1: 'W', h8: 'b' });
    expect(names(legalPaths(quiet))).toHaveLength(6);

    const capture = position({ a1: 'W', d4: 'b' });
    expect(names(legalPaths(capture))).toEqual(['a1-e5', 'a1-f6', 'a1-g7', 'a1-h8']);
  });

  it('nao pula a mesma peca duas vezes e as capturadas bloqueiam o caminho ate o fim do lance', () => {
    const state = position({ a1: 'W', c3: 'b', c5: 'b', e5: 'b', e3: 'b' });
    const paths = legalPaths(state);
    for (const path of paths) {
      const after = applyAction(state, 'w', { type: 'MOVE', path });
      const removed = 4 - after.board.filter((piece) => piece === 'b').length;
      expect(removed).toBe(path.length - 1);
    }
    // Em volta de d4 nao ha como voltar por c3: a peca capturada continua bloqueando ate o fim do lance
    expect(Math.max(...paths.map((path) => path.length - 1))).toBe(2);
  });

  it('vira dama ao terminar o lance na ultima linha, mas nao se so passar por ela capturando', () => {
    expect(move(position({ c7: 'w' }), 'c7', 'b8').board[sq('b8')]).toBe('W');

    const passing = position({ e5: 'w', d6: 'b', d8: 'b', b6: 'b' });
    const after = move(passing, 'e5', 'c7', 'a5');
    expect(after.board[sq('a5')]).toBe('w');
  });

  it('vence quem deixar o adversario sem pecas ou sem lances', () => {
    const state = move(position({ c3: 'w', d4: 'b' }), 'c3', 'e5');
    expect(state.result).toEqual({ winner: 'w', reason: 'NO_MOVES' });

    // A pedra preta em h8 fica sem lance: g7 ocupada e sem casa livre para capturar
    const blocked = move(position({ h8: 'b', g7: 'w', f6: 'w', c3: 'w' }, 'w'), 'c3', 'd4');
    expect(blocked.result).toEqual({ winner: 'w', reason: 'NO_MOVES' });
  });

  it('empata apos 20 lances seguidos so de damas de cada lado, sem captura', () => {
    let state = position({ a1: 'W', h8: 'B' });
    state = { ...state, quietKingPlies: DRAW_QUIET_KING_PLIES - 1 };
    state = move(state, 'a1', 'b2');
    expect(state.result).toEqual({ winner: null, reason: 'DRAW_KINGS' });
  });

  it('desistencia e tempo esgotado dao a vitoria ao adversario; lance invalido e recusado', () => {
    const state = dealGame();
    expect(applyAction(state, 'b', { type: 'RESIGN' }).result).toEqual({ winner: 'w', reason: 'RESIGN' });
    expect(applyAction(state, 'w', { type: 'TIMEOUT' }).result).toEqual({ winner: 'b', reason: 'TIMEOUT' });
    expect(() => move(state, 'c3', 'c4')).toThrow(DamasRuleError);
    expect(() => applyAction(state, 'b', { type: 'MOVE', path: [sq('b6'), sq('a5')] })).toThrow('Não é a sua vez');
  });
});

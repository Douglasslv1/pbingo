export type GameName = 'DOMINO' | 'TRUCO';

/** Valores de entrada das mesas, em chaves. */
export const STAKES = [1, 2, 5] as const;
export type Stake = (typeof STAKES)[number];

export interface QueueChoice {
  mode: string;
  teamMode: string;
  stake: Stake;
}

/** Regra violada por uma jogada; o servico de mesas a transforma em erro 422. */
export class GameRuleError extends Error {
  constructor(message: string) {
    super(message);
    this.name = this.constructor.name;
  }
}

/**
 * O que o servico de mesas precisa saber de cada jogo. Fila, pote, cronometro, jogador ausente,
 * historico e admin sao comuns; so as regras mudam de um jogo para outro.
 */
export interface GameAdapter<S = unknown, A = unknown> {
  game: GameName;
  /** Nome do jogo nas mensagens ao jogador (ex.: "dominó"). */
  label: string;
  enabled(): boolean;
  /** Entrada gratuita e sem premio (testes). */
  free(): boolean;
  turnSeconds(): number;
  seatsFor(teamMode: string): number;
  deal(mode: string, teamMode: string): S;
  apply(state: S, seat: number, action: A): S;
  autoAction(state: S, seat: number): A;
  /** Lugar que deve agir agora (jogar, responder a um pedido, decidir). */
  actingSeat(state: S): number;
  /** A unica acao possivel e passar/comprar: o servidor faz sem esperar. */
  isForced(state: S): boolean;
  isFinished(state: S): boolean;
  winnerSeats(state: S): number[];
  moveCount(state: S): number;
  viewFor(state: S, seat: number): unknown;
  /** Cartas/pedras de um lugar, para o admin conferir reclamacoes. */
  handOf(state: S, seat: number): unknown;
  /** Resumo do resultado para o historico e o admin (motivo, placar). */
  summary(state: S): Record<string, unknown>;
  /** Como a acao fica gravada no registro de jogadas (ex.: com a carta jogada, nao so a posicao). */
  record?(stateBefore: S, seat: number, action: A): unknown;
}

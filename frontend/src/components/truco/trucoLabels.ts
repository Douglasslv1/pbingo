import type { TrucoCard, TrucoRank, TrucoSuit } from '../../types';

/** Do mais fraco ao mais forte. */
export const RANKS: TrucoRank[] = ['4', '5', '6', '7', 'Q', 'J', 'K', 'A', '2', '3'];
/** Naipes da manilha, do mais fraco ao mais forte. */
export const SUITS: TrucoSuit[] = ['O', 'E', 'C', 'P'];

export const SUIT_SYMBOL: Record<TrucoSuit, string> = { O: '♦', E: '♠', C: '♥', P: '♣' };
export const SUIT_NAME: Record<TrucoSuit, string> = { O: 'ouros', E: 'espadas', C: 'copas', P: 'paus' };
/** Apelidos tradicionais das manilhas. */
export const MANILHA_NICKNAME: Record<TrucoSuit, string> = { O: 'pica-fumo', E: 'espadilha', C: 'copas', P: 'zap' };

const RANK_NAME: Partial<Record<TrucoRank, string>> = { Q: 'dama', J: 'valete', K: 'rei', A: 'ás' };

export const rankOf = (card: TrucoCard) => card[0] as TrucoRank;
export const suitOf = (card: TrucoCard) => card[1] as TrucoSuit;
export const cardName = (card: TrucoCard) => `${RANK_NAME[rankOf(card)] ?? rankOf(card)} de ${SUIT_NAME[suitOf(card)]}`;

/** Nome de cada valor da mao. */
export const VALUE_NAME: Record<number, string> = { 1: 'normal', 3: 'truco', 6: 'seis', 9: 'nove', 12: 'doze' };
export const NEXT_VALUE: Record<number, number> = { 1: 3, 3: 6, 6: 9, 9: 12 };

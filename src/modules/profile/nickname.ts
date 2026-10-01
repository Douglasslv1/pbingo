import { z } from 'zod';

/** Dias de espera entre uma troca de apelido e outra (a primeira escolha e livre). */
export const NICKNAME_CHANGE_DAYS = 30;

const RESERVED = ['admin', 'administrador', 'pbingu', 'suporte', 'jogador', 'moderador', 'sistema'];
// Palavras proibidas em qualquer parte do apelido, e as curtas so quando sao o apelido inteiro
const BLOCKED_PARTS = ['caralh', 'buceta', 'arrombad', 'vagabund', 'xoxota', 'porra', 'merda', 'cacete', 'fodase', 'putaria', 'filhadaputa', 'filhodaputa'];
const BLOCKED_WHOLE = ['puta', 'cu', 'fdp', 'pqp', 'viado', 'corno', 'bosta', 'foda', 'rola', 'pinto'];
const LEET: Record<string, string> = { '0': 'o', '1': 'i', '3': 'e', '4': 'a', '5': 's', '7': 't', '@': 'a' };

/** Forma usada para comparar: sem acentos, sem separadores e com numeros "disfarcados" de letras. */
function normalize(nickname: string): string {
  return nickname
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[01345@7]/g, (char) => LEET[char])
    .replace(/[_.-]/g, '');
}

export const nicknameSchema = z.object({
  nickname: z
    .string()
    .trim()
    .regex(/^[\p{L}\p{N}_.-]{3,20}$/u, 'O apelido deve ter de 3 a 20 letras, números, "_", "." ou "-", sem espaços')
    .refine((value) => {
      const plain = normalize(value);
      return !RESERVED.includes(plain) && !BLOCKED_WHOLE.includes(plain) && !BLOCKED_PARTS.some((part) => plain.includes(part));
    }, 'Este apelido não é permitido. Escolha outro.'),
});

/** Nome publico do jogador (mesas e ranking): o apelido, ou "Jogador #0042" - nunca o nome real. */
export function displayName(user: { nickname: string | null; playerNumber: number }): string {
  return user.nickname ?? `Jogador #${String(user.playerNumber).padStart(4, '0')}`;
}

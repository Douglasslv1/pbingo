import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { AppError } from '../../utils/errors';
import { displayName, NICKNAME_CHANGE_DAYS } from './nickname';

const DAY_MS = 24 * 60 * 60 * 1000;

/** Data a partir da qual o apelido pode ser trocado de novo (null: pode agora). */
function nextChangeAt(user: { nickname: string | null; nicknameChangedAt: Date | null }, now = new Date()): Date | null {
  if (!user.nickname || !user.nicknameChangedAt) return null;
  const allowed = new Date(user.nicknameChangedAt.getTime() + NICKNAME_CHANGE_DAYS * DAY_MS);
  return allowed > now ? allowed : null;
}

/** Partidas e vitorias de um jogo de mesa. */
async function tableStats(userId: string, game: string) {
  const where = { userId, table: { game, status: 'FINISHED' as const } };
  const [matches, wins] = await Promise.all([
    prisma.gameSeat.count({ where }),
    prisma.gameSeat.count({ where: { ...where, isWinner: true } }),
  ]);
  return { matches, wins };
}

/** Perfil do proprio jogador: apelido e resumo por jogo (os premios so ele ve). */
export async function getProfile(userId: string) {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  const [rounds, roundsWon, domino, truco, damas, xadrez, prizes] = await Promise.all([
    prisma.ticket.findMany({ where: { userId, round: { status: 'FINISHED' } }, distinct: ['roundId'], select: { roundId: true } }),
    prisma.ticket.findMany({ where: { userId, isWinner: true }, distinct: ['roundId'], select: { roundId: true } }),
    tableStats(userId, 'DOMINO'),
    tableStats(userId, 'TRUCO'),
    tableStats(userId, 'DAMAS'),
    tableStats(userId, 'XADREZ'),
    prisma.transaction.groupBy({
      by: ['game'],
      where: { userId, type: 'PRIZE_PAYOUT', status: 'COMPLETED' },
      _sum: { amountFiat: true },
    }),
  ]);
  const prizeOf = (game: string) =>
    (prizes.find((row) => row.game === game)?._sum.amountFiat ?? new Prisma.Decimal(0)).toString();

  return {
    name: user.name,
    email: user.email,
    nickname: user.nickname,
    displayName: displayName(user),
    memberSince: user.createdAt.toISOString(),
    nicknameChangeAt: nextChangeAt(user)?.toISOString() ?? null,
    games: {
      BINGO: { matches: rounds.length, wins: roundsWon.length, prizes: prizeOf('BINGO') },
      DOMINO: { ...domino, prizes: prizeOf('DOMINO') },
      TRUCO: { ...truco, prizes: prizeOf('TRUCO') },
      DAMAS: { ...damas, prizes: prizeOf('DAMAS') },
      XADREZ: { ...xadrez, prizes: prizeOf('XADREZ') },
    },
  };
}

/** Escolhe ou troca o apelido: unico na plataforma e no maximo uma troca a cada 30 dias. */
export async function setNickname(userId: string, nickname: string) {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  if (user.nickname === nickname) return getProfile(userId);

  const waitUntil = nextChangeAt(user);
  if (waitUntil) {
    throw new AppError(`Você poderá trocar o apelido a partir de ${waitUntil.toLocaleDateString('pt-BR')}`, 409);
  }

  const taken = await prisma.user.findFirst({
    where: { nickname: { equals: nickname, mode: 'insensitive' }, NOT: { id: userId } },
    select: { id: true },
  });
  if (taken) {
    throw new AppError('Este apelido já está em uso', 409);
  }

  try {
    await prisma.user.update({ where: { id: userId }, data: { nickname, nicknameChangedAt: new Date() } });
  } catch (err) {
    // Duas pessoas escolhendo o mesmo apelido ao mesmo tempo: o indice unico decide
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      throw new AppError('Este apelido já está em uso', 409);
    }
    throw err;
  }
  return getProfile(userId);
}

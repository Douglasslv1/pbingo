import { motion } from 'framer-motion';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { formatBrl } from '../format';
import { useAuth } from '../hooks/useAuth';
import { useGameConfig } from '../hooks/useGameConfig';
import DominoTile from './domino/DominoTile';
import PlayingCard from './truco/PlayingCard';

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0 },
};

/** Mini cartela para ilustrar os Numeros da sorte. */
function MiniCard() {
  const numbers = [4, 19, 33, 48, 62, 11, 27, 0, 52, 70, 8, 22, 41, 57, 66];
  const marked = new Set([4, 33, 0, 52, 22, 66]);
  return (
    <div className="mini-card" aria-hidden="true">
      {numbers.map((n, i) => (
        <span key={i} className={marked.has(n) ? 'marked' : undefined}>
          {n === 0 ? '★' : n}
        </span>
      ))}
    </div>
  );
}

interface Game {
  key: string;
  title: string;
  art: ReactNode;
  description: string;
  bullets: string[];
  to: string;
  open: boolean;
}

/** Cards dos jogos (pagina inicial e pagina Jogos). Admins entram mesmo nos jogos ainda nao liberados. */
export default function GameCards() {
  const config = useGameConfig();
  const isAdmin = useAuth().auth?.user.role === 'ADMIN';
  const potOf = (seats: number, stake = 1) => (config ? formatBrl(config.prizeContributionPerTicket * seats * stake) : null);
  const boardBullet = config?.boardGamesFree ? 'Grátis durante os testes' : 'Mesas de 1, 2 ou 5 chaves';
  const seconds = config?.boardTurnSeconds ?? 60;

  const games: Game[] = [
    {
      key: 'lucky',
      title: 'Números da sorte',
      art: <MiniCard />,
      description: 'Receba sua cartela, acompanhe o sorteio ao vivo e torça para completar primeiro.',
      bullets: [
        `Rodadas a cada ${config?.roundIntervalMinutes ?? 15} minutos`,
        `Começa com no mínimo ${config?.minPlayersPerRound ?? 5} jogadores - senão, a chave volta`,
        'Prêmio acumulado cresce a cada jogador',
      ],
      to: '/app',
      open: true,
    },
    {
      key: 'domino',
      title: 'Dominó',
      art: (
        <>
          <DominoTile first={2} second={5} size={30} />
          <DominoTile first={5} second={5} vertical size={30} />
          <DominoTile first={5} second={1} size={30} />
        </>
      ),
      description: 'Mesas de 4 jogadores ou mano a mano, com a sua estratégia decidindo cada jogada.',
      bullets: [
        '6 peças ou Burrinho, individual, em duplas ou mano a mano',
        '30 segundos por jogada - partidas rápidas',
        config?.dominoFree ? 'Grátis durante os testes' : `Prêmio de até ${potOf(4, 5)} por mesa`,
      ],
      to: '/domino',
      open: config?.dominoEnabled ?? false,
    },
    {
      key: 'truco',
      title: 'Truco',
      art: (
        <>
          <PlayingCard card="4P" />
          <PlayingCard card="7C" />
          <PlayingCard card="AE" />
        </>
      ),
      description: 'Truco Paulista com manilha pela vira: blefe, leitura do adversário e o famoso grito de truco.',
      bullets: ['Mano a mano ou em duplas, até 12 pontos', 'Mesas de 1, 2 ou 5 chaves', `Prêmio de até ${potOf(2, 5)} por mesa`],
      to: '/truco',
      open: config?.trucoEnabled ?? false,
    },
    {
      key: 'damas',
      title: 'Damas',
      art: (
        <>
          <span className="checker w" />
          <span className="checker b king">♛{'︎'}</span>
          <span className="checker w" />
        </>
      ),
      description: 'Damas pela regra brasileira: captura obrigatória, lei da maioria e dama que voa.',
      bullets: [`Mano a mano, ${seconds}s por lance`, 'Captura em sequência e dama voadora', boardBullet],
      to: '/damas',
      open: config?.damasEnabled ?? false,
    },
    {
      key: 'xadrez',
      title: 'Xadrez',
      art: (
        <>
          <span className="chess-piece w">♞{'︎'}</span>
          <span className="chess-piece b">♛{'︎'}</span>
          <span className="chess-piece w">♜{'︎'}</span>
        </>
      ),
      description: 'Xadrez pelas regras oficiais, mano a mano, do roque à promoção do peão.',
      bullets: [`Mano a mano, ${seconds}s por lance`, 'Roque, en passant, promoção e empates oficiais', boardBullet],
      to: '/xadrez',
      open: config?.xadrezEnabled ?? false,
    },
  ];

  return (
    <div className="game-cards">
      {games.map((game, index) => {
        const open = game.open || isAdmin;
        return (
          <motion.article
            key={game.key}
            className={`game-card ${game.key}`}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.3 }}
            variants={fadeUp}
            transition={{ delay: index * 0.08 }}
          >
            {!game.open && <span className="soon-badge">Em breve</span>}
            <div className="game-card-art tiles">{game.art}</div>
            <h3>{game.title}</h3>
            <p>{game.description}</p>
            <ul>
              {game.bullets.map((bullet) => (
                <li key={bullet}>{bullet}</li>
              ))}
            </ul>
            {open ? (
              <Link to={game.to} className="cta-button">
                Jogar {game.title}
              </Link>
            ) : (
              <span className="cta-disabled">Disponível em breve</span>
            )}
          </motion.article>
        );
      })}
    </div>
  );
}

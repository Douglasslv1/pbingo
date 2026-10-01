import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import DominoTile from '../components/domino/DominoTile';
import FloatingBalls from '../components/FloatingBalls';
import LiveRoundTeaser from '../components/LiveRoundTeaser';
import Logo from '../components/Logo';
import { formatBrl } from '../format';
import { useGameConfig } from '../hooks/useGameConfig';

const STEPS = [
  { title: 'Crie sua conta', text: 'Cadastro rápido com nome, e-mail e data de nascimento. Sua carteira já nasce pronta.' },
  { title: 'Compre chaves via Pix', text: 'Cada chave é uma entrada em uma rodada ou mesa. O Pix cai na hora.' },
  { title: 'Escolha o jogo', text: 'Números da sorte para torcer, Dominó para mostrar estratégia.' },
  { title: 'Ganhe e saque', text: 'O prêmio vai para o seu saldo e você saca via Pix para a sua conta.' },
];

const TRUST_POINTS = [
  {
    title: 'Ninguém escolhe o resultado',
    text: 'Os números e as pedras são sorteados pelo servidor com gerador aleatório criptográfico, sem intervenção de ninguém.',
  },
  {
    title: 'Seu saldo sempre confere',
    text: 'Cada chave e cada centavo ficam registrados. O sistema não deixa nenhum saldo ficar negativo.',
  },
  {
    title: 'Jogo e prêmio separados',
    text: 'Chaves para jogar e prêmios em dinheiro ficam em saldos diferentes - você sempre sabe o que pode sacar.',
  },
  {
    title: 'Sem jogadores, sem prejuízo',
    text: 'Rodada ou mesa que não completa o mínimo de jogadores é cancelada e a sua chave volta na hora.',
  },
];

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0 },
};

/** Composicao do topo: bolinhas da sorte e pedras de domino flutuando. */
function HeroArt() {
  const float = (delay: number, distance = 10) => ({
    animate: { y: [0, -distance, 0] },
    transition: { duration: 4, repeat: Infinity, ease: 'easeInOut' as const, delay },
  });

  return (
    <div className="hero-art" aria-hidden="true">
      <motion.div className="hero-ball big" {...float(0, 12)}>
        7
      </motion.div>
      <motion.div className="hero-ball" {...float(0.8)}>
        23
      </motion.div>
      <motion.div className="hero-ball small" {...float(1.6, 8)}>
        61
      </motion.div>
      <motion.div className="hero-tile one" {...float(0.4, 14)}>
        <DominoTile first={6} second={6} vertical size={44} />
      </motion.div>
      <motion.div className="hero-tile two" {...float(1.2, 10)}>
        <DominoTile first={3} second={5} size={40} />
      </motion.div>
    </div>
  );
}

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

export default function LandingPage() {
  const config = useGameConfig();
  const keyPrice = config ? formatBrl(config.creditPriceBrl * config.ticketPriceCredits) : 'R$ 3,50';
  const prizeShare = config ? 100 - config.houseFeePercent : 80;
  const minPlayers = config?.minPlayersPerRound ?? 5;
  const interval = config?.roundIntervalMinutes ?? 15;
  const dominoOpen = config?.dominoEnabled ?? false;
  const dominoPrize = config ? formatBrl(config.prizeContributionPerTicket * 4) : null;

  return (
    <div className="landing">
      <nav className="landing-nav">
        <Link to="/" className="brand-link" aria-label="Pbingu - página inicial">
          <Logo size={34} />
        </Link>
        <div className="landing-nav-links">
          <a href="#jogos">Jogos</a>
          <a href="#como-funciona">Como funciona</a>
          <Link to="/suporte">Suporte</Link>
          <Link to="/app" className="cta-button cta-small">
            Entrar
          </Link>
        </div>
      </nav>

      <header className="hero">
        <FloatingBalls count={7} />
        <div className="hero-content">
          <motion.span
            className="hero-eyebrow"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
          >
            Números da sorte · Dominó
          </motion.span>
          <motion.h1 initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
            Jogue com sorte e estratégia. <span>Ganhe prêmios de verdade.</span>
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
          >
            Dois jogos, uma carteira só. Compre chaves via Pix, escolha como quer jogar e saque os seus prêmios direto na
            sua conta.
          </motion.p>
          <motion.div
            className="hero-actions"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
          >
            <motion.div whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }}>
              <Link to="/app" className="cta-button">
                Começar a jogar
              </Link>
            </motion.div>
            <a href="#jogos" className="cta-secondary">
              Conhecer os jogos
            </a>
          </motion.div>
          <LiveRoundTeaser />
        </div>
        <HeroArt />
      </header>

      <section className="stats-strip" aria-label="Resumo">
        <div>
          <strong>{keyPrice}</strong>
          <span>por chave</span>
        </div>
        <div>
          <strong>{prizeShare}%</strong>
          <span>de cada entrada vira prêmio</span>
        </div>
        <div>
          <strong>Pix</strong>
          <span>para comprar e sacar</span>
        </div>
        <div>
          <strong>18+</strong>
          <span>só para maiores</span>
        </div>
      </section>

      <section id="jogos" className="games-section">
        <h2>Escolha o seu jogo</h2>
        <div className="game-cards">
          <motion.article
            className="game-card lucky"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.3 }}
            variants={fadeUp}
          >
            <div className="game-card-art">
              <MiniCard />
            </div>
            <h3>Números da sorte</h3>
            <p>Receba sua cartela, acompanhe o sorteio ao vivo e torça para completar primeiro.</p>
            <ul>
              <li>Rodadas a cada {interval} minutos</li>
              <li>Começa com no mínimo {minPlayers} jogadores - senão, a chave volta</li>
              <li>Prêmio acumulado cresce a cada jogador</li>
            </ul>
            <Link to="/app" className="cta-button">
              Jogar Números da sorte
            </Link>
          </motion.article>

          <motion.article
            className="game-card domino"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.3 }}
            variants={fadeUp}
            transition={{ delay: 0.1 }}
          >
            {!dominoOpen && <span className="soon-badge">Em breve</span>}
            <div className="game-card-art tiles">
              <DominoTile first={2} second={5} size={30} />
              <DominoTile first={5} second={5} vertical size={30} />
              <DominoTile first={5} second={1} size={30} />
            </div>
            <h3>Dominó</h3>
            <p>Mesas de 4 jogadores ou mano a mano, com a sua estratégia decidindo cada jogada.</p>
            <ul>
              <li>6 peças ou Burrinho, individual, em duplas ou mano a mano</li>
              <li>30 segundos por jogada - partidas rápidas</li>
              <li>
                {config?.dominoFree
                  ? 'Grátis durante os testes'
                  : dominoPrize
                    ? `Prêmio de até ${dominoPrize} por mesa`
                    : 'Prêmio para quem bater'}
              </li>
            </ul>
            {dominoOpen ? (
              <Link to="/domino" className="cta-button">
                Jogar Dominó
              </Link>
            ) : (
              <span className="cta-disabled">Disponível em breve</span>
            )}
          </motion.article>
        </div>
      </section>

      <section id="como-funciona" className="how-it-works">
        <h2>Como funciona</h2>
        <ol className="steps">
          {STEPS.map((step, index) => (
            <motion.li
              className="step-card"
              key={step.title}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, amount: 0.4 }}
              variants={fadeUp}
              transition={{ duration: 0.4, delay: index * 0.08 }}
            >
              <span className="step-number">{index + 1}</span>
              <h3>{step.title}</h3>
              <p>{step.text}</p>
            </motion.li>
          ))}
        </ol>
      </section>

      <section className="trust-section">
        <h2>Por que confiar no Pbingu</h2>
        <div className="trust-grid">
          {TRUST_POINTS.map((point, index) => (
            <motion.div
              key={point.title}
              className="trust-card"
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, amount: 0.5 }}
              variants={fadeUp}
              transition={{ duration: 0.4, delay: index * 0.08 }}
            >
              <h3>{point.title}</h3>
              <p>{point.text}</p>
            </motion.div>
          ))}
        </div>
      </section>

      <section className="final-cta">
        <h2>Pronto para testar a sua sorte?</h2>
        <p>Crie sua conta em menos de um minuto.</p>
        <Link to="/app" className="cta-button">
          Criar minha conta
        </Link>
      </section>

      <footer className="landing-footer">
        <nav className="landing-footer-links">
          <Link to="/suporte">Central de ajuda</Link>
          <Link to="/termos">Termos de Uso</Link>
          <Link to="/privacidade">Privacidade</Link>
        </nav>
        <span>
          <span className="age-badge">18+</span> Proibido para menores · Jogue com responsabilidade · ©{' '}
          {new Date().getFullYear()} Pbingu
        </span>
      </footer>
    </div>
  );
}

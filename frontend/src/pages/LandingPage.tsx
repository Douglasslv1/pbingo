import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import DominoTile from '../components/domino/DominoTile';
import FloatingBalls from '../components/FloatingBalls';
import GameCards from '../components/GameCards';
import LiveRoundTeaser from '../components/LiveRoundTeaser';
import Logo from '../components/Logo';
import { formatBrl } from '../format';
import { useGameConfig } from '../hooks/useGameConfig';

const STEPS = [
  { title: 'Crie sua conta', text: 'Cadastro rápido com nome, e-mail e data de nascimento. Sua carteira já nasce pronta.' },
  { title: 'Compre chaves via Pix', text: 'Cada chave é uma entrada em uma rodada ou mesa. O Pix cai na hora.' },
  { title: 'Escolha o jogo', text: 'Números da sorte para torcer; Dominó, Truco, Damas e Xadrez para mostrar estratégia.' },
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

export default function LandingPage() {
  const config = useGameConfig();
  const keyPrice = config ? formatBrl(config.creditPriceBrl * config.ticketPriceCredits) : 'R$ 3,50';
  const prizeShare = config ? 100 - config.houseFeePercent : 80;

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
            Números da sorte · Dominó · Truco · Damas · Xadrez
          </motion.span>
          <motion.h1 initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
            Jogue com sorte e estratégia. <span>Ganhe prêmios de verdade.</span>
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
          >
            Cinco jogos, uma carteira só. Compre chaves via Pix, escolha como quer jogar e saque os seus prêmios direto na
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
        <GameCards />
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

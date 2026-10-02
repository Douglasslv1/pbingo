import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import DominoTile from '../components/domino/DominoTile';
import GameCards from '../components/GameCards';
import Logo from '../components/Logo';
import PlayingCard from '../components/truco/PlayingCard';
import { useGameConfig } from '../hooks/useGameConfig';

const STEPS = [
  {
    title: 'Crie sua conta',
    text: 'Cadastro rápido com nome, e-mail e data de nascimento. Depois escolha o apelido que os outros jogadores vão ver.',
  },
  { title: 'Escolha o jogo', text: 'Dominó, truco, damas, xadrez ou ludo: mano a mano, em duplas ou com quatro na mesa.' },
  {
    title: 'Jogue em tempo real',
    text: 'A mesa completa e a partida começa sozinha. Cada um tem seu tempo por jogada, sem ninguém travar o jogo.',
  },
  { title: 'Suba no ranking', text: 'Cada vitória conta no ranking do mês e no geral. Mostre quem manda na mesa.' },
];

const TRUST_POINTS = [
  {
    title: 'Embaralhamento justo',
    text: 'Pedras e cartas são embaralhadas pelo servidor com gerador aleatório criptográfico. Ninguém vê a mão de ninguém.',
  },
  {
    title: 'Regras oficiais',
    text: 'Xadrez pela FIDE, damas pela regra brasileira, truco paulista e dominó como se joga no Brasil, com as regras sempre à mão.',
  },
  {
    title: 'Ninguém trava a partida',
    text: 'Cada jogada tem seu tempo. Se alguém cai, o sistema joga por ele até voltar - e a mesa segue.',
  },
  {
    title: 'Mesas com entrada, sem surpresa',
    text: 'Nas mesas com entrada, cada chave fica registrada na sua carteira e a mesa que não completa devolve a chave na hora.',
  },
];

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0 },
};

/** Composicao do topo: pecas dos jogos de mesa flutuando. */
function HeroArt() {
  const float = (delay: number, distance = 10) => ({
    animate: { y: [0, -distance, 0] },
    transition: { duration: 5, repeat: Infinity, ease: 'easeInOut' as const, delay },
  });

  return (
    <div className="hero-art" aria-hidden="true">
      <motion.div className="hero-piece knight" {...float(0, 12)}>
        <span className="chess-piece w">♞{'︎'}</span>
      </motion.div>
      <motion.div className="hero-piece checkers" {...float(0.9, 8)}>
        <span className="checker b king">♛{'︎'}</span>
        <span className="checker w" />
      </motion.div>
      <motion.div className="hero-piece cards" {...float(1.6)}>
        <PlayingCard card="4P" size="large" />
        <PlayingCard card="7C" size="large" />
      </motion.div>
      <motion.div className="hero-piece tile-one" {...float(0.4, 14)}>
        <DominoTile first={6} second={6} vertical size={40} />
      </motion.div>
      <motion.div className="hero-piece tile-two" {...float(1.2, 10)}>
        <DominoTile first={3} second={5} size={36} />
      </motion.div>
    </div>
  );
}

export default function LandingPage() {
  const config = useGameConfig();
  const freeGames = [config?.dominoFree && 'dominó', config?.boardGamesFree && 'damas e xadrez', config?.ludoFree && 'ludo']
    .filter(Boolean)
    .join(', ');

  return (
    <div className="landing">
      <nav className="landing-nav">
        <Link to="/" className="brand-link" aria-label="Pbingu - página inicial">
          <Logo size={34} />
        </Link>
        <div className="landing-nav-links">
          <a href="#jogos">Jogos</a>
          <Link to="/ranking">Ranking</Link>
          <a href="#como-funciona">Como funciona</a>
          <Link to="/suporte">Suporte</Link>
          <Link to="/app" className="cta-button cta-small">
            Entrar
          </Link>
        </div>
      </nav>

      <header className="hero">
        <div className="hero-content">
          <motion.span
            className="hero-eyebrow"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
          >
            Dominó · Truco · Damas · Xadrez · Ludo
          </motion.span>
          <motion.h1 initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
            Os jogos de mesa de sempre, <span>agora online.</span>
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
          >
            Sente à mesa com gente de todo o Brasil para uma partida de dominó, um truco em dupla, um ludo com os amigos
            ou um mano a mano de damas e xadrez. Pelo celular ou computador, sem instalar nada.
          </motion.p>
          <motion.div
            className="hero-actions"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
          >
            <motion.div whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }}>
              <Link to="/app" className="cta-button">
                Jogar agora
              </Link>
            </motion.div>
            <a href="#jogos" className="cta-secondary">
              Conhecer os jogos
            </a>
          </motion.div>
        </div>
        <HeroArt />
      </header>

      <section className="stats-strip" aria-label="Resumo">
        <div>
          <strong>5 jogos</strong>
          <span>dominó, truco, damas, xadrez e ludo</span>
        </div>
        {freeGames && (
          <div>
            <strong>Grátis</strong>
            <span>{freeGames} sem pagar nada</span>
          </div>
        )}
        <div>
          <strong>Ranking</strong>
          <span>do mês e geral, em cada jogo</span>
        </div>
        <div>
          <strong>Tempo real</strong>
          <span>partidas rápidas, sem instalar nada</span>
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
        <h2>Jogo limpo, do começo ao fim</h2>
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
        <h2>Sua mesa está esperando</h2>
        <p>Crie sua conta e jogue a primeira partida em menos de um minuto.</p>
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

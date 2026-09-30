import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import FloatingBalls from '../components/FloatingBalls';
import LiveRoundTeaser from '../components/LiveRoundTeaser';

const STEPS = [
  {
    title: '1. Crie sua conta',
    description: 'Cadastro rapido com nome, e-mail e senha. Sua carteira de chaves e de premios ja nasce pronta.',
  },
  {
    title: '2. Compre chaves via Pix',
    description: 'As chaves sao usadas para entrar nas rodadas. Pagamento via Pix, direto na plataforma.',
  },
  {
    title: '3. Entre na rodada e acompanhe o sorteio',
    description: 'Rodadas a cada 15 minutos, com no minimo 5 jogadores - se nao completar, sua chave volta. Os numeros sao sorteados em tempo real, com a cartela marcando automaticamente.',
  },
  {
    title: '4. Ganhe e saque',
    description: 'O premio acumulado da rodada vai direto para o seu saldo sacavel. Peca o saque quando quiser.',
  },
];

const TRUST_POINTS = [
  'Seu saldo nunca some. Cada centavo e cada chave ficam registrados com seguranca.',
  'Sorteio 100% verificado - sem trapaca possivel, sem depender de confiar na nossa palavra.',
  'Pagamentos processados com cuidado: ou a transacao acontece certinho, ou nao acontece.',
  'Chaves para jogar e premios em dinheiro nunca se misturam - cada saldo no seu lugar.',
];

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0 },
};

export default function LandingPage() {
  return (
    <div className="landing">
      <nav className="landing-nav">
        <span className="brand">Pbingu</span>
        <div className="landing-nav-links">
          <a href="#como-funciona">Como funciona</a>
          <Link to="/suporte">Suporte</Link>
          <Link to="/app" className="cta-button cta-small">
            Entrar
          </Link>
        </div>
      </nav>

      <header className="hero">
        <FloatingBalls />

        <LiveRoundTeaser />

        <motion.h1 initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
          Bingo online, rodadas rapidas, premios reais.
        </motion.h1>
        <motion.p
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
        >
          O Pbingu e uma plataforma de bingo com rodadas a cada 15 minutos, sorteio em tempo real e premios
          sacaveis em dinheiro. Compre suas chaves via Pix, entre na rodada e acompanhe cada numero sendo sorteado na
          hora.
        </motion.p>
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.97 }} style={{ display: 'inline-block' }}>
            <Link to="/app" className="cta-button">
              Jogar agora
            </Link>
          </motion.div>
        </motion.div>
      </header>

      <section id="como-funciona" className="how-it-works">
        <h2>Como funciona</h2>
        <div className="steps">
          {STEPS.map((step, index) => (
            <motion.div
              className="step-card"
              key={step.title}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, amount: 0.4 }}
              variants={fadeUp}
              transition={{ duration: 0.4, delay: index * 0.08 }}
              whileHover={{ y: -4 }}
            >
              <h3>{step.title}</h3>
              <p>{step.description}</p>
            </motion.div>
          ))}
        </div>
      </section>

      <section className="trust-section">
        <h2>Seguranca em primeiro lugar</h2>
        <ul>
          {TRUST_POINTS.map((point, index) => (
            <motion.li
              key={point}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, amount: 0.6 }}
              variants={fadeUp}
              transition={{ duration: 0.4, delay: index * 0.08 }}
            >
              {point}
            </motion.li>
          ))}
        </ul>
      </section>

      <footer className="landing-footer">
        <Link to="/suporte">Central de ajuda</Link>
        <span>© {new Date().getFullYear()} Pbingu</span>
      </footer>
    </div>
  );
}

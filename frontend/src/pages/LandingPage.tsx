import { Link } from 'react-router-dom';

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
    description: 'Cada rodada abre por 1 minuto para entrada. Os numeros sao sorteados em tempo real, com a cartela marcando automaticamente.',
  },
  {
    title: '4. Ganhe e saque',
    description: 'O premio acumulado da rodada vai direto para o seu saldo sacavel. Peca o saque quando quiser.',
  },
];

const TRUST_POINTS = [
  'Saldo de chaves e premios nunca fica negativo - garantido pelo banco de dados.',
  'Toda validacao de vitoria e de saldo acontece no servidor, nunca so no navegador.',
  'Operacoes financeiras sao atomicas: ou completam por inteiro, ou nao acontecem.',
  'Chaves de participacao nao sao sacaveis; premios em reais sim - sem misturar os dois saldos.',
];

export default function LandingPage() {
  return (
    <div className="landing">
      <nav className="landing-nav">
        <span className="brand">Pbingo</span>
        <div className="landing-nav-links">
          <a href="#como-funciona">Como funciona</a>
          <Link to="/suporte">Suporte</Link>
          <Link to="/app" className="cta-button cta-small">
            Entrar
          </Link>
        </div>
      </nav>

      <header className="hero">
        <h1>Bingo online, rodadas rapidas, premios reais.</h1>
        <p>
          O Pbingo e uma plataforma de bingo com rodadas cronometradas de 1 minuto, sorteio em tempo real e premios
          sacaveis em dinheiro. Compre suas chaves via Pix, entre na rodada e acompanhe cada numero sendo sorteado na
          hora.
        </p>
        <Link to="/app" className="cta-button">
          Jogar agora
        </Link>
      </header>

      <section id="como-funciona" className="how-it-works">
        <h2>Como funciona</h2>
        <div className="steps">
          {STEPS.map((step) => (
            <div className="step-card" key={step.title}>
              <h3>{step.title}</h3>
              <p>{step.description}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="trust-section">
        <h2>Seguranca em primeiro lugar</h2>
        <ul>
          {TRUST_POINTS.map((point) => (
            <li key={point}>{point}</li>
          ))}
        </ul>
      </section>

      <footer className="landing-footer">
        <Link to="/suporte">Central de ajuda</Link>
        <span>© {new Date().getFullYear()} Pbingo</span>
      </footer>
    </div>
  );
}

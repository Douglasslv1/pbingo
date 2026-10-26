import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import Logo from '../components/Logo';
import { formatBrl, formatCountdown } from '../format';
import { useAuth } from '../hooks/useAuth';
import { useCountdown } from '../hooks/useCountdown';
import { useGameConfig } from '../hooks/useGameConfig';
import { Raffle, raffleApi } from '../raffles';
import type { RoundView } from '../types';
import './home.css';

const dateTime = (date: string) => new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo',
}).format(new Date(date));
const time = (date: string) => new Intl.DateTimeFormat('pt-BR', {
  hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo',
}).format(new Date(date));

function Arrow({ diagonal = false }: { diagonal?: boolean }) {
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    {diagonal ? <path d="M6 18 18 6M6 6h12v12" /> : <path d="M4 12h15m-6-6 6 6-6 6" />}
  </svg>;
}

/** Decorative numbers are illustrative and never represent a live draw. */
function DigitalBingo() {
  const numbers = [4, 19, 32, 48, 61, 8, 23, 38, 54, 67, 12, 27, '✦', 57, 70, 3, 21, 42, 51, 73, 9, 30, 45, 60, 75];
  return <div className="home__scene" aria-hidden="true">
    <div className="home__scene-grid" /><div className="home__halo" />
    <div className="home__orbit home__orbit--one" /><div className="home__orbit home__orbit--two" />
    <div className="home__float-ball home__float-ball--one"><span>27</span></div>
    <div className="home__float-ball home__float-ball--two"><span>08</span></div>
    <div className="home__float-ball home__float-ball--three"><span>54</span></div>
    <div className="home__digital-card">
      <div className="home__card-heading"><span>pbingu / bingo</span><span>✦</span></div>
      <div className="home__bingo-letters">{'BINGO'.split('').map((letter) => <span key={letter}>{letter}</span>)}</div>
      <div className="home__bingo-grid">{numbers.map((number, i) => <span key={i}
        className={[1, 5, 12, 17, 23].includes(i) ? 'is-marked' : undefined}>{number}</span>)}</div>
      <div className="home__card-foot"><span>O clássico, conectado.</span><i /></div>
    </div>
    <div className="home__scene-note"><span>01 / NOVAS CONEXÕES</span><span>UMA NOVA FORMA DE PARTICIPAR</span></div>
  </div>;
}

function RafflePreview({ raffle }: { raffle: Raffle }) {
  const open = raffle.salesOpen && new Date(raffle.closesAt).getTime() > Date.now();
  const discount = Math.max(0, ...raffle.discounts.map((tier) => tier.percent));
  return <article className="home__raffle">
    <Link to={`/rifas#rifa-${raffle.id}`} className="home__raffle-image-link" aria-label={`Ver rifa ${raffle.title}`}>
      <img src={raffle.image} alt={raffle.prize} loading="lazy" />
      <span className="home__image-badge">{open ? 'Participações abertas' : 'Vendas encerradas'}</span>
      <span className="home__image-arrow"><Arrow diagonal /></span>
    </Link>
    <div className="home__raffle-body"><span className="home__eyebrow">SORTEIO · {dateTime(raffle.drawAt)}</span>
      <h3>{raffle.title}</h3><p>{raffle.prize}</p>
      <div className="home__raffle-price"><div><span>Por bilhete</span><strong>{formatBrl(raffle.priceCents / 100)}</strong></div>
        {discount > 0 && <span className="home__discount">Até {discount}% por quantidade</span>}</div>
      <div className="home__raffle-progress" role="progressbar" aria-label={`Bilhetes vendidos de ${raffle.title}`}
        aria-valuenow={raffle.sold} aria-valuemin={0} aria-valuemax={raffle.totalTickets}>
        <span style={{ width: `${Math.min(100, raffle.sold / raffle.totalTickets * 100)}%` }} /></div>
      <div className="home__raffle-count"><span>{raffle.sold} bilhetes vendidos</span><span>{raffle.available} disponíveis</span></div>
      <Link className="home__text-link" to={`/rifas#rifa-${raffle.id}`}>{open ? 'Conhecer e participar' : 'Ver regras e informações'}<Arrow /></Link>
    </div>
  </article>;
}

export default function HomePage() {
  const { auth } = useAuth();
  const config = useGameConfig();
  const [round, setRound] = useState<RoundView | null>(null);
  const [raffles, setRaffles] = useState<Raffle[]>([]);
  const [roundState, setRoundState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [raffleState, setRaffleState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [refreshKey, setRefreshKey] = useState(0);
  const countdown = useCountdown(round?.status === 'WAITING' ? round.waitingEndsAt : null);

  useEffect(() => {
    let active = true;
    let pending = false;
    let nextRaffleRefresh = 0;
    let controller: AbortController | null = null;
    let timeout: number | undefined;
    async function refresh() {
      if (pending || document.visibilityState === 'hidden') return;
      pending = true;
      controller = new AbortController();
      const { signal } = controller;
      timeout = window.setTimeout(() => controller?.abort(), 10000);
      const roundRequest = api.getCurrentRound(signal).then((value) => {
        if (active) { setRound(value); setRoundState('ready'); }
      }).catch(() => { if (active) { setRound(null); setRoundState('error'); } });
      // Raffle images change less frequently; avoid downloading the gallery every 15 seconds.
      const raffleRequest = Date.now() >= nextRaffleRefresh ? raffleApi.list(signal).then((value) => {
        if (active) { setRaffles(value); setRaffleState('ready'); }
        nextRaffleRefresh = Date.now() + 60000;
      }).catch(() => {
        if (active) { setRaffles([]); setRaffleState('error'); }
        nextRaffleRefresh = Date.now() + 30000;
      }) : Promise.resolve();
      await Promise.allSettled([roundRequest, raffleRequest]);
      window.clearTimeout(timeout);
      pending = false;
    }
    void refresh();
    const interval = window.setInterval(refresh, 15000);
    const onVisibility = () => { if (document.visibilityState === 'visible') void refresh(); };
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      active = false; controller?.abort(); window.clearTimeout(timeout); window.clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [refreshKey]);

  const editions = raffles.filter((r) => r.status !== 'DRAWN')
    .sort((a, b) => Number(b.salesOpen) - Number(a.salesOpen) || new Date(a.drawAt).getTime() - new Date(b.drawAt).getTime()).slice(0, 3);
  const price = config ? formatBrl(config.ticketPriceCredits * config.creditPriceBrl) : null;
  const waiting = round?.status === 'WAITING';
  const live = round?.status === 'IN_PROGRESS';
  const paidTables = config ? [
    { name: 'Dominó', to: '/domino', show: config.dominoEnabled && !config.dominoFree },
    { name: 'Truco', to: '/truco', show: config.trucoEnabled },
    { name: 'Damas', to: '/damas', show: config.damasEnabled && !config.boardGamesFree },
    { name: 'Xadrez', to: '/xadrez', show: config.xadrezEnabled && !config.boardGamesFree },
    { name: 'Ludo', to: '/ludo', show: config.ludoEnabled && !config.ludoFree },
  ].filter((game) => game.show) : [];

  return <div className="home">
    <nav className="home__nav home__container" aria-label="Navegação principal">
      <Link to="/" className="home__brand" aria-label="Pbingu, página inicial"><Logo size={35} /></Link>
      <div className="home__nav-links"><a href="#bingo">Bingo</a><a href="#rifas">Rifas</a><a href="#como-funciona">Como funciona</a></div>
      <Link to="/app" className="home__button home__button--nav">{auth ? 'Minha conta' : 'Entrar / criar conta'}<Arrow diagonal /></Link>
    </nav>

    <main>
      <header className="home__hero home__container">
        <div className="home__hero-copy"><span className="home__eyebrow"><i className="home__little-star">✳</i> BINGO, RIFAS E NOVAS POSSIBILIDADES</span>
          <h1>O próximo número.<br />Uma nova <em>história.</em></h1>
          <p>O bingo de sempre, em uma experiência nova. Escolha suas cartelas, acompanhe as rodadas e descubra as rifas da semana.</p>
          <div className="home__hero-actions"><Link to="/app" className="home__button">Conhecer o bingo<Arrow /></Link><a href="#rifas" className="home__button home__button--outline">Explorar rifas<Arrow diagonal /></a></div>
          <div className="home__hero-notes"><span><span>◈</span> Pagamento via Pix</span><span><span>◎</span> Rodadas em tempo real</span><span><span>↗</span> Direto no navegador</span></div>
        </div>
        <DigitalBingo />
      </header>

      <div className="home__ticker" aria-label="Destaques"><div className="home__container"><span>Bingo ao vivo</span><i>✳</i><span>Rifas com regras publicadas</span><i>✳</i><span>Mais de uma cartela por rodada</span><i>✳</i><span>Uma experiência Pbingu</span></div></div>

      <section id="bingo" className="home__section home__container" aria-labelledby="bingo-title">
        <div className="home__section-heading"><div><span className="home__eyebrow">01 / BINGO ONLINE</span><h2 id="bingo-title">Seu lugar na próxima rodada.</h2></div><p>Mais cartelas, a mesma emoção de acompanhar cada número. Tudo em uma sala, em tempo real.</p></div>
        <div className="home__bingo-panel">
          <div className="home__bingo-description"><span className="home__pill">O CLÁSSICO DA CASA</span><h3>Escolha suas cartelas.<br />Acompanhe cada número.</h3>
            <p>Compre suas chaves com Pix e use o saldo para participar. Você pode levar várias cartelas para a mesma partida.</p>
            <Link to="/app" className="home__button home__button--white">Ir para o bingo<Arrow /></Link>
            <span className="home__bingo-price">{price ? `Cada cartela: ${price} · ${config!.ticketPriceCredits} chave(s)` : 'Consulte o valor da cartela na sala.'}</span>
            <div className="home__bingo-decoration" aria-hidden="true"><span>05</span><span>36</span><span>72</span></div>
          </div>
          <div className="home__round">
            <div className="home__round-heading"><span className="home__eyebrow">AGENDA DO BINGO</span><span className={`home__status ${live ? 'home__status--live' : ''}`}><i />{roundState === 'loading' ? 'Consultando' : roundState === 'error' ? 'Sem conexão' : live ? 'Em andamento' : waiting ? 'Sala aberta' : 'Aguardando rodada'}</span></div>
            {roundState === 'error' ? <div className="home__empty"><h3>Não foi possível consultar a rodada.</h3><p>Tente novamente ou acesse a sala para verificar a programação.</p><button className="home__text-link" onClick={() => setRefreshKey((key) => key + 1)}>Tentar novamente<Arrow /></button></div> : <>
              <span className="home__round-label">{live ? 'O sorteio está acontecendo' : 'Próxima rodada'}</span>
              <div className="home__round-time">{roundState === 'loading' ? <span className="home__skeleton" /> : live ? 'Ao vivo' : waiting && round?.waitingEndsAt ? time(round.waitingEndsAt) : 'Em breve'}<span>{waiting && round?.waitingEndsAt ? 'horário de Brasília' : live ? 'acompanhe na sala' : 'aguarde a abertura da sala'}</span></div>
              {waiting && countdown !== null && <p className="home__countdown">{countdown > 0 ? <>Início previsto em <strong>{formatCountdown(countdown)}</strong></> : 'Aguardando confirmação de início da rodada.'}</p>}
              {round && <dl className="home__round-stats"><div><dt>Prêmio atual</dt><dd>{formatBrl(round.accumulatedPrize)}</dd></div><div><dt>Participantes</dt><dd>{round.playersCount}<small> / mín. {round.minPlayers}</small></dd></div></dl>}
              <p className="home__round-rule">{config ? `Rodadas a cada ${config.roundIntervalMinutes} minutos. ` : ''}A partida precisa atingir o mínimo de jogadores. Se for cancelada, as chaves das cartelas são devolvidas.</p>
              <Link className="home__text-link" to="/app">{live ? 'Acompanhar sorteio' : 'Ver sala e cartelas'}<Arrow /></Link>
            </>}
            <span className="home__data-note">Dados consultados a cada 15 segundos.</span>
          </div>
        </div>
        {paidTables.length > 0 && <div className="home__paid-tables"><span>Também nas mesas com chaves</span><div>{paidTables.map((game) => <Link key={game.to} to={game.to}>{game.name}<Arrow diagonal /></Link>)}</div></div>}
      </section>

      <section id="rifas" className="home__section home__raffles-section" aria-labelledby="raffles-title"><div className="home__container">
        <div className="home__section-heading"><div><span className="home__eyebrow">02 / RIFAS DA SEMANA</span><h2 id="raffles-title">Uma escolha. Novas possibilidades.</h2></div><Link className="home__text-link" to="/rifas">Ver todas as rifas<Arrow /></Link></div>
        <p className="home__section-intro">Conheça os prêmios, confira as datas e escolha quantos bilhetes quer levar. Cada edição tem seu preço, seus descontos e sua regra de apuração.</p>
        {raffleState === 'loading' ? <div className="home__raffle-grid" aria-label="Carregando rifas">{[1, 2, 3].map((n) => <div className="home__raffle-placeholder" key={n}><span className="home__skeleton" /><p>Consultando próximas edições…</p></div>)}</div>
          : editions.length ? <div className="home__raffle-grid">{editions.map((raffle) => <RafflePreview key={raffle.id} raffle={raffle} />)}</div>
          : <div className="home__raffle-empty"><div className="home__ticket-symbol" aria-hidden="true">✳</div><div><span className="home__eyebrow">CADA EDIÇÃO, UMA NOVA HISTÓRIA</span><h3>{raffleState === 'error' ? 'Não conseguimos consultar as rifas.' : 'As próximas rifas aparecem por aqui.'}</h3><p>{raffleState === 'error' ? 'Acesse a página de rifas ou tente consultar novamente.' : 'Assim que uma edição for publicada, você verá o prêmio, a data e o valor dos bilhetes neste espaço.'}</p><Link className="home__text-link" to="/rifas">{raffles.some((r) => r.status === 'DRAWN') ? 'Ver edições e resultados' : 'Conhecer a área de rifas'}<Arrow /></Link></div></div>}
        <div className="home__raffle-footnote"><span>◈ Pix por compra</span><span>▤ Descontos por quantidade, quando disponíveis</span><span>◎ Apuração conforme a regra de cada edição</span></div>
      </div></section>

      <section id="como-funciona" className="home__section home__container" aria-labelledby="steps-title">
        <div className="home__section-heading"><div><span className="home__eyebrow">03 / DO SEU JEITO, SEM COMPLICAÇÃO</span><h2 id="steps-title">Do primeiro acesso à participação.</h2></div></div>
        <ol className="home__steps">{[
          ['Encontre sua experiência', 'Escolha entre as rodadas de bingo e as edições de rifas. Confira valores, datas e regras antes de participar.'],
          ['Escolha e pague com Pix', 'No bingo, compre chaves para suas cartelas. Nas rifas, gere um Pix para a quantidade de bilhetes escolhida.'],
          ['Acompanhe tudo por aqui', 'Veja suas cartelas na sala e seus bilhetes na área de rifas. Os resultados ficam disponíveis na plataforma.'],
        ].map(([title, text], i) => <li key={title}><span className="home__step-number">0{i + 1}<Arrow diagonal /></span><h3>{title}</h3><p>{text}</p></li>)}</ol>
      </section>

      <section className="home__club home__container" aria-label="Jogos virtuais e comunidade">
        <details><summary><span className="home__club-icon" aria-hidden="true">✦</span><span><span className="home__eyebrow">ALÉM DO BINGO E DAS RIFAS</span><strong>Um espaço para jogar por diversão.</strong><span className="home__club-hint">Jogos gratuitos, ranking e torneios com Venox, nossa moeda virtual.</span></span><span className="home__club-toggle" aria-hidden="true">+</span></summary>
          <div className="home__club-content"><p>Venox é conquistado jogando. Não é comprado com reais e não pode ser sacado. Confira as modalidades gratuitas e os torneios na área de jogos.</p><div><Link className="home__text-link" to="/jogos">Explorar jogos<Arrow /></Link><Link className="home__text-link" to="/torneios">Torneios com Venox<Arrow /></Link><Link className="home__text-link" to="/ranking">Ver ranking<Arrow /></Link></div></div>
        </details>
      </section>

      <section className="home__closing home__container"><span className="home__eyebrow">SUA PRÓXIMA EXPERIÊNCIA COMEÇA AQUI</span><h2>Entre. Escolha. <em>Participe.</em></h2><p>Bingo e rifas em um só lugar, no seu tempo.</p><Link to="/app" className="home__button">{auth ? 'Acessar minha conta' : 'Criar conta / entrar'}<Arrow diagonal /></Link></section>
    </main>
    <footer className="home__footer"><div className="home__container"><div className="home__footer-top"><Link to="/" className="home__brand" aria-label="Pbingu, início"><Logo size={30} /></Link><p>O clássico encontra novas possibilidades.</p><nav aria-label="Links institucionais"><Link to="/suporte">Ajuda</Link><Link to="/termos">Termos de uso</Link><Link to="/privacidade">Privacidade</Link></nav></div><div className="home__footer-bottom"><span>© {new Date().getFullYear()} Pbingu. Todos os direitos reservados.</span><span><b>18+</b> Exclusivo para maiores de idade. Participe com responsabilidade.</span></div></div></footer>
  </div>;
}

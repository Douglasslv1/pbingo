import { useCallback, useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { api } from '../api';
import GamePage from '../components/GamePage';
import { useAuth } from '../hooks/useAuth';
import { formatBrl } from '../format';
import { formatDateTime } from '../withdrawalFormat';
import { Raffle, RaffleCharge, RafflePurchase, purchaseStatus, raffleApi, raffleQuote, ticketNumber } from '../raffles';

function RaffleCard({ raffle, busy, onBuy }: { raffle: Raffle; busy: boolean; onBuy: (id: string, quantity: number) => void }) {
  const [quantity, setQuantity] = useState(1);
  const quote = raffleQuote(raffle, quantity);
  const open = raffle.salesOpen && new Date(raffle.closesAt) > new Date();
  return <article id={`rifa-${raffle.id}`} className="card raffle-card">
    <img className="raffle-image" src={raffle.image} alt={raffle.title} />
    <h2>{raffle.title}</h2><p className="raffle-description">{raffle.description}</p>
    <p><strong>Prêmio: {raffle.prize}</strong></p>
    <p>Bilhete: <strong>{formatBrl(raffle.priceCents / 100)}</strong> · {raffle.sold} vendidos · {raffle.available} disponíveis</p>
    <p className="hint">Números de {ticketNumber(0, raffle.digits)} a {ticketNumber(raffle.totalTickets - 1, raffle.digits)}. Atribuídos aleatoriamente, sem repetição, na confirmação do pagamento.</p>
    <p>Vendas até {formatDateTime(raffle.closesAt)}.<br />Sorteio: {formatDateTime(raffle.drawAt)}.</p>
    <details><summary>Regra e descontos</summary>
      <p>{raffle.lottery} · Concurso {raffle.contest}. {raffle.rule}</p>
      {raffle.discounts.length ? <ul>{[...raffle.discounts].sort((a, b) => a.minQuantity - b.minQuantity).map((d) =>
        <li key={d.minQuantity}>A partir de {d.minQuantity} bilhetes na mesma compra: {d.percent}% de desconto.</li>)}</ul> : <p>Sem desconto por quantidade.</p>}
      <p className="hint">Aplica-se a maior faixa atingida sobre o total desta compra. Compras anteriores não se somam.</p>
    </details>
    {raffle.status === 'DRAWN' ? <div className="banner">
      Número sorteado: <strong>{ticketNumber(raffle.drawnNumber!, raffle.digits)}</strong>.
      {raffle.winner ? ` Ganhador: ${raffle.winner.name}.` : ' Número não vendido. Esta edição terminou sem ganhador.'}
      {raffle.resultSource && <p><a href={raffle.resultSource} target="_blank" rel="noreferrer">Resultado oficial</a></p>}
    </div> : open ? <form onSubmit={(event) => { event.preventDefault(); onBuy(raffle.id, quantity); }}>
      <label>Quantidade de bilhetes<input type="number" min={1} max={Math.min(1000, raffle.available)} value={quantity}
        disabled={busy} onChange={(e) => setQuantity(Number(e.target.value))} required /></label>
      <p>Total: <strong>{formatBrl(quote.totalCents / 100)}</strong>{quote.percent > 0 && ` (${quote.percent}% de desconto)`}</p>
      <button disabled={busy || quantity < 1 || !Number.isInteger(quantity) || quantity > raffle.available || quantity > 1000 || quote.totalCents < 100}>
        {busy ? 'Aguarde...' : 'Comprar com Pix'}
      </button>
      {quote.totalCents < 100 && <p className="hint">Compra mínima de R$ 1,00.</p>}
    </form> : <p className="hint">Vendas encerradas ou aguardando abertura.</p>}
  </article>;
}

export default function RafflesPage() {
  const { hash } = useLocation();
  const { auth } = useAuth();
  const [raffles, setRaffles] = useState<Raffle[]>([]);
  const [purchases, setPurchases] = useState<RafflePurchase[]>([]);
  const [charge, setCharge] = useState<RaffleCharge | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [loaded, setLoaded] = useState(false);
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (loaded && hash) document.getElementById(hash.slice(1))?.scrollIntoView({ block: 'start' });
  }, [loaded, hash]);
  const refresh = useCallback(async () => {
    if (!auth) return;
    const [list, mine] = await Promise.all([raffleApi.list(), raffleApi.mine(auth.token)]);
    setRaffles(list); setPurchases(mine); setLoaded(true);
  }, [auth]);
  useEffect(() => { refresh().catch((e) => setMessage(e.message)); }, [refresh]);
  useEffect(() => {
    if (!auth || !charge) return;
    let stopped = false;
    const started = Date.now();
    const timer = setInterval(async () => {
      if (Date.now() - started > 10 * 60 * 1000) { clearInterval(timer); return; }
      try {
        const result = await api.getPixChargeStatus(auth.token, charge.transactionId);
        if (stopped) return;
        if (result.status === 'COMPLETED' || result.status === 'FAILED') {
          setCharge(null); setMessage(result.status === 'COMPLETED' ? 'Pagamento confirmado! Seus bilhetes estão abaixo.' : 'Pix não concluído. Você pode fazer uma nova compra.');
          await refresh();
        }
      } catch { /* Transient errors are retried; manual reconciliation stays available. */ }
    }, 4000);
    return () => { stopped = true; clearInterval(timer); };
  }, [auth, charge, refresh]);

  async function buy(id: string, quantity: number) {
    if (!auth || busy) return;
    setBusy(true); setMessage(''); setCopied(false);
    try { setCharge(await raffleApi.buy(auth.token, id, quantity)); }
    catch (e) { setMessage(e instanceof Error ? e.message : 'Erro ao gerar Pix'); }
    finally { setBusy(false); await refresh().catch(() => {}); }
  }
  async function resume(purchase: RafflePurchase) {
    if (!auth) return;
    setBusy(true); setMessage(''); setCopied(false);
    try {
      const result = await raffleApi.refresh(auth.token, purchase.id);
      if (result.status === 'PENDING') setCharge(result);
      else { setCharge(null); setMessage(result.status === 'COMPLETED' ? 'Pagamento confirmado!' : 'Pix não concluído.'); }
      await refresh();
    } catch (e) { setMessage(e instanceof Error ? e.message : 'Erro ao consultar Pix'); }
    finally { setBusy(false); }
  }
  return <GamePage><h1>Rifas</h1>
    <p>Escolha sua rifa e compre com Pix. Confira a data e a regra de cada edição.</p>
    {message && <p className="banner" role="status">{message}</p>}
    {charge && <section className="card pix-charge" aria-label="Pagamento Pix">
      <h2>Pague sua compra</h2>
      {charge.qrCodeBase64 && <img className="pix-qr" src={`data:image/png;base64,${charge.qrCodeBase64}`} alt="QR Code Pix da compra de bilhetes" />}
      {charge.qrCode && <><textarea aria-label="Código Pix copia e cola" value={charge.qrCode} readOnly rows={3} />
        <button onClick={async () => { try { await navigator.clipboard.writeText(charge.qrCode!); setCopied(true); } catch { setMessage('Copie o código Pix pelo campo acima.'); } }}>{copied ? 'Copiado!' : 'Copiar Pix'}</button></>}
      <p>Aguardando confirmação. Você também pode consultar ou retomar a compra em Meus bilhetes.</p>
      <button className="link" onClick={() => setCharge(null)}>Fechar QR Code</button>
    </section>}
    {!loaded && <p>Carregando rifas...</p>}
    {loaded && !raffles.length && <p className="card">Nenhuma rifa publicada no momento.</p>}
    {raffles.map((raffle) => <RaffleCard key={raffle.id} raffle={raffle} busy={busy || !!charge} onBuy={buy} />)}
    <section className="card"><h2>Meus bilhetes</h2><p className="hint">Últimas 100 compras. Os números são emitidos após a confirmação do Pix.</p>
      {!purchases.length && <p>Você ainda não comprou bilhetes.</p>}
      {purchases.map((p) => <article className="raffle-purchase" key={p.id}>
        <strong>{p.raffle.title}</strong><p>{p.quantity} bilhete(s) · {formatBrl(p.totalCents / 100)} · {purchaseStatus[p.status]}</p>
        <p className="hint">Compra em {formatDateTime(p.createdAt)} · Sorteio em {formatDateTime(p.raffle.drawAt)}</p>
        {p.tickets.length > 0 && <details><summary>Ver meus {p.tickets.length} números</summary><p className="raffle-numbers">{p.tickets.map((t) => ticketNumber(t.number, p.raffle.digits)).join(' · ')}</p></details>}
        {p.status === 'PENDING' && <button disabled={busy} onClick={() => resume(p)}>Consultar / Retomar Pix</button>}
        {p.raffle.status === 'DRAWN' && p.tickets.some((t) => t.number === p.raffle.drawnNumber) && <p className="banner">Seu bilhete foi premiado! Entre em contato com o suporte para receber o prêmio.</p>}
      </article>)}
    </section>
  </GamePage>;
}

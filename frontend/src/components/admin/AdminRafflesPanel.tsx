import { FormEvent, useCallback, useEffect, useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { formatBrl } from '../../format';
import { formatDateTime } from '../../withdrawalFormat';
import { BuyersPage, Raffle, RaffleInput, purchaseStatus, raffleApi, raffleStatus, ticketNumber } from '../../raffles';

function localDate(value: string) {
  const date = new Date(value);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}
function newRaffle(): RaffleInput {
  const date = new Date(); date.setDate(date.getDate() + 7); date.setHours(20, 0, 0, 0);
  return { title: '', description: '', image: '', prize: '', priceCents: 500, discounts: [], digits: 3,
    lottery: 'Loteria Federal', contest: '', prizePosition: 1, closesAt: date.toISOString(), drawAt: date.toISOString() };
}

function RaffleForm({ initial, busy, onSave, onCancel }: {
  initial: RaffleInput; busy: boolean; onSave: (data: RaffleInput) => Promise<void>; onCancel: () => void;
}) {
  const [form, setForm] = useState(initial);
  const [imageError, setImageError] = useState('');
  const field = <K extends keyof RaffleInput>(key: K, value: RaffleInput[K]) => setForm((old) => ({ ...old, [key]: value }));
  async function submit(event: FormEvent) { event.preventDefault(); await onSave(form); }
  return <form className="card" onSubmit={submit}>
    <h2>{initial.title ? 'Editar rascunho' : 'Nova rifa'}</h2>
    <label>Título<input required minLength={3} maxLength={120} value={form.title} onChange={(e) => field('title', e.target.value)} /></label>
    <label>Descrição<textarea required minLength={3} maxLength={10000} rows={3} value={form.description} onChange={(e) => field('description', e.target.value)} /></label>
    <label>Prêmio<input required minLength={3} maxLength={255} value={form.prize} onChange={(e) => field('prize', e.target.value)} /></label>
    <label>Imagem (URL HTTPS)<input type="url" value={form.image.startsWith('data:') ? '' : form.image} onChange={(e) => field('image', e.target.value)} placeholder="https://..." /></label>
    <label>Ou enviar imagem (PNG, JPEG, WebP; até 1 MB)<input type="file" accept="image/png,image/jpeg,image/webp" onChange={(e) => {
      const file = e.target.files?.[0]; if (!file) return;
      if (file.size > 1024 * 1024 || !['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) { setImageError('Escolha PNG, JPEG ou WebP de até 1 MB.'); return; }
      const reader = new FileReader(); reader.onload = () => { field('image', String(reader.result)); setImageError(''); }; reader.readAsDataURL(file);
    }} /></label>
    {imageError && <p className="error">{imageError}</p>}
    {form.image && <img className="raffle-image" src={form.image} alt="Prévia da rifa" />}
    <label>Preço por bilhete (R$)<input required type="number" min="0.01" max="100000" step="0.01" value={form.priceCents / 100} onChange={(e) => field('priceCents', Math.round(Number(e.target.value) * 100))} /></label>
    <fieldset><legend>Descontos por compra</legend>
      <p className="hint">A maior faixa atingida vale sobre o total. Compras anteriores não se somam. O total mínimo do Pix é R$ 1,00.</p>
      {form.discounts.map((d, i) => <div className="raffle-tier" key={i}>
        <label>A partir de<input required type="number" min={2} max={1000} value={d.minQuantity} onChange={(e) => field('discounts', form.discounts.map((tier, n) => n === i ? { ...tier, minQuantity: Number(e.target.value) } : tier))} /></label>
        <label>Desconto (%)<input required type="number" min={1} max={90} value={d.percent} onChange={(e) => field('discounts', form.discounts.map((tier, n) => n === i ? { ...tier, percent: Number(e.target.value) } : tier))} /></label>
        <button type="button" className="link" onClick={() => field('discounts', form.discounts.filter((_, n) => n !== i))}>Remover faixa</button>
      </div>)}
      <button type="button" disabled={form.discounts.length >= 20} onClick={() => field('discounts', [...form.discounts, { minQuantity: form.discounts.length ? form.discounts[form.discounts.length - 1].minQuantity + 10 : 10, percent: form.discounts.length ? Math.min(90, form.discounts[form.discounts.length - 1].percent + 5) : 10 }])}>Adicionar faixa</button>
    </fieldset>
    <label>Loteria da Caixa<input required minLength={3} maxLength={80} value={form.lottery} onChange={(e) => field('lottery', e.target.value)} /></label>
    <label>Número do concurso<input required maxLength={40} value={form.contest} onChange={(e) => field('contest', e.target.value)} /></label>
    <label>Posição do prêmio usado<input required type="number" min={1} max={10} value={form.prizePosition} onChange={(e) => field('prizePosition', Number(e.target.value))} /></label>
    <label>Últimos dígitos para definir o bilhete<select value={form.digits} onChange={(e) => field('digits', Number(e.target.value))}>
      {[1, 2, 3, 4, 5].map((d) => <option key={d} value={d}>{d} dígito(s) — {10 ** d} bilhetes</option>)}
    </select></label>
    <p className="hint">Faixa completa de {ticketNumber(0, form.digits)} a {ticketNumber(10 ** form.digits - 1, form.digits)}. Número não vendido: edição sem ganhador. Use uma loteria cujo resultado seja compatível com esta regra.</p>
    <label>Encerramento das vendas (seu horário local)<input required type="datetime-local" value={localDate(form.closesAt)} onChange={(e) => { if (e.target.value) field('closesAt', new Date(e.target.value).toISOString()); }} /></label>
    <label>Data e horário do sorteio (seu horário local)<input required type="datetime-local" value={localDate(form.drawAt)} onChange={(e) => { if (e.target.value) field('drawAt', new Date(e.target.value).toISOString()); }} /></label>
    <p className="hint">Cada cadastro corresponde a uma edição semanal. Confira as regras: elas não podem ser alteradas após publicar.</p>
    <div className="round-actions"><button disabled={busy || !form.image || !!imageError}>{busy ? 'Salvando...' : 'Salvar rascunho'}</button><button type="button" className="link" onClick={onCancel}>Cancelar edição</button></div>
  </form>;
}

function DrawForm({ raffle, busy, onDraw }: { raffle: Raffle; busy: boolean; onDraw: (number: string, source: string) => void }) {
  const [number, setNumber] = useState('');
  const [source, setSource] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  return <form onSubmit={(e) => { e.preventDefault(); onDraw(number, source); }}>
    <h3>Registrar resultado</h3><p>{raffle.lottery}, concurso {raffle.contest}, {raffle.prizePosition}º prêmio. {raffle.rule}</p>
    <label>Número completo do prêmio<input required inputMode="numeric" pattern={`[0-9]{${raffle.digits},30}`} maxLength={30} value={number} onChange={(e) => { setNumber(e.target.value); setConfirmed(false); }} /></label>
    <label>Link oficial do resultado na Caixa<input required type="url" value={source} onChange={(e) => { setSource(e.target.value); setConfirmed(false); }} placeholder="https://loterias.caixa.gov.br/..." /></label>
    {number.length >= raffle.digits && /^\d+$/.test(number) && <p>Bilhete apurado: <strong>{number.slice(-raffle.digits)}</strong></p>}
    <label className="raffle-confirm"><input required type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} />Conferi o concurso, o prêmio e o resultado oficial. A apuração é definitiva.</label>
    <button disabled={busy || !confirmed || raffle.reserved > 0}>Apurar e publicar resultado</button>
    {raffle.reserved > 0 && <p className="hint">Consulte os pagamentos pendentes antes de apurar. Reservas são liberadas após o Mercado Pago confirmar falha, cancelamento ou expiração.</p>}
  </form>;
}

export default function AdminRafflesPanel() {
  const { auth } = useAuth();
  const [raffles, setRaffles] = useState<Raffle[]>([]);
  const [editing, setEditing] = useState<{ id?: string; input: RaffleInput; version: number } | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [buyers, setBuyers] = useState<BuyersPage | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const refresh = useCallback(async () => { if (auth) setRaffles(await raffleApi.adminList(auth.token)); }, [auth]);
  useEffect(() => { refresh().catch((e) => setMessage(e.message)); }, [refresh]);
  async function run(action: () => Promise<unknown>, success: string) {
    setBusy(true); setMessage('');
    try { await action(); await refresh(); setMessage(success); }
    catch (e) { setMessage(e instanceof Error ? e.message : 'Erro ao atualizar rifas'); }
    finally { setBusy(false); }
  }
  async function loadBuyers(id: string, page = 1) {
    if (!auth) return;
    setBusy(true); setMessage('');
    try { const data = await raffleApi.buyers(auth.token, id, page); setSelected(id); setBuyers(data); }
    catch (e) { setMessage(e instanceof Error ? e.message : 'Erro ao carregar compradores'); }
    finally { setBusy(false); }
  }
  if (!auth) return null;
  const selectedRaffle = raffles.find((r) => r.id === selected);
  const totals = raffles.reduce((t, r) => ({ sold: t.sold + r.sold, revenue: t.revenue + (r.revenueCents ?? 0), pending: t.pending + (r.pendingCents ?? 0) }), { sold: 0, revenue: 0, pending: 0 });
  return <div>
    <div className="card"><h2>Rifas e arrecadação</h2>
      <div className="round-stats"><div><span className="label">Bilhetes pagos</span><strong>{totals.sold}</strong></div>
        <div><span className="label">Arrecadado</span><strong>{formatBrl(totals.revenue / 100)}</strong></div>
        <div><span className="label">Pix pendentes</span><strong>{formatBrl(totals.pending / 100)}</strong></div></div>
      <p className="hint">Arrecadação após descontos, antes das taxas do Mercado Pago. Somente pagamentos confirmados.</p>
      <div className="round-actions"><button disabled={busy} onClick={() => setEditing({ input: newRaffle(), version: Date.now() })}>Criar nova rifa</button>
        <button className="link" disabled={busy} onClick={() => run(refresh, 'Dados atualizados.')}>Atualizar dados</button></div>
    </div>
    {message && <p className="banner" role="status">{message}</p>}
    {editing && <RaffleForm key={editing.version} initial={editing.input} busy={busy} onCancel={() => setEditing(null)} onSave={async (input) => {
      await run(async () => { await raffleApi.save(auth.token, input, editing.id); setEditing(null); }, 'Rascunho salvo. Publique para abrir as vendas.');
    }} />}
    {raffles.map((r) => <article className="card" key={r.id}>
      <h2>{r.title}</h2><p>{raffleStatus[r.status]} · {formatBrl(r.priceCents / 100)} por bilhete · Sorteio {formatDateTime(r.drawAt)}</p>
      <div className="round-stats"><div><span className="label">Vendidos / total</span><strong>{r.sold} / {r.totalTickets}</strong></div>
        <div><span className="label">Compradores pagos</span><strong>{r.buyers}</strong></div>
        <div><span className="label">Arrecadado</span><strong>{formatBrl((r.revenueCents ?? 0) / 100)}</strong></div></div>
      <p>{r.reserved} bilhetes reservados · {r.available} disponíveis · {formatBrl((r.pendingCents ?? 0) / 100)} em Pix pendentes.</p>
      <div className="round-actions">
        {r.status === 'DRAFT' && <><button disabled={busy} onClick={() => setEditing({ id: r.id, input: r, version: Date.now() })}>Editar</button>
          <button disabled={busy} onClick={() => run(() => raffleApi.action(auth.token, r.id, 'publish'), 'Rifa publicada. As regras estão bloqueadas.')}>Publicar e abrir vendas</button></>}
        {r.status === 'OPEN' && <button disabled={busy} onClick={() => run(() => raffleApi.action(auth.token, r.id, 'close'), 'Vendas encerradas. Os Pix já emitidos continuam válidos até o provedor encerrá-los.')}>Encerrar novas vendas</button>}
        <button className="link" disabled={busy} onClick={() => loadBuyers(r.id)}>Ver compradores e pagamentos</button>
        <button className="link" disabled={busy} onClick={() => setEditing({ version: Date.now(), input: { ...r, title: `${r.title} — nova edição`.slice(0, 120), closesAt: newRaffle().closesAt, drawAt: newRaffle().drawAt, contest: '' } })}>Duplicar para nova semana</button>
      </div>
      {r.status === 'DRAWN' ? <p className="banner">Resultado: {ticketNumber(r.drawnNumber!, r.digits)} · {r.winner ? `Ganhador: ${r.winner.name}` : 'Número não vendido; sem ganhador nesta edição.'}
        {r.winner?.email && <><br />Contato: {r.winner.email} · Compra {r.winner.purchaseId}</>}
        {r.resultSource && <> · <a href={r.resultSource} target="_blank" rel="noreferrer">Resultado oficial</a></>}</p>
        : ['OPEN', 'CLOSED'].includes(r.status) && <details><summary>Apurar resultado</summary><DrawForm raffle={r} busy={busy} onDraw={(number, source) => run(() => raffleApi.draw(auth.token, r.id, number, source), 'Resultado registrado e publicado.')} /></details>}
    </article>)}
    {buyers && selectedRaffle && <section className="card"><h2>Compras — {selectedRaffle.title}</h2><p>{buyers.total} compras. Página {buyers.page}.</p>
      {buyers.items.map((p) => <article key={p.id} className="raffle-purchase">
        <strong>{p.user.name}</strong><p>{p.user.email}</p>
        <p>{p.quantity} bilhete(s) · {formatBrl(p.totalCents / 100)} · {purchaseStatus[p.status]} · {p.discountPercent}% de desconto</p>
        <p className="hint">{formatDateTime(p.createdAt)} · Compra {p.id}</p>
        {p.tickets.length > 0 && <details><summary>Números comprados</summary><p className="raffle-numbers">{p.tickets.map((t) => ticketNumber(t.number, selectedRaffle.digits)).join(' · ')}</p></details>}
        {p.status === 'PENDING' && <button disabled={busy} onClick={() => run(async () => {
          await raffleApi.refresh(auth.token, p.id, true); setBuyers(await raffleApi.buyers(auth.token, selectedRaffle.id, buyers.page));
        }, 'Cobrança consultada no Mercado Pago.')}>Consultar no Mercado Pago</button>}
      </article>)}
      <div className="round-actions"><button disabled={busy || buyers.page === 1} onClick={() => loadBuyers(selectedRaffle.id, buyers.page - 1)}>Anterior</button>
        <button disabled={busy || buyers.page * 50 >= buyers.total} onClick={() => loadBuyers(selectedRaffle.id, buyers.page + 1)}>Próxima</button></div>
    </section>}
  </div>;
}

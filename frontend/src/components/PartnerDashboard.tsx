import { FormEvent, useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { formatBrl } from '../format';
import { formatDateTime } from '../withdrawalFormat';
import { CommissionRow, PartnerReport, partnerApi, partnerLink } from '../partners';
import { raffleApi, Raffle } from '../raffles';

const money = (cents: number) => formatBrl(cents / 100);
function RefundForm({ row, onSaved }: { row: CommissionRow; onSaved: () => Promise<void> }) {
  const { auth } = useAuth();
  const [amount, setAmount] = useState(row.purchase.refundedCents / 100);
  const [reference, setReference] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function submit(e: FormEvent) {
    e.preventDefault(); if (!auth) return;
    setBusy(true); setError('');
    try { await partnerApi.refund(auth.token, row.purchaseId, Math.round(amount * 100), reference); await onSaved(); }
    catch (e) { setError(e instanceof Error ? e.message : 'Erro ao registrar estorno'); }
    finally { setBusy(false); }
  }
  return <details><summary>Registrar estorno de comissão</summary><form onSubmit={submit}>
    <p className="hint">Registre somente uma devolução já confirmada fora da plataforma. Esta ação ajusta a comissão; não envia dinheiro ao comprador nem cancela bilhetes.</p>
    <label>Total acumulado já devolvido nesta compra (R$)<input type="number" min={Math.max(.01, row.purchase.refundedCents / 100)} max={row.purchase.totalCents / 100} step="0.01" value={amount} required onChange={(e) => setAmount(Number(e.target.value))} /></label>
    <label>Referência do estorno e motivo<input required minLength={5} maxLength={500} value={reference} onChange={(e) => setReference(e.target.value)} /></label>
    <label className="partner-check"><input type="checkbox" required checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} /> Conferi a devolução no provedor e o valor total acumulado.</label>
    {error && <p className="error">{error}</p>}<button disabled={busy || !confirmed}>Registrar ajuste da comissão</button>
  </form></details>;
}

export default function PartnerDashboard({ partnerId }: { partnerId?: string }) {
  const { auth } = useAuth();
  const [data, setData] = useState<PartnerReport | null>(null);
  const [raffles, setRaffles] = useState<Raffle[]>([]);
  const [from, setFrom] = useState(''); const [to, setTo] = useState(''); const [raffle, setRaffle] = useState('');
  const [filter, setFilter] = useState(''); const [page, setPage] = useState(1);
  const [busy, setBusy] = useState(false); const [error, setError] = useState(''); const [message, setMessage] = useState('');
  const load = useCallback(async () => {
    if (!auth) return;
    setBusy(true); setError('');
    try { const query = `${filter}&page=${page}`; setData(partnerId ? await partnerApi.report(auth.token, partnerId, query) : await partnerApi.mine(auth.token, query)); }
    catch (e) { setData(null); setError(e instanceof Error ? e.message : 'Erro ao consultar painel'); }
    finally { setBusy(false); }
  }, [auth, partnerId, filter, page]);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => { raffleApi.list().then(setRaffles).catch(() => {}); }, []);
  function apply(e: FormEvent) {
    e.preventDefault(); const query = new URLSearchParams();
    if (from) query.set('from', new Date(`${from}T00:00:00`).toISOString());
    if (to) query.set('to', new Date(`${to}T23:59:59.999`).toISOString());
    if (raffle) query.set('raffleId', raffle);
    setPage(1); setFilter(query.toString());
  }
  if (!auth) return null;
  return <div>
    {error && <p className="banner" role="alert">{error}</p>}
    {busy && <p>Consultando painel...</p>}
    {data && <>
      <section className="card"><h2>Link de indicação</h2>
        <p>Comissão: <strong>{data.wallet.rateBps / 100}%</strong> · Liberação em {data.wallet.holdDays} dia(s) após o pagamento.
          {' '}Remuneração: {data.wallet.durationDays === null ? 'sem prazo de término' : `até ${data.wallet.durationDays} dias após cada cadastro indicado`}.</p>
        {(!data.wallet.active || data.wallet.blocked) && <p className="banner">{data.wallet.blocked ? 'Parceria bloqueada para revisão. Saques de comissões indisponíveis.' : 'Parceria pausada. Novos cadastros e compras não geram comissões enquanto estiver pausada.'}</p>}
        <input aria-label="Link exclusivo de indicação" readOnly value={partnerLink(data.wallet.code)} />
        <button onClick={async () => { try { await navigator.clipboard.writeText(partnerLink(data.wallet.code)); setMessage('Link copiado!'); } catch { setMessage('Selecione o link acima para copiar.'); } }}>Copiar link</button>
        {message && <p role="status">{message}</p>}
        <p className="hint">Válido somente para novos cadastros. O parceiro vinculado ao cadastro não pode ser trocado. O primeiro link fica lembrado neste navegador por até 30 dias.</p>
      </section>
      <section className="card"><h2>Carteira de comissões</h2><p className="hint">Saldos gerais, independentemente dos filtros do relatório.</p>
        <div className="round-stats"><div><span className="label">Disponível</span><strong>{money(data.wallet.availableCents)}</strong></div>
          <div><span className="label">Pendente de liberação</span><strong>{money(data.wallet.pendingCents)}</strong></div>
          <div><span className="label">Reservado em saques</span><strong>{money(data.wallet.reservedCents)}</strong></div></div>
        <p>Total de comissões já pagas: <strong>{money(data.wallet.paidCents)}</strong></p>
        {data.wallet.debtCents > 0 && <p className="error">Estornos a compensar com próximas comissões: {money(data.wallet.debtCents)}. Os prêmios dos jogos permanecem separados.</p>}
        {!partnerId && <Link to="/app">Ir à carteira e solicitar saque</Link>}
      </section>
      <section className="card"><h2>Relatório de indicações e vendas</h2>
        <form onSubmit={apply}><div className="partner-filters"><label>De<input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></label>
          <label>Até<input type="date" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} /></label>
          <label>Rifa<select value={raffle} onChange={(e) => setRaffle(e.target.value)}><option value="">Todas</option>{raffles.map((r) => <option key={r.id} value={r.id}>{r.title}</option>)}</select></label></div>
          <button disabled={busy}>Aplicar filtros</button></form>
        <p className="hint">Datas no seu horário local. Cadastros são filtrados pela data de cadastro; vendas pela confirmação do pagamento. O filtro de rifa se aplica às vendas.</p>
        <div className="round-stats"><div><span className="label">Cadastros no período</span><strong>{data.totals.referrals}</strong></div>
          <div><span className="label">Compradores</span><strong>{data.totals.buyers}</strong></div>
          <div><span className="label">Bilhetes em compras pagas</span><strong>{data.totals.tickets}</strong></div></div>
        <p>Vendas após descontos: {money(data.totals.salesCents)} · Estornos registrados: {money(data.totals.refundedCents)} · Líquido de estornos: {money(data.totals.salesCents - data.totals.refundedCents)}</p>
        <p>Comissões geradas: {money(data.totals.commissionCents)} · Revertidas: {money(data.totals.reversedCents)} · Líquidas: {money(data.totals.commissionCents - data.totals.reversedCents)}</p>
        <button type="button" className="link" disabled={busy} onClick={() => load()}>Atualizar dados</button>
      </section>
      <section className="card"><h2>Compras e comissões</h2><p>{data.total} registros · Página {data.page}</p>
        {!data.rows.length && <p>Nenhuma venda elegível neste período.</p>}
        {data.rows.map((row) => <article className="raffle-purchase" key={row.id}>
          <strong>{row.purchase.raffle.title}</strong><p>{row.purchase.user.nickname ?? `Jogador #${row.purchase.user.playerNumber}`} · {formatDateTime(row.createdAt)}</p>
          <p>{row.purchase.quantity} bilhete(s) · Compra {money(row.purchase.totalCents)} · Comissão {row.rateBps / 100}%: <strong>{money(row.amountCents - row.reversedCents)}</strong></p>
          <p className="hint">{row.reversedCents === row.amountCents && row.reversedCents > 0 ? 'Comissão totalmente estornada' : row.releasedAt ? 'Liberada na carteira' : `Liberação prevista: ${formatDateTime(row.availableAt)}`}
            {row.reversedCents > 0 && ` · Comissão revertida: ${money(row.reversedCents)}`}</p>
          {partnerId && <><p className="hint">Compra: {row.purchaseId}</p><RefundForm key={`${row.id}-${row.purchase.refundedCents}`} row={row} onSaved={load} /></>}
        </article>)}
        <div className="round-actions"><button disabled={busy || page <= 1} onClick={() => setPage(page - 1)}>Anterior</button><button disabled={busy || page * 50 >= data.total} onClick={() => setPage(page + 1)}>Próxima</button></div>
      </section>
      <details className="card"><summary>Cadastros indicados mais recentes</summary><p className="hint">Até 50 cadastros no período, com apelido e data. Dados de contato e CPF não são compartilhados.</p>
        {data.referred.map((user) => <p key={user.playerNumber}>{user.nickname ?? `Jogador #${user.playerNumber}`} · {formatDateTime(user.createdAt)}</p>)}</details>
      {partnerId && <details className="card"><summary>Histórico administrativo</summary>{data.audits.map((audit) => <article className="raffle-purchase" key={audit.id}><strong>{audit.action}</strong><p>{formatDateTime(audit.createdAt)} · Admin {audit.adminId}</p><pre className="partner-audit">{JSON.stringify(audit.details, null, 2)}</pre></article>)}</details>}
    </>}
  </div>;
}

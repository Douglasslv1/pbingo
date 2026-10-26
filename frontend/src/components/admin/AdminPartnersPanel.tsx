import { FormEvent, useCallback, useEffect, useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { Partner, partnerApi, partnerLink } from '../../partners';
import { formatBrl } from '../../format';
import PartnerDashboard from '../PartnerDashboard';

function ConfigForm({ partner, onSaved, onCancel }: { partner?: Partner; onSaved: () => Promise<void>; onCancel: () => void }) {
  const { auth } = useAuth();
  const [email, setEmail] = useState(partner?.user.email ?? ''); const [code, setCode] = useState(partner?.code ?? '');
  const [percent, setPercent] = useState(partner ? String(partner.rateBps / 100) : '');
  const [hold, setHold] = useState(partner ? String(partner.holdDays) : '');
  const [duration, setDuration] = useState(partner ? partner.durationDays === null ? 'unlimited' : 'limited' : '');
  const [days, setDays] = useState(partner?.durationDays ? String(partner.durationDays) : '');
  const [active, setActive] = useState(partner?.active ?? false); const [blocked, setBlocked] = useState(partner?.blocked ?? false);
  const [reason, setReason] = useState(''); const [error, setError] = useState(''); const [busy, setBusy] = useState(false);
  async function save(e: FormEvent) {
    e.preventDefault(); if (!auth) return;
    setBusy(true); setError('');
    try { await partnerApi.save(auth.token, { userEmail: email, ...(code ? { code } : {}), rateBps: Math.round(Number(percent) * 100),
      holdDays: Number(hold), durationDays: duration === 'unlimited' ? null : Number(days), active, blocked, reason }, partner?.id); await onSaved(); }
    catch (e) { setError(e instanceof Error ? e.message : 'Erro ao salvar parceiro'); }
    finally { setBusy(false); }
  }
  return <form className="card" onSubmit={save}><h2>{partner ? 'Editar parceria' : 'Cadastrar parceiro'}</h2>
    <label>E-mail da conta existente<input required type="email" disabled={!!partner} value={email} onChange={(e) => setEmail(e.target.value)} /></label>
    <label>Código do link (opcional; gerado se vazio)<input disabled={!!partner} minLength={4} maxLength={32} pattern="[a-z0-9-]{4,32}" value={code} onChange={(e) => setCode(e.target.value.toLowerCase())} /></label>
    <label>Comissão sobre o valor pago (%)<input required type="number" min="0.01" max="100" step="0.01" value={percent} onChange={(e) => setPercent(e.target.value)} /></label>
    <label>Dias para liberar após confirmação do Pix<input required type="number" min={0} max={365} value={hold} onChange={(e) => setHold(e.target.value)} /></label>
    <label>Prazo de remuneração por indicado<select required value={duration} onChange={(e) => setDuration(e.target.value)}><option value="">Escolha explicitamente</option><option value="unlimited">Todas as compras futuras, sem prazo</option><option value="limited">Durante um número de dias após o cadastro</option></select></label>
    {duration === 'limited' && <label>Dias após cada cadastro<input required type="number" min={1} max={3650} value={days} onChange={(e) => setDays(e.target.value)} /></label>}
    <label className="partner-check"><input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} /> Ativar link e novas comissões</label>
    <label className="partner-check"><input type="checkbox" checked={blocked} onChange={(e) => setBlocked(e.target.checked)} /> Bloquear para revisão, inclusive saques de comissões</label>
    <label>Motivo / observação administrativa<textarea required minLength={3} maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} /></label>
    <p className="hint">Percentual e prazo de liberação ficam registrados em cada compra. Alterações valem para as próximas compras. O vínculo de cadastros existentes não muda.</p>
    {error && <p className="error">{error}</p>}<button disabled={busy}>Salvar parceiro</button><button className="link" type="button" onClick={onCancel}>Cancelar</button>
  </form>;
}

export default function AdminPartnersPanel() {
  const { auth } = useAuth(); const [partners, setPartners] = useState<Partner[]>([]);
  const [editing, setEditing] = useState<Partner | 'new' | null>(null); const [selected, setSelected] = useState<string | null>(null); const [error, setError] = useState('');
  const load = useCallback(async () => { if (!auth) return; try { setPartners(await partnerApi.list(auth.token)); } catch (e) { setError(e instanceof Error ? e.message : 'Erro ao consultar parceiros'); } }, [auth]);
  useEffect(() => { void load(); }, [load]);
  return <div><div className="card"><h2>Parceiros e indicações</h2><p>Configure a conta, o percentual e os prazos antes de ativar o link. Pagamentos solicitados aparecem em Admin → Saques, identificados como comissões.</p>
    <button onClick={() => setEditing('new')}>Cadastrar novo parceiro</button><button className="link" onClick={() => load()}>Atualizar saldos</button></div>
    {error && <p className="banner">{error}</p>}
    {editing && <ConfigForm key={editing === 'new' ? 'new' : editing.id} partner={editing === 'new' ? undefined : editing} onCancel={() => setEditing(null)} onSaved={async () => { setEditing(null); setSelected(null); await load(); }} />}
    {partners.map((partner) => <article className="card" key={partner.id}><h3>{partner.user.name}</h3><p>{partner.user.email} · {partner.blocked ? 'Bloqueado para revisão' : partner.active ? 'Ativo' : 'Pausado'}</p>
      <p>{partner.rateBps / 100}% · Liberação: {partner.holdDays} dia(s) · Remuneração: {partner.durationDays === null ? 'sem prazo' : `${partner.durationDays} dias após cada cadastro`} · {partner._count.referrals} indicados</p>
      <input aria-label={`Link de ${partner.user.name}`} readOnly value={partnerLink(partner.code)} />
      <p>Disponível: {formatBrl((partner.wallet?.availableCents ?? 0) / 100)} · Pendente: {formatBrl((partner.wallet?.pendingCents ?? 0) / 100)} · Reservado: {formatBrl((partner.wallet?.reservedCents ?? 0) / 100)}</p>
      {!!partner.wallet?.debtCents && <p className="error">Estornos a compensar: {formatBrl(partner.wallet.debtCents / 100)}</p>}
      <div className="round-actions"><button onClick={() => setEditing(partner)}>Editar regras / bloquear</button><button className="link" onClick={() => setSelected(selected === partner.id ? null : partner.id)}>Ver dashboard detalhado</button></div>
    </article>)}
    {selected && <PartnerDashboard key={selected} partnerId={selected} />}
  </div>;
}

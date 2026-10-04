import { FormEvent, useCallback, useEffect, useState } from 'react';
import { api, ApiError } from '../../api';
import { useAuth } from '../../hooks/useAuth';
import { formatLabel, TOURNAMENT_FORMATS } from '../../pages/TournamentsPage';
import type { TournamentSummary } from '../../types';
import { formatDateTime } from '../../withdrawalFormat';

/** Formatos sugeridos: vagas e inscricao calibradas pelo ganho medio de Venox por dia. */
const PRESETS = [
  { name: 'Relâmpago', size: 8, entryFee: 20 },
  { name: 'Diário', size: 16, entryFee: 50 },
  { name: 'Semanal', size: 32, entryFee: 150 },
];

/** Cria torneios (com os formatos sugeridos) e cancela os que ainda nao comecaram. */
export default function AdminTournamentsPanel() {
  const { auth } = useAuth();
  const [list, setList] = useState<TournamentSummary[]>([]);
  const [form, setForm] = useState({ ...PRESETS[0], format: 0, startsAt: '' });
  const format = TOURNAMENT_FORMATS[form.format];
  const pairs = format.teamMode === 'PAIRS';
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    api.getTournaments().then(setList).catch(() => undefined);
  }, []);
  useEffect(load, [load]);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!auth) return;
    setError(null);
    setMessage(null);
    api
      .adminCreateTournament(auth.token, {
        name: form.name,
        game: format.game,
        mode: format.mode,
        teamMode: format.teamMode,
        size: form.size,
        entryFee: form.entryFee,
        startsAt: new Date(form.startsAt).toISOString(),
      })
      .then(() => {
        setMessage('Torneio criado.');
        load();
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Erro ao criar o torneio'));
  };

  const cancel = (id: string) => {
    if (!auth) return;
    api
      .adminCancelTournament(auth.token, id)
      .then(load)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Erro ao cancelar'));
  };

  return (
    <>
      <form className="card" onSubmit={submit}>
        <h2>Novo torneio</h2>
        <div className="tabs">
          {PRESETS.map((preset) => (
            <button
              key={preset.name}
              type="button"
              className={form.size === preset.size && form.entryFee === preset.entryFee ? 'tab active' : 'tab'}
              onClick={() => setForm({ ...form, ...preset })}
            >
              {preset.name}: {preset.size} vagas, {preset.entryFee} Venox
            </button>
          ))}
        </div>
        <label>
          Nome
          <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} minLength={3} maxLength={60} required />
        </label>
        <label>
          Jogo
          <select value={form.format} onChange={(e) => setForm({ ...form, format: Number(e.target.value) })}>
            {TOURNAMENT_FORMATS.map((option, index) => (
              <option key={option.label} value={index}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          {pairs ? 'Vagas (duplas)' : 'Vagas'}
          <select value={form.size} onChange={(e) => setForm({ ...form, size: Number(e.target.value) })}>
            {[8, 16, 32].map((size) => (
              <option key={size}>{size}</option>
            ))}
          </select>
        </label>
        <label>
          {pairs ? 'Inscrição por dupla (Venox, número par)' : 'Inscrição (Venox)'}
          <input
            type="number"
            min={0}
            max={10000}
            value={form.entryFee}
            onChange={(e) => setForm({ ...form, entryFee: Number(e.target.value) })}
            required
          />
        </label>
        <label>
          Início
          <input type="datetime-local" value={form.startsAt} onChange={(e) => setForm({ ...form, startsAt: e.target.value })} required />
        </label>
        <button type="submit">Criar torneio</button>
        {message && <p className="hint">{message}</p>}
        {error && <p className="error">{error}</p>}
      </form>

      <div className="card">
        <h2>Torneios</h2>
        {list.length === 0 && <p className="hint">Nenhum torneio ainda.</p>}
        <div className="tournament-list">
          {list.map((tournament) => (
            <div className="tournament-item" key={tournament.id}>
              <strong>{tournament.name}</strong>
              <div className="hint">
                {formatLabel(tournament)} · {formatDateTime(tournament.startsAt)} · {tournament.players}/
                {tournament.capacity} jogadores · pote {tournament.pot} Venox · {tournament.status}
              </div>
              {tournament.status === 'OPEN' && (
                <div className="tournament-actions">
                  <button type="button" className="danger" onClick={() => cancel(tournament.id)}>
                    Cancelar e devolver Venox
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

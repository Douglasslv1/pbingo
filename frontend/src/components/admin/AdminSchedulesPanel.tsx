import { FormEvent, useCallback, useEffect, useState } from 'react';
import { api, ApiError } from '../../api';
import { useAuth } from '../../hooks/useAuth';
import { formatLabel, TOURNAMENT_FORMATS } from '../../pages/TournamentsPage';
import type { TournamentSchedule } from '../../types';
import { formatDateTime } from '../../withdrawalFormat';

const WEEKDAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const EVERY_TWO_HOURS = Array.from({ length: 12 }, (_, i) => `${String(i * 2).padStart(2, '0')}:00`);

/** Agendas sugeridas: as mesmas vagas e inscricoes dos torneios avulsos, com horarios fixos. */
const PRESETS = [
  { name: 'Relâmpago', size: 8, entryFee: 20, times: EVERY_TWO_HOURS, weekdays: [] as number[] },
  { name: 'Diário', size: 16, entryFee: 50, times: ['21:00'], weekdays: [] as number[] },
  { name: 'Semanal', size: 32, entryFee: 150, times: ['20:00'], weekdays: [6] },
];

const describeDays = (weekdays: number[]) => (weekdays.length === 0 ? 'todos os dias' : weekdays.map((day) => WEEKDAYS[day]).join(', '));

/** Torneios automaticos: cada agenda ativa mantem um torneio aberto para a proxima data. */
export default function AdminSchedulesPanel({ onChange }: { onChange: () => void }) {
  const { auth } = useAuth();
  const token = auth?.token;
  const [schedules, setSchedules] = useState<TournamentSchedule[]>([]);
  const [form, setForm] = useState({ ...PRESETS[0], format: 0, timesText: PRESETS[0].times.join(', ') });
  const [error, setError] = useState<string | null>(null);
  const format = TOURNAMENT_FORMATS[form.format];

  const load = useCallback(() => {
    if (!token) return;
    api.adminSchedules(token).then(setSchedules).catch(() => undefined);
  }, [token]);
  useEffect(load, [load]);

  const run = (action: Promise<unknown>) => {
    setError(null);
    action
      .then(() => {
        load();
        onChange();
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Erro ao salvar a agenda'));
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!token) return;
    run(
      api.adminCreateSchedule(token, {
        name: form.name,
        game: format.game,
        mode: format.mode,
        teamMode: format.teamMode,
        size: form.size,
        entryFee: form.entryFee,
        weekdays: form.weekdays,
        times: form.timesText.split(/[\s,]+/).filter(Boolean),
      }),
    );
  };

  const toggleDay = (day: number) =>
    setForm({ ...form, weekdays: form.weekdays.includes(day) ? form.weekdays.filter((d) => d !== day) : [...form.weekdays, day] });

  return (
    <>
      <form className="card" onSubmit={submit}>
        <h2>Torneios automáticos</h2>
        <p className="hint">
          Cada agenda mantém sempre um torneio com inscrições abertas para a próxima data (horário de Brasília). Quando ele
          começa, o seguinte já abre.
        </p>
        <div className="tabs">
          {PRESETS.map((preset) => (
            <button
              key={preset.name}
              type="button"
              className={form.name === preset.name ? 'tab active' : 'tab'}
              onClick={() => setForm({ ...form, ...preset, timesText: preset.times.join(', ') })}
            >
              {preset.name}
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
          {format.teamMode === 'PAIRS' ? 'Vagas (duplas)' : 'Vagas'}
          <select value={form.size} onChange={(e) => setForm({ ...form, size: Number(e.target.value) })}>
            {[8, 16, 32].map((size) => (
              <option key={size}>{size}</option>
            ))}
          </select>
        </label>
        <label>
          {format.teamMode === 'PAIRS' ? 'Inscrição por dupla (Venox, número par)' : 'Inscrição (Venox)'}
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
          Horários (HH:MM, separados por vírgula)
          <input value={form.timesText} onChange={(e) => setForm({ ...form, timesText: e.target.value })} required />
        </label>
        <div className="schedule-days">
          <span className="label">Dias (nenhum marcado = todos os dias)</span>
          {WEEKDAYS.map((label, day) => (
            <label key={label} className="checkbox">
              <input type="checkbox" checked={form.weekdays.includes(day)} onChange={() => toggleDay(day)} />
              {label}
            </label>
          ))}
        </div>
        <button type="submit">Criar agenda</button>
        {error && <p className="error">{error}</p>}
      </form>

      {schedules.length > 0 && (
        <div className="card">
          <h2>Agendas</h2>
          <div className="tournament-list">
            {schedules.map((schedule) => (
              <div className="tournament-item" key={schedule.id}>
                <strong>
                  {schedule.name} {!schedule.active && <span className="hint">(pausada)</span>}
                </strong>
                <div className="hint">
                  {formatLabel(schedule)} · {schedule.size} vagas · {schedule.entryFee} Venox · {describeDays(schedule.weekdays)} às{' '}
                  {schedule.times.join(', ')}
                </div>
                {schedule.nextStartsAt && <div className="hint">Próximo: {formatDateTime(schedule.nextStartsAt)}</div>}
                <div className="tournament-actions">
                  <button type="button" className="tab" onClick={() => token && run(api.adminSetScheduleActive(token, schedule.id, !schedule.active))}>
                    {schedule.active ? 'Pausar' : 'Retomar'}
                  </button>
                  <button type="button" className="danger" onClick={() => token && run(api.adminDeleteSchedule(token, schedule.id))}>
                    Excluir
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}

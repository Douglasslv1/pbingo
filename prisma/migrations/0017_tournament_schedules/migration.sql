-- Agendas de torneios automaticos: sempre um torneio aberto para a proxima data de cada agenda ativa
CREATE TABLE tournament_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(60) NOT NULL,
  game VARCHAR(20) NOT NULL,
  mode VARCHAR(20) NOT NULL,
  team_mode VARCHAR(20) NOT NULL,
  size INT NOT NULL,
  entry_fee INT NOT NULL,
  -- Dias da semana (0 = domingo; vazio = todos) e horarios "HH:MM" no horario de Brasilia
  weekdays INT[] NOT NULL DEFAULT '{}',
  times VARCHAR(5)[] NOT NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE tournaments ADD COLUMN schedule_id UUID REFERENCES tournament_schedules(id) ON DELETE SET NULL;
-- No maximo um torneio aberto por agenda (dois ciclos ao mesmo tempo nao duplicam)
CREATE UNIQUE INDEX unique_open_tournament_per_schedule ON tournaments(schedule_id) WHERE status = 'OPEN';

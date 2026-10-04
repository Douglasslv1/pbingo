-- Torneios mata-mata pagos em Venox (inscricao e premio so em Venox)
CREATE TYPE tournament_status AS ENUM ('OPEN', 'RUNNING', 'FINISHED', 'CANCELLED');

CREATE TABLE tournaments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(60) NOT NULL,
  game VARCHAR(20) NOT NULL,
  mode VARCHAR(20) NOT NULL,
  team_mode VARCHAR(20) NOT NULL,
  size INT NOT NULL,
  entry_fee INT NOT NULL,
  starts_at TIMESTAMPTZ NOT NULL,
  status tournament_status NOT NULL DEFAULT 'OPEN',
  pot INT NOT NULL DEFAULT 0,
  rounds INT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at TIMESTAMPTZ
);
CREATE INDEX idx_tournaments_status ON tournaments(status, starts_at);

CREATE TABLE tournament_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id UUID NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  placement INT,
  prize INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT unique_tournament_entry UNIQUE (tournament_id, user_id)
);

-- Chave: rodada 1 e a primeira; o vencedor de (rodada, slot) vai para (rodada + 1, slot / 2)
CREATE TABLE tournament_matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id UUID NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  round INT NOT NULL,
  slot INT NOT NULL,
  player0_id UUID REFERENCES users(id),
  player1_id UUID REFERENCES users(id),
  winner_id UUID REFERENCES users(id),
  table_id UUID UNIQUE REFERENCES game_tables(id),
  CONSTRAINT unique_tournament_match UNIQUE (tournament_id, round, slot)
);

ALTER TABLE game_tables ADD COLUMN tournament_id UUID REFERENCES tournaments(id);

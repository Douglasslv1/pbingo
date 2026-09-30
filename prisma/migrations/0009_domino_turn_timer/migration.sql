-- Prazo da jogada da vez: vencido, o sistema joga pelo jogador (sobrevive a reinicios)
ALTER TABLE domino_tables ADD COLUMN turn_deadline TIMESTAMP WITH TIME ZONE;

-- Tempos esgotados seguidos; com 2, o jogador e marcado como ausente e o sistema joga por ele
ALTER TABLE domino_seats ADD COLUMN timeouts INT NOT NULL DEFAULT 0 CHECK (timeouts >= 0);
ALTER TABLE domino_seats ADD COLUMN is_away BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX idx_domino_tables_turn_deadline ON domino_tables(turn_deadline) WHERE status = 'PLAYING';

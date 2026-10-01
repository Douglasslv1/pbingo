-- Vencedor de cada cadeira, gravado mesmo sem premio (mesas gratuitas): base do perfil e do ranking
ALTER TABLE game_seats ADD COLUMN is_winner BOOLEAN NOT NULL DEFAULT FALSE;

-- Partidas ja encerradas: o vencedor sai do estado salvo de cada jogo
UPDATE game_seats s SET is_winner = TRUE
FROM game_tables t
WHERE s.table_id = t.id AND t.status = 'FINISHED' AND t.game = 'DOMINO'
  AND (t.state -> 'result' -> 'winnerSeats') @> to_jsonb(s.seat);

UPDATE game_seats s SET is_winner = TRUE
FROM game_tables t
WHERE s.table_id = t.id AND t.status = 'FINISHED' AND t.game = 'TRUCO'
  AND t.state ->> 'winner' = (s.seat % 2)::text;

CREATE INDEX idx_game_seats_winner ON game_seats(user_id) WHERE is_winner;

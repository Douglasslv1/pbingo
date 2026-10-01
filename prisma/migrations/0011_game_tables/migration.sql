-- As mesas do domino passam a servir a qualquer jogo de mesa (domino e truco): so renomeia, sem perder dados
ALTER TABLE domino_tables RENAME TO game_tables;
ALTER TABLE domino_seats RENAME TO game_seats;
ALTER TABLE domino_moves RENAME TO game_moves;
ALTER TYPE domino_table_status RENAME TO game_table_status;

-- Jogo da mesa e valor da entrada (1, 2 ou 5 chaves)
ALTER TABLE game_tables ADD COLUMN game VARCHAR(20) NOT NULL DEFAULT 'DOMINO';
ALTER TABLE game_tables ADD COLUMN stake INT NOT NULL DEFAULT 1 CHECK (stake > 0);

-- A fila agora separa tambem por jogo e por valor
DROP INDEX idx_domino_tables_queue;
CREATE INDEX idx_game_tables_queue ON game_tables(game, status, mode, team_mode, stake, created_at);

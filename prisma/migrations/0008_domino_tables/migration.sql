-- Mesas de domino: fila por modalidade ate completar 4 jogadores, depois a partida
CREATE TYPE domino_table_status AS ENUM ('WAITING', 'PLAYING', 'FINISHED', 'CANCELLED');

CREATE TABLE domino_tables (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    mode VARCHAR(20) NOT NULL,
    team_mode VARCHAR(20) NOT NULL,
    status domino_table_status NOT NULL DEFAULT 'WAITING',
    -- Estado completo do motor de regras (maos, mesa, vez); so o servidor le
    state JSONB,
    prize_pool DECIMAL(10, 2) NOT NULL DEFAULT 0.00 CHECK (prize_pool >= 0.00),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    started_at TIMESTAMP WITH TIME ZONE,
    finished_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_domino_tables_queue ON domino_tables(status, mode, team_mode, created_at);

CREATE TABLE domino_seats (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    table_id UUID NOT NULL REFERENCES domino_tables(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id),
    seat INT NOT NULL CHECK (seat BETWEEN 0 AND 3),
    credits_spent INT NOT NULL CHECK (credits_spent >= 0),
    prize_contribution DECIMAL(10, 2) NOT NULL CHECK (prize_contribution >= 0.00),
    prize_amount DECIMAL(10, 2),
    joined_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_domino_seat UNIQUE (table_id, seat),
    CONSTRAINT unique_domino_player UNIQUE (table_id, user_id)
);

CREATE INDEX idx_domino_seats_user_id ON domino_seats(user_id);

-- Registro de cada jogada, para auditoria e disputas
CREATE TABLE domino_moves (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    table_id UUID NOT NULL REFERENCES domino_tables(id) ON DELETE CASCADE,
    move_number INT NOT NULL,
    seat INT NOT NULL,
    action JSONB NOT NULL,
    automatic BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_domino_move UNIQUE (table_id, move_number)
);

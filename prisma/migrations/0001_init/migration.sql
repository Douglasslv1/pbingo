-- Extensao necessaria para gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1. Usuarios
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. Carteira de Chaves (Consumo - NAO SACAVEL)
CREATE TABLE user_credits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    balance INT NOT NULL DEFAULT 0 CHECK (balance >= 0),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_user_credits UNIQUE (user_id)
);

-- 3. Carteira de Premios (Saldo Sacavel em Reais)
CREATE TABLE user_prizes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    balance_fiat DECIMAL(10, 2) NOT NULL DEFAULT 0.00 CHECK (balance_fiat >= 0.00),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_user_prizes UNIQUE (user_id)
);

-- 4. Rodadas do Bingo
CREATE TYPE round_status AS ENUM ('WAITING', 'IN_PROGRESS', 'FINISHED');

CREATE TABLE rounds (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    status round_status NOT NULL DEFAULT 'WAITING',
    accumulated_prize DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    drawn_numbers INT[] DEFAULT '{}',
    winner_user_id UUID REFERENCES users(id),
    started_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    ended_at TIMESTAMP WITH TIME ZONE
);

-- 5. Cartelas / Bilhetes Comprados para a Rodada
CREATE TABLE tickets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    round_id UUID NOT NULL REFERENCES rounds(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id),
    numbers_matrix JSONB NOT NULL,
    marked_numbers INT[] DEFAULT '{}',
    is_winner BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 6. Log de Auditoria Financeira e Transacoes
CREATE TYPE transaction_type AS ENUM ('PURCHASE_CREDITS', 'SPEND_KEY', 'PRIZE_PAYOUT', 'WITHDRAWAL');

CREATE TABLE transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id),
    type transaction_type NOT NULL,
    amount_fiat DECIMAL(10, 2) DEFAULT 0.00,
    amount_credits INT DEFAULT 0,
    status VARCHAR(50) NOT NULL DEFAULT 'COMPLETED',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indices de apoio para consultas frequentes
CREATE INDEX idx_tickets_round_id ON tickets(round_id);
CREATE INDEX idx_tickets_user_id ON tickets(user_id);
CREATE INDEX idx_transactions_user_id ON transactions(user_id);
CREATE INDEX idx_rounds_status ON rounds(status);

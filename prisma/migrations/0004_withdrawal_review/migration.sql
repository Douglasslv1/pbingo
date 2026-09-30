-- Papel do usuario: apenas ADMIN acessa o painel de saques
CREATE TYPE user_role AS ENUM ('PLAYER', 'ADMIN');
ALTER TABLE users ADD COLUMN role user_role NOT NULL DEFAULT 'PLAYER';

-- Pedidos de saque com os dados Pix e o resultado da revisao manual
CREATE TYPE withdrawal_status AS ENUM ('PENDING', 'PAID', 'REJECTED');
CREATE TYPE pix_key_type AS ENUM ('CPF', 'EMAIL', 'PHONE', 'RANDOM');

CREATE TABLE withdrawals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id),
    transaction_id UUID NOT NULL UNIQUE REFERENCES transactions(id),
    amount_fiat DECIMAL(10, 2) NOT NULL CHECK (amount_fiat > 0.00),
    cpf CHAR(11) NOT NULL,
    pix_key_type pix_key_type NOT NULL,
    pix_key VARCHAR(255) NOT NULL,
    status withdrawal_status NOT NULL DEFAULT 'PENDING',
    payment_reference VARCHAR(255),
    rejection_reason VARCHAR(500),
    reviewed_by_user_id UUID REFERENCES users(id),
    reviewed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_withdrawals_status_created_at ON withdrawals(status, created_at);
CREATE INDEX idx_withdrawals_user_id ON withdrawals(user_id);

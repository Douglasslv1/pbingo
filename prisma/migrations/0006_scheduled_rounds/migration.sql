-- Rodada cancelada por nao atingir o minimo de jogadores (chaves devolvidas)
ALTER TYPE round_status ADD VALUE 'CANCELLED';
ALTER TYPE transaction_type ADD VALUE 'KEY_REFUND';

-- Horario fixo em que a rodada comeca (grade de 15 em 15 minutos)
ALTER TABLE rounds ADD COLUMN scheduled_at TIMESTAMP WITH TIME ZONE;

-- Quanto cada cartela custou e quanto somou ao premio: permite devolver o valor exato
-- mesmo que o preco ou a comissao mudem enquanto a rodada esta aberta
ALTER TABLE tickets ADD COLUMN credits_spent INT NOT NULL DEFAULT 1 CHECK (credits_spent >= 0);
ALTER TABLE tickets ADD COLUMN prize_contribution DECIMAL(10, 2) NOT NULL DEFAULT 0.00 CHECK (prize_contribution >= 0.00);

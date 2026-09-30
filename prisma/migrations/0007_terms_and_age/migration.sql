-- Confirmacao de maioridade e aceite dos Termos de Uso / Politica de Privacidade (LGPD)
ALTER TABLE users ADD COLUMN birth_date DATE;
ALTER TABLE users ADD COLUMN terms_accepted_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE users ADD COLUMN terms_version VARCHAR(20);

-- Registros de acesso (IP + data/hora) guardados por 6 meses, como exige o Marco Civil da Internet (art. 15)
CREATE TABLE access_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    event VARCHAR(30) NOT NULL,
    ip VARCHAR(64),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_access_logs_user_id ON access_logs(user_id);
CREATE INDEX idx_access_logs_created_at ON access_logs(created_at);

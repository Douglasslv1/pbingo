-- Venox: moeda ganha jogando (vitorias e visita diaria); nao se compra nem se saca
ALTER TABLE users ADD COLUMN venox INT NOT NULL DEFAULT 0 CHECK (venox >= 0);

CREATE TABLE venox_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount INT NOT NULL,
  reason VARCHAR(20) NOT NULL,
  ref VARCHAR(64) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Cada vitoria (ref = mesa) e cada dia (ref = data) rende uma unica vez
CREATE UNIQUE INDEX unique_venox_ledger_ref ON venox_ledger(user_id, reason, ref);
CREATE INDEX idx_venox_ledger_user ON venox_ledger(user_id, created_at DESC);

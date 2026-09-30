-- Jogo de origem da movimentacao (BINGO ou DOMINO), para o extrato mostrar cada uma corretamente.
ALTER TABLE transactions ADD COLUMN game VARCHAR(20);

-- Tudo o que aconteceu antes da primeira mesa de domino so pode ser do bingo.
-- O que veio depois e nao da para distinguir fica sem jogo (o extrato mostra um rotulo neutro).
UPDATE transactions
SET game = 'BINGO'
WHERE type IN ('SPEND_KEY', 'KEY_REFUND', 'PRIZE_PAYOUT')
  AND created_at < COALESCE((SELECT MIN(created_at) FROM domino_tables), 'infinity'::timestamptz);

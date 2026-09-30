-- Parte do premio recebida por cada cartela vencedora (permite dividir o premio em caso de empate)
ALTER TABLE tickets ADD COLUMN prize_amount DECIMAL(10, 2) CHECK (prize_amount >= 0.00);

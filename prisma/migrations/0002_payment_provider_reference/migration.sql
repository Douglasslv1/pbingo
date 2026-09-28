ALTER TABLE transactions ADD COLUMN provider_reference VARCHAR(255);

CREATE INDEX idx_transactions_provider_reference ON transactions(provider_reference);

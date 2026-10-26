CREATE TABLE partners (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(), user_id UUID NOT NULL UNIQUE REFERENCES users(id),
 code VARCHAR(32) NOT NULL UNIQUE CHECK (code ~ '^[a-z0-9-]{4,32}$'),
 rate_bps INT NOT NULL CHECK (rate_bps BETWEEN 1 AND 10000),
 hold_days INT NOT NULL CHECK (hold_days BETWEEN 0 AND 365),
 duration_days INT CHECK (duration_days BETWEEN 1 AND 3650),
 active BOOLEAN NOT NULL DEFAULT FALSE, blocked BOOLEAN NOT NULL DEFAULT FALSE,
 balance_cents NUMERIC(14,0) NOT NULL DEFAULT 0, created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE users ADD COLUMN affiliate_id UUID REFERENCES partners(id);
CREATE INDEX users_affiliate_id_idx ON users(affiliate_id);
CREATE FUNCTION prevent_referral_change() RETURNS TRIGGER AS $$
BEGIN
 IF NEW.affiliate_id IS DISTINCT FROM OLD.affiliate_id THEN
  RAISE EXCEPTION 'O parceiro de um cadastro não pode ser alterado';
 END IF;
 RETURN NEW;
END; $$ LANGUAGE plpgsql;
CREATE TRIGGER immutable_user_referral BEFORE UPDATE OF affiliate_id ON users
 FOR EACH ROW EXECUTE FUNCTION prevent_referral_change();

ALTER TABLE raffle_purchases ADD COLUMN refunded_cents INT NOT NULL DEFAULT 0 CHECK (refunded_cents >= 0 AND refunded_cents <= total_cents);
ALTER TABLE raffle_purchases ADD COLUMN commission_partner_id UUID REFERENCES partners(id);
ALTER TABLE raffle_purchases ADD COLUMN commission_bps INT NOT NULL DEFAULT 0 CHECK (commission_bps BETWEEN 0 AND 10000);
ALTER TABLE raffle_purchases ADD COLUMN commission_hold_days INT NOT NULL DEFAULT 0 CHECK (commission_hold_days BETWEEN 0 AND 365);
ALTER TABLE withdrawals ADD COLUMN source VARCHAR(20) NOT NULL DEFAULT 'PRIZES' CHECK (source IN ('PRIZES', 'COMMISSIONS'));

CREATE TABLE partner_commissions (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(), partner_id UUID NOT NULL REFERENCES partners(id),
 purchase_id UUID NOT NULL UNIQUE REFERENCES raffle_purchases(id), rate_bps INT NOT NULL CHECK (rate_bps BETWEEN 1 AND 10000),
 amount_cents INT NOT NULL CHECK (amount_cents >= 0),
 reversed_cents INT NOT NULL DEFAULT 0 CHECK (reversed_cents BETWEEN 0 AND amount_cents),
 available_at TIMESTAMPTZ NOT NULL, released_at TIMESTAMPTZ,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX partner_commissions_partner_id_released_at_available_at_idx ON partner_commissions(partner_id, released_at, available_at);
CREATE TABLE partner_audits (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(), partner_id UUID NOT NULL REFERENCES partners(id),
 admin_id UUID NOT NULL REFERENCES users(id), action VARCHAR(30) NOT NULL, details JSONB NOT NULL,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX partner_audits_partner_id_created_at_idx ON partner_audits(partner_id, created_at);

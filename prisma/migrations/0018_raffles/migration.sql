ALTER TYPE transaction_type ADD VALUE 'PURCHASE_RAFFLE';

CREATE TABLE raffles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(120) NOT NULL,
  description TEXT NOT NULL,
  image TEXT NOT NULL,
  prize VARCHAR(255) NOT NULL,
  price_cents INT NOT NULL CHECK (price_cents BETWEEN 1 AND 10000000),
  discounts JSONB NOT NULL DEFAULT '[]',
  digits INT NOT NULL CHECK (digits BETWEEN 1 AND 5),
  lottery VARCHAR(80) NOT NULL,
  contest VARCHAR(40) NOT NULL,
  prize_position INT NOT NULL CHECK (prize_position BETWEEN 1 AND 10),
  closes_at TIMESTAMPTZ NOT NULL,
  draw_at TIMESTAMPTZ NOT NULL,
  status VARCHAR(10) NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'OPEN', 'CLOSED', 'DRAWN')),
  drawn_number INT,
  result_number VARCHAR(30),
  result_source TEXT,
  result_recorded_by UUID REFERENCES users(id),
  drawn_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (closes_at <= draw_at)
);
CREATE INDEX raffles_status_draw_at_idx ON raffles(status, draw_at);

CREATE TABLE raffle_purchases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  raffle_id UUID NOT NULL REFERENCES raffles(id),
  user_id UUID NOT NULL REFERENCES users(id),
  transaction_id UUID NOT NULL UNIQUE REFERENCES transactions(id),
  quantity INT NOT NULL CHECK (quantity BETWEEN 1 AND 1000),
  unit_price_cents INT NOT NULL CHECK (unit_price_cents > 0),
  discount_percent INT NOT NULL CHECK (discount_percent BETWEEN 0 AND 90),
  total_cents INT NOT NULL CHECK (total_cents BETWEEN 100 AND 999999999),
  status VARCHAR(10) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'PAID', 'FAILED')),
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX raffle_purchases_raffle_id_status_idx ON raffle_purchases(raffle_id, status);
CREATE INDEX raffle_purchases_user_id_created_at_idx ON raffle_purchases(user_id, created_at);

CREATE TABLE raffle_tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  raffle_id UUID NOT NULL REFERENCES raffles(id),
  purchase_id UUID NOT NULL REFERENCES raffle_purchases(id),
  number INT NOT NULL CHECK (number >= 0),
  UNIQUE (raffle_id, number)
);
CREATE INDEX raffle_tickets_purchase_id_idx ON raffle_tickets(purchase_id);

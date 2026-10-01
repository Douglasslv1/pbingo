-- Apelido publico (mesas e ranking): unico sem diferenciar maiusculas
ALTER TABLE users ADD COLUMN nickname VARCHAR(20);
ALTER TABLE users ADD COLUMN nickname_changed_at TIMESTAMP WITH TIME ZONE;
CREATE UNIQUE INDEX unique_users_nickname ON users (LOWER(nickname));

-- Numero publico de quem ainda nao escolheu apelido ("Jogador #0042"), nunca o nome real
ALTER TABLE users ADD COLUMN player_number SERIAL;
ALTER TABLE users ADD CONSTRAINT unique_users_player_number UNIQUE (player_number);

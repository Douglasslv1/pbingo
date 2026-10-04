-- Torneios em dupla: convite pelo apelido (INVITED ate o parceiro aceitar e pagar sua metade)
ALTER TABLE tournament_entries ADD COLUMN status VARCHAR(10) NOT NULL DEFAULT 'CONFIRMED';
ALTER TABLE tournament_entries ADD COLUMN partner_id UUID REFERENCES users(id);
-- Na largada, cada inscrito aponta para o capitao da sua equipe (ele mesmo no mano a mano); a chave usa o capitao
ALTER TABLE tournament_entries ADD COLUMN captain_id UUID REFERENCES users(id);

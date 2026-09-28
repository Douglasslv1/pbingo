# Sistema de Bingo Online - Especificação de Arquitetura e Escopo Técnico

Este documento define a arquitetura, o modelo de dados, as regras de negócio e os padrões de engenharia para o desenvolvimento do sistema autônomo de **Bingo Online**.

---

## 1. Visão Geral do Sistema

O sistema é uma plataforma de entretenimento baseada em rodadas cronometradas de bingo com bilheteria acumulativa. 

### Principais Funcionalidades:
* **Gestão de Usuários e Autenticação:** Cadastro seguro, perfis e autenticação baseada em tokens.
* **Sistema de Créditos e Chaves (Não Sacável):** Os usuários adquirem créditos/chaves de participação (através de pagamentos integrados, ex: Pix). O saldo de chaves serve estritamente para consumo nas rodadas e **nunca é passível de saque**.
* **Sistema de Prêmios (Saldo Sacável):** O valor acumulado das rodadas é distribuído aos vencedores em formato de saldo em moeda fiduciária (Reais), que pode ser sacado para contas bancárias mediante validação.
* **Rodadas Cronometradas (Janelas de 1 Minuto):** Rodadas abertas por um período determinado para entrada de jogadores e alocação de bilhetes/cartelas.
* **Sorteio em Tempo Real:** Sorteio automatizado de números transmitido em tempo real via WebSockets, com validação estrita no servidor.

---

## 2. Pilares de Engenharia e Segurança

* **Zero Saldo Negativo:** O modelo de dados e as transações de banco de dados devem garantir estritamente que carteiras e saldos nunca fiquem abaixo de zero (`CHECK (balance >= 0)`).
* **Isolamento e Concorrência (ACID):** Operações financeiras de dedução de chaves e acumulação de prêmios devem ocorrer dentro de transações atômicas com bloqueio de linha (`SELECT ... FOR UPDATE`) para evitar *race conditions*.
* **Validação no Servidor:** Nenhuma lógica crítica (como validação de cartela vencedora ou conferência de saldo) pode confiar no frontend.
* **Clean Code:** Funções pequenas, alta coesão, baixo acoplamento, nomes descritivos e ausência de duplicação.

---

## 3. Modelagem de Dados (PostgreSQL Schema)

```sql
-- 1. Usuários
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. Carteira de Chaves (Consumo - NÃO SACÁVEL)
CREATE TABLE user_credits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    balance INT NOT NULL DEFAULT 0 CHECK (balance >= 0),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_user_credits UNIQUE (user_id)
);

-- 3. Carteira de Prêmios (Saldo Sacável em Reais)
CREATE TABLE user_prizes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    balance_fiat DECIMAL(10, 2) NOT NULL DEFAULT 0.00 CHECK (balance_fiat >= 0.00),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_user_prizes UNIQUE (user_id)
);

-- 4. Rodadas do Bingo
CREATE TYPE round_status AS ENUM ('WAITING', 'IN_PROGRESS', 'FINISHED');

CREATE TABLE rounds (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    status round_status NOT NULL DEFAULT 'WAITING',
    accumulated_prize DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    drawn_numbers INT[] DEFAULT '{}',
    winner_user_id UUID REFERENCES users(id),
    started_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    ended_at TIMESTAMP WITH TIME ZONE
);

-- 5. Cartelas / Bilhetes Comprados para a Rodada
CREATE TABLE tickets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    round_id UUID NOT NULL REFERENCES rounds(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id),
    numbers_matrix JSONB NOT NULL, -- Matriz 5x5 da cartela
    marked_numbers INT[] DEFAULT '{}',
    is_winner BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 6. Log de Auditoria Financeira e Transações
CREATE TYPE transaction_type AS ENUM ('PURCHASE_CREDITS', 'SPEND_KEY', 'PRIZE_PAYOUT', 'WITHDRAWAL');

CREATE TABLE transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id),
    type transaction_type NOT NULL,
    amount_fiat DECIMAL(10, 2) DEFAULT 0.00,
    amount_credits INT DEFAULT 0,
    status VARCHAR(50) NOT NULL DEFAULT 'COMPLETED',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
```

---

## 4. Fluxos Operacionais Críticos

1. **Aquisição de Créditos (Chaves):**
   * Confirmação de pagamento externo $\rightarrow$ Transação ACID $\rightarrow$ Incremento em `user_credits` $\rightarrow$ Registro imutável em `transactions`.
2. **Entrada na Rodada:**
   * Validação de saldo com *Row Lock* (`FOR UPDATE`) $\rightarrow$ Decremento da chave $\rightarrow$ Criação do bilhete em `tickets` $\rightarrow$ Incremento do prêmio acumulado na rodada (`rounds.accumulated_prize`).
3. **Ciclo de Rodada e Sorteio:**
   * Janela de espera (1 minuto) $\rightarrow$ Mudança de status para `IN_PROGRESS` $\rightarrow$ Sorteio iterativo de números via Worker/WebSocket $\rightarrow$ Validação estrita de vitória no servidor $\rightarrow$ Credito do prêmio em `user_prizes` $\rightarrow$ Encerramento da rodada e abertura da próxima.
-- Script DDL que cria toda a estrutura do banco de dados.
-- Define o schema, os tipos customizados (game_status, bingo_letter)
-- e as tabelas: users, games, cards, card_cells, drawn_numbers e bingo_claims,
-- com suas chaves primárias, estrangeiras, constraints e índices.
-- Deve ser executado uma única vez antes de subir o servidor:
--   psql -d bingo_db -f backend/db/schema.sql
-- Ou, caso suas variáveis não estejam configuradas:
--   & "<caminho do psql.exe>" -U postgres -d bingo_db -f backend/db/schema.sql

-- ============================================================
-- SCHEMA: bingo
-- ============================================================

CREATE SCHEMA IF NOT EXISTS bingo;
SET search_path TO bingo;

-- ------------------------------------------------------------
-- Tabela: users
-- ------------------------------------------------------------
CREATE TABLE users (
    id            SERIAL PRIMARY KEY,
    username      VARCHAR(50) NOT NULL UNIQUE,
    password_hash TEXT        NOT NULL,
    is_admin      BOOLEAN     NOT NULL DEFAULT FALSE,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_users_username ON users(username);

-- ------------------------------------------------------------
-- Tabela: games
-- ------------------------------------------------------------
CREATE TYPE game_status AS ENUM ('waiting', 'active', 'finished');

CREATE TABLE games (
    id          SERIAL PRIMARY KEY,
    status      game_status NOT NULL DEFAULT 'waiting',
    created_by  INT         NOT NULL REFERENCES users(id),
    started_at  TIMESTAMPTZ,
    finished_at TIMESTAMPTZ,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_games_status ON games(status);

-- ------------------------------------------------------------
-- Tabela: cards
-- ------------------------------------------------------------
CREATE TABLE cards (
    id          SERIAL PRIMARY KEY,
    user_id     INT         NOT NULL REFERENCES users(id),
    game_id     INT         NOT NULL REFERENCES games(id),
    is_complete BOOLEAN     NOT NULL DEFAULT FALSE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, game_id)
);

CREATE INDEX idx_cards_game_id ON cards(game_id);
CREATE INDEX idx_cards_user_id ON cards(user_id);

-- ------------------------------------------------------------
-- Tabela: card_cells
-- ------------------------------------------------------------
CREATE TYPE bingo_letter AS ENUM ('B', 'I', 'N', 'G', 'O');

CREATE TABLE card_cells (
    id        SERIAL       PRIMARY KEY,
    card_id   INT          NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
    letter    bingo_letter NOT NULL,
    row_index SMALLINT     NOT NULL CHECK (row_index BETWEEN 1 AND 5),
    number    SMALLINT,
    is_marked BOOLEAN      NOT NULL DEFAULT FALSE,
    is_free   BOOLEAN      NOT NULL DEFAULT FALSE,
    UNIQUE (card_id, letter, row_index)
);

CREATE INDEX idx_card_cells_card_id ON card_cells(card_id);

ALTER TABLE card_cells ADD CONSTRAINT chk_number_range CHECK (
    number IS NULL OR (
        (letter = 'B' AND number BETWEEN 1  AND 15) OR
        (letter = 'I' AND number BETWEEN 16 AND 30) OR
        (letter = 'N' AND number BETWEEN 31 AND 45) OR
        (letter = 'G' AND number BETWEEN 46 AND 60) OR
        (letter = 'O' AND number BETWEEN 61 AND 75)
    )
);

-- ------------------------------------------------------------
-- Tabela: drawn_numbers
-- ------------------------------------------------------------
CREATE TABLE drawn_numbers (
    id          SERIAL       PRIMARY KEY,
    game_id     INT          NOT NULL REFERENCES games(id),
    number      SMALLINT     NOT NULL CHECK (number BETWEEN 1 AND 75),
    letter      bingo_letter NOT NULL,
    drawn_order INT          NOT NULL,
    drawn_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    UNIQUE (game_id, number)
);

CREATE INDEX idx_drawn_numbers_game_id ON drawn_numbers(game_id);

-- ------------------------------------------------------------
-- Tabela: bingo_claims
-- ------------------------------------------------------------
CREATE TABLE bingo_claims (
    id         SERIAL      PRIMARY KEY,
    user_id    INT         NOT NULL REFERENCES users(id),
    game_id    INT         NOT NULL REFERENCES games(id),
    card_id    INT         NOT NULL REFERENCES cards(id),
    is_valid   BOOLEAN     NOT NULL,
    claimed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_bingo_claims_game_id ON bingo_claims(game_id);

-- ------------------------------------------------------------
-- Views
-- ------------------------------------------------------------
CREATE OR REPLACE VIEW v_card_progress AS
SELECT
    c.id     AS card_id,
    c.user_id,
    c.game_id,
    u.username,
    COUNT(*) AS total_cells,
    SUM(CASE WHEN cc.is_marked THEN 1 ELSE 0 END) AS marked_cells,
    c.is_complete
FROM cards c
JOIN users u  ON u.id  = c.user_id
JOIN card_cells cc ON cc.card_id = c.id
GROUP BY c.id, c.user_id, c.game_id, u.username, c.is_complete;

CREATE OR REPLACE VIEW v_draw_history AS
SELECT
    dn.game_id,
    dn.drawn_order,
    dn.letter,
    dn.number,
    dn.drawn_at
FROM drawn_numbers dn
ORDER BY dn.game_id, dn.drawn_order;
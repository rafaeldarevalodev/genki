-- Genki 2.0 — SRS Core Migration
-- File: services/genki-db/migrations/001_add_srs_core.sql
-- Run after: init-db.sql (existing tables must exist first)
-- SQLite 3.x compatible

PRAGMA foreign_keys = ON;

-- ══════════════════════════════════════════════════════════════════════════════
-- 1. EXTEND users — add XP and level (legacy column survives)
-- ══════════════════════════════════════════════════════════════════════════════

ALTER TABLE users ADD COLUMN xp INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN level INTEGER DEFAULT 1;


-- ══════════════════════════════════════════════════════════════════════════════
-- 2. CREATE decks — one user owns many decks
-- ══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS decks (
    id          TEXT PRIMARY KEY,
    user_id     TEXT NOT NULL,
    name        TEXT NOT NULL,
    source_text TEXT,
    cefr_level  TEXT CHECK(cefr_level IN ('A1','A2','B1','B2','C1','C2')),
    created_at  REAL DEFAULT (unixepoch()),

    FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_decks_user
    ON decks(user_id);


-- ══════════════════════════════════════════════════════════════════════════════
-- 3. CREATE cards — one deck contains many cards
-- ══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS cards (
    id                TEXT PRIMARY KEY,
    deck_id           TEXT NOT NULL,
    front             TEXT NOT NULL,
    back             TEXT NOT NULL,
    ipa              TEXT,
    spanish_phonetic TEXT,
    explanation      TEXT,
    category         TEXT CHECK(category IN (
        'structure','action','concept','modifier','idiom','filler'
    )),
    voice            TEXT,

    -- SRS fields
    ef                REAL    DEFAULT 2.5,
    interval          INTEGER DEFAULT 0,
    repetition        INTEGER DEFAULT 0,
    next_review       REAL    DEFAULT (unixepoch()),
    status            TEXT    DEFAULT 'new'
                      CHECK(status IN ('new','learning','review','mastered')),
    created_at        REAL    DEFAULT (unixepoch()),

    FOREIGN KEY (deck_id) REFERENCES decks(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_cards_next_review
    ON cards(next_review);

CREATE INDEX IF NOT EXISTS idx_cards_deck
    ON cards(deck_id);

CREATE INDEX IF NOT EXISTS idx_cards_status
    ON cards(status);

CREATE INDEX IF NOT EXISTS idx_cards_deck_review_status
    ON cards(deck_id, next_review, status);


-- ══════════════════════════════════════════════════════════════════════════════
-- 4. CREATE review_log — immutable audit trail
-- ══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS card_review_log (
    id               TEXT PRIMARY KEY,
    card_id          TEXT NOT NULL,
    quality          INTEGER NOT NULL
                    CHECK(quality IN (0, 3, 4, 5)),
    response_time_ms INTEGER,
    reviewed_at      REAL    DEFAULT (unixepoch()),

    FOREIGN KEY (card_id) REFERENCES cards(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_review_log_card
    ON card_review_log(card_id);

CREATE INDEX IF NOT EXISTS idx_review_log_date
    ON card_review_log(reviewed_at);

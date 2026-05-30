-- Genki 2.0 — Database Initialization Script
-- SRS-optimized schema: cards, decks, review_log, users

-- Users table
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    username TEXT NOT NULL,
    xp INTEGER DEFAULT 0,
    level INTEGER DEFAULT 1,
    created_at REAL DEFAULT (unixepoch())
);

-- Decks table
CREATE TABLE IF NOT EXISTS decks (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id),
    name TEXT NOT NULL,
    source_text TEXT,
    cefr_level TEXT CHECK(cefr_level IN ('A1','A2','B1','B2','C1','C2')),
    created_at REAL DEFAULT (unixepoch())
);

-- Cards table
CREATE TABLE IF NOT EXISTS cards (
    id TEXT PRIMARY KEY,
    deck_id TEXT NOT NULL REFERENCES decks(id) ON DELETE CASCADE,
    front TEXT NOT NULL,
    back TEXT NOT NULL,
    ipa TEXT,
    spanish_phonetic TEXT,
    explanation TEXT,
    category TEXT CHECK(category IN ('structure','action','concept','modifier','idiom','filler')),
    voice TEXT,
    -- SRS fields
    ef REAL DEFAULT 2.5,
    interval INTEGER DEFAULT 0,
    repetition INTEGER DEFAULT 0,
    next_review REAL DEFAULT (unixepoch()),
    status TEXT DEFAULT 'new' CHECK(status IN ('new','learning','review','mastered')),
    created_at REAL DEFAULT (unixepoch())
);

-- Card review log (analytics)
CREATE TABLE IF NOT EXISTS card_review_log (
    id TEXT PRIMARY KEY,
    card_id TEXT NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
    quality INTEGER NOT NULL CHECK(quality IN (0,3,4,5)),
    response_time_ms INTEGER,
    reviewed_at REAL DEFAULT (unixepoch())
);

-- Session history (voice practice sessions)
CREATE TABLE IF NOT EXISTS session_history (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id),
    session_id TEXT NOT NULL,
    created_at REAL DEFAULT (unixepoch()),
    ended_at REAL
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_decks_user ON decks(user_id);
CREATE INDEX IF NOT EXISTS idx_cards_deck ON cards(deck_id);
CREATE INDEX IF NOT EXISTS idx_cards_next_review ON cards(next_review);
CREATE INDEX IF NOT EXISTS idx_cards_status ON cards(status);
CREATE INDEX IF NOT EXISTS idx_cards_deck_status ON cards(deck_id, status);
CREATE INDEX IF NOT EXISTS idx_card_review_log_card ON card_review_log(card_id);
CREATE INDEX IF NOT EXISTS idx_card_review_log_reviewed_at ON card_review_log(reviewed_at);
CREATE INDEX IF NOT EXISTS idx_session_history_user ON session_history(user_id);

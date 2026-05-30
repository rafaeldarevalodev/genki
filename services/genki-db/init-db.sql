-- Genki 2.0 — Database Initialization Script
-- SQLite schema for user profiles and learning progress

-- Users table: stores user profiles and preferences
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    settings_json TEXT DEFAULT '{}',
    tts_preferences TEXT DEFAULT '{}'
);

-- Session history: tracks each learning session
CREATE TABLE IF NOT EXISTS session_history (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    session_id TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    ended_at TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Learning progress: SRS card tracking
CREATE TABLE IF NOT EXISTS learning_progress (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    deck_id TEXT NOT NULL,
    card_id TEXT NOT NULL,
    ease_factor REAL DEFAULT 2.5,
    interval_days INTEGER DEFAULT 0,
    next_review TIMESTAMP,
    repetitions INTEGER DEFAULT 0,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Deck progress: daily review statistics per deck
CREATE TABLE IF NOT EXISTS deck_progress (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    deck_id TEXT NOT NULL,
    cards_reviewed_today INTEGER DEFAULT 0,
    last_review_date DATE,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_session_history_user_id ON session_history(user_id);
CREATE INDEX IF NOT EXISTS idx_session_history_session_id ON session_history(session_id);
CREATE INDEX IF NOT EXISTS idx_learning_progress_user_id ON learning_progress(user_id);
CREATE INDEX IF NOT EXISTS idx_learning_progress_deck_id ON learning_progress(deck_id);
CREATE INDEX IF NOT EXISTS idx_learning_progress_next_review ON learning_progress(next_review);
CREATE INDEX IF NOT EXISTS idx_deck_progress_user_id ON deck_progress(user_id);
CREATE INDEX IF NOT EXISTS idx_deck_progress_deck_id ON deck_progress(deck_id);
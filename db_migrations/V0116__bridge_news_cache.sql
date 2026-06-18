CREATE TABLE IF NOT EXISTS bridge_news_cache (
    id INTEGER PRIMARY KEY DEFAULT 1,
    payload TEXT NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT bridge_news_cache_singleton CHECK (id = 1)
);
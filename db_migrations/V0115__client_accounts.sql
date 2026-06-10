CREATE TABLE IF NOT EXISTS client_accounts (
    id SERIAL PRIMARY KEY,
    phone VARCHAR(20) NOT NULL UNIQUE,
    name VARCHAR(120) DEFAULT '',
    password_hash VARCHAR(255) NOT NULL,
    token VARCHAR(64) DEFAULT '',
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_client_accounts_token ON client_accounts(token);

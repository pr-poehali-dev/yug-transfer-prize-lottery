-- Заявки клиентов с главной страницы
CREATE TABLE IF NOT EXISTS client_requests (
    id SERIAL PRIMARY KEY,
    phone VARCHAR(20) NOT NULL,
    name VARCHAR(120) DEFAULT '',
    from_city VARCHAR(200) DEFAULT '',
    to_city VARCHAR(200) DEFAULT '',
    trip_date VARCHAR(40) DEFAULT '',
    trip_time VARCHAR(20) DEFAULT '',
    people VARCHAR(20) DEFAULT '',
    comment TEXT DEFAULT '',
    status VARCHAR(30) NOT NULL DEFAULT 'new',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_client_requests_phone ON client_requests(phone);
CREATE INDEX IF NOT EXISTS idx_client_requests_status ON client_requests(status);

-- Коды подтверждения по SMS для входа в личный кабинет
CREATE TABLE IF NOT EXISTS client_auth_codes (
    id SERIAL PRIMARY KEY,
    phone VARCHAR(20) NOT NULL,
    code VARCHAR(8) NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    used BOOLEAN NOT NULL DEFAULT FALSE,
    attempts INT NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_client_auth_codes_phone ON client_auth_codes(phone);

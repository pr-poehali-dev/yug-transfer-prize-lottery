ALTER TABLE excluded_settings ADD COLUMN IF NOT EXISTS source_chat TEXT DEFAULT '';
ALTER TABLE excluded_settings ADD COLUMN IF NOT EXISTS source_msg_id BIGINT DEFAULT 0;

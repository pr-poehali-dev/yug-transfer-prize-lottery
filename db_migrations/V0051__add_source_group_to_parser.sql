ALTER TABLE ug_driver_members ADD COLUMN IF NOT EXISTS source_group VARCHAR(255) DEFAULT '@UG_DRIVER';
ALTER TABLE ug_driver_parse_runs ADD COLUMN IF NOT EXISTS source_group VARCHAR(255) DEFAULT '@UG_DRIVER';
ALTER TABLE ug_driver_parse_runs ADD COLUMN IF NOT EXISTS alphabet_pos INTEGER DEFAULT 0;
CREATE INDEX IF NOT EXISTS idx_ug_driver_members_source ON ug_driver_members(source_group);

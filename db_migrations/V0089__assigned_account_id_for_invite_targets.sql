-- Жёсткая привязка кандидата к одному аккаунту: один pending = один account.
-- Это исключает ситуацию когда 2-3 аккаунта добавляют одного и того же юзера.
ALTER TABLE t_p67171637_yug_transfer_prize_l.invite_targets
    ADD COLUMN IF NOT EXISTS assigned_account_id INTEGER;

CREATE INDEX IF NOT EXISTS idx_invite_targets_pending_assigned
    ON t_p67171637_yug_transfer_prize_l.invite_targets (assigned_account_id, status)
    WHERE status = 'pending';

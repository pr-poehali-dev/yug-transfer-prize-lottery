CREATE TABLE t_p67171637_yug_transfer_prize_l.kb_search_log (
  id serial PRIMARY KEY,
  searcher_tg_id bigint NOT NULL,
  query text NOT NULL DEFAULT '',
  kind text NOT NULL DEFAULT '',
  result text NOT NULL DEFAULT '',
  item_id integer NULL,
  found_name text NOT NULL DEFAULT '',
  found_username text NOT NULL DEFAULT '',
  found_tg_id bigint NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX kb_search_log_created_idx ON t_p67171637_yug_transfer_prize_l.kb_search_log (created_at DESC);
-- Narrow partial indexes for overlap queries on machine_status_history
-- (closed segments bounded by status_start_time; open segments by machine_id only)

CREATE INDEX IF NOT EXISTS idx_msh_machine_closed_start_overlap
  ON machine_status_history (machine_id, status_start_time)
  WHERE status_end_time IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_msh_machine_open_null_end
  ON machine_status_history (machine_id)
  WHERE status_end_time IS NULL;

ANALYZE machine_status_history;

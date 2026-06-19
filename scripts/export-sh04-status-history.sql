-- Export machine_status_history for SH-04, Ca 1 on 2026-06-12 (ICT)
-- Use with validate-sh04-speed-chart.mjs as 2nd argument after export to CSV:
--   node scripts/validate-sh04-speed-chart.mjs path/to/oee.csv path/to/status.csv

SELECT
  id,
  machine_id,
  status,
  status_start_time,
  status_end_time,
  production_order_id,
  created_at
FROM machine_status_history
WHERE machine_id = 'SH-04'
  AND status_start_time >= TIMESTAMPTZ '2026-06-12 06:00:00+07'
  AND status_start_time <  TIMESTAMPTZ '2026-06-12 14:00:00+07'
ORDER BY status_start_time ASC;

-- Audit zero-speed downtime segments (same rule as Speed Lab: actual_speed = 0).
-- Replace machine_id and time window below, then run in psql.
--
-- Example (LHT-1 = machine id D-02, production day 06/05/2026 ICT):
--   machine_id = 'D-02'
--   day 06:00 ICT = 2026-05-05 23:00:00 UTC … 2026-05-06 23:00:00 UTC

WITH params AS (
  SELECT
    'D-02'::varchar AS machine_id,
    TIMESTAMPTZ '2026-05-05 23:00:00+00' AS range_start,
    TIMESTAMPTZ '2026-05-06 23:00:00+00' AS range_end,
    60::int AS min_stop_sec
),
ordered AS (
  SELECT
    o.machine_id,
    o.calculation_timestamp AS ts,
    o.actual_speed,
    CASE
      WHEN o.actual_speed = 0
       AND LAG(o.actual_speed) OVER (PARTITION BY o.machine_id ORDER BY o.calculation_timestamp)
           IS DISTINCT FROM 0
      THEN 1
      ELSE 0
    END AS new_stop
  FROM oee_calculations o
  CROSS JOIN params p
  WHERE o.machine_id = p.machine_id
    AND o.calculation_timestamp >= p.range_start
    AND o.calculation_timestamp < p.range_end
),
stopped AS (
  SELECT
    machine_id,
    ts,
    SUM(new_stop) OVER (PARTITION BY machine_id ORDER BY ts) AS stop_id
  FROM ordered
  WHERE actual_speed = 0
),
segments AS (
  SELECT
    machine_id,
    stop_id,
    MIN(ts) AS start_ts,
    MAX(ts) AS end_ts,
    COUNT(*)::int AS zero_samples,
    EXTRACT(EPOCH FROM (MAX(ts) - MIN(ts)))::int AS duration_sec
  FROM stopped
  GROUP BY machine_id, stop_id
)
SELECT
  s.start_ts AT TIME ZONE 'Asia/Ho_Chi_Minh' AS start_ict,
  s.end_ts AT TIME ZONE 'Asia/Ho_Chi_Minh' AS end_ict,
  s.duration_sec,
  ROUND(s.duration_sec / 60.0, 1) AS duration_min,
  s.zero_samples,
  p.min_stop_sec AS threshold_sec
FROM segments s
CROSS JOIN params p
WHERE s.duration_sec >= p.min_stop_sec
ORDER BY s.start_ts;

-- Compare thresholds on same window:
-- SELECT
--   COUNT(*) FILTER (WHERE duration_sec >= 60)  AS stops_ge_1min,
--   COUNT(*) FILTER (WHERE duration_sec >= 120) AS stops_ge_2min,
--   COUNT(*) FILTER (WHERE duration_sec >= 60 AND duration_sec < 120) AS only_1_to_2_min
-- FROM segments;

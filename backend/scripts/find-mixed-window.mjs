import { query } from '../database/connection.js';

const machineId = process.argv[2] || 'A-01';
const r = await query(`
  WITH seg AS (
    SELECT status, status_start_time,
      EXTRACT(EPOCH FROM (
        LEAST(COALESCE(status_end_time, status_start_time + interval '2 hours'), status_start_time + interval '2 hours')
        - status_start_time
      )) as dur
    FROM machine_status_history
    WHERE machine_id = $1
  )
  SELECT status_start_time::date as d,
    SUM(CASE WHEN status='running' THEN dur ELSE 0 END) as run_sec,
    SUM(CASE WHEN status!='running' THEN dur ELSE 0 END) as down_sec,
    COUNT(*) as cnt
  FROM machine_status_history h
  JOIN seg ON seg.status_start_time = h.status_start_time
  WHERE h.machine_id = $1
  GROUP BY 1
  HAVING SUM(CASE WHEN status='running' THEN 1 ELSE 0 END) > 0
     AND SUM(CASE WHEN status!='running' THEN 1 ELSE 0 END) > 0
  ORDER BY cnt DESC
  LIMIT 5
`, [machineId]);

// simpler: sliding 8h windows
const r2 = await query(`
  SELECT w.window_start,
    SUM(CASE WHEN h.status='running' THEN EXTRACT(EPOCH FROM (
      LEAST(COALESCE(h.status_end_time, w.window_end), w.window_end)
      - GREATEST(h.status_start_time, w.window_start)
    )) ELSE 0 END) as run_sec,
    SUM(CASE WHEN h.status!='running' THEN EXTRACT(EPOCH FROM (
      LEAST(COALESCE(h.status_end_time, w.window_end), w.window_end)
      - GREATEST(h.status_start_time, w.window_start)
    )) ELSE 0 END) as down_sec
  FROM (
    SELECT status_start_time as window_start, status_start_time + interval '8 hours' as window_end
    FROM machine_status_history
    WHERE machine_id = $1
    ORDER BY status_start_time
    LIMIT 200
  ) w
  JOIN machine_status_history h ON h.machine_id = $1
    AND h.status_start_time < w.window_end
    AND (h.status_end_time IS NULL OR h.status_end_time > w.window_start)
  GROUP BY w.window_start
  HAVING SUM(CASE WHEN h.status='running' THEN 1 ELSE 0 END) > 0
     AND SUM(CASE WHEN h.status!='running' THEN 1 ELSE 0 END) > 0
  ORDER BY down_sec DESC
  LIMIT 5
`, [machineId]);

console.log(JSON.stringify({ byDay: r.rows, windows: r2.rows }, null, 2));
process.exit(0);

import { query } from '../database/connection.js';

const machineId = process.argv[2] || 'A-01';
const r = await query(`
  SELECT date_trunc('day', status_start_time) as day,
    status,
    COUNT(*) as cnt,
    ROUND(SUM(EXTRACT(EPOCH FROM (
      LEAST(COALESCE(status_end_time, status_start_time + interval '1 hour'), status_start_time + interval '1 day')
      - status_start_time
    )))) as sec
  FROM machine_status_history
  WHERE machine_id = $1
  GROUP BY 1, 2
  HAVING COUNT(*) > 3
  ORDER BY day DESC, sec DESC
  LIMIT 30
`, [machineId]);
console.log(JSON.stringify(r.rows, null, 2));
process.exit(0);

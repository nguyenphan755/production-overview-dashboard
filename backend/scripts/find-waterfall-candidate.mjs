import { query } from '../database/connection.js';

const r = await query(`
  SELECT m.id, m.name, m.area, po.id as order_id, po.status as order_status,
    po.start_time, po.end_time,
    ROUND(EXTRACT(EPOCH FROM (COALESCE(po.end_time, NOW()) - po.start_time))/60) as pot_min,
    (SELECT COUNT(*) FROM machine_status_history h
     WHERE h.machine_id = m.id
       AND h.status_start_time < COALESCE(po.end_time, NOW())
       AND (h.status_end_time IS NULL OR h.status_end_time > po.start_time)) as seg_cnt,
    (SELECT COUNT(DISTINCT h.status) FROM machine_status_history h
     WHERE h.machine_id = m.id
       AND h.status_start_time < COALESCE(po.end_time, NOW())
       AND (h.status_end_time IS NULL OR h.status_end_time > po.start_time)) as status_types
  FROM machines m
  JOIN production_orders po ON po.machine_id = m.id
  WHERE EXISTS (SELECT 1 FROM machine_status_history h2 WHERE h2.machine_id = m.id)
  ORDER BY seg_cnt DESC
  LIMIT 15
`);
console.log(JSON.stringify(r.rows, null, 2));
process.exit(0);

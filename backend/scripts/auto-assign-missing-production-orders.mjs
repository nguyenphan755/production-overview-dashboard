import { query } from '../database/connection.js';

const sql = `
WITH missing AS (
  SELECT
    m.id,
    m.name,
    m.status,
    COALESCE(NULLIF(TRIM(m.product_name), ''), 'UNKNOWN_PRODUCT') AS product_name,
    COALESCE(m.produced_length, 0) AS produced_length,
    COALESCE(m.target_length, 0) AS target_length
  FROM machines m
  WHERE m.production_order_id IS NULL
     OR m.production_order_name IS NULL
),
ins AS (
  INSERT INTO production_orders (
    id, name, product_name, product_name_current, customer,
    machine_id, machine_name, start_time, end_time,
    produced_length, target_length, status, duration
  )
  SELECT
    'PO-AUTO-' || missing.id || '-' || to_char(NOW(), 'YYYYMMDDHH24MISS'),
    'PO-AUTO-' || missing.id || '-' || to_char(NOW(), 'YYYYMMDDHH24MISS'),
    missing.product_name,
    missing.product_name,
    'AUTO',
    missing.id,
    missing.name,
    NOW(),
    NULL,
    missing.produced_length,
    missing.target_length,
    CASE WHEN missing.status = 'running' THEN 'running' ELSE 'interrupted' END::order_status,
    NULL
  FROM missing
  WHERE NOT EXISTS (
    SELECT 1
    FROM production_orders p
    WHERE p.machine_id = missing.id
  )
  RETURNING id, name, machine_id
),
latest_po AS (
  SELECT DISTINCT ON (p.machine_id)
    p.machine_id, p.id, p.name
  FROM production_orders p
  JOIN missing m ON m.id = p.machine_id
  ORDER BY p.machine_id, p.start_time DESC
)
UPDATE machines m
SET
  production_order_id = lp.id,
  production_order_name = lp.name,
  updated_at = CURRENT_TIMESTAMP
FROM latest_po lp
WHERE m.id = lp.machine_id
RETURNING m.id, m.name, m.status, m.production_order_id, m.production_order_name;
`;

const updated = await query(sql);

const summary = await query(`
  SELECT
    COUNT(1)::int AS total_missing_after
  FROM machines
  WHERE production_order_id IS NULL OR production_order_name IS NULL
`);

console.log(
  JSON.stringify(
    {
      updatedCount: updated.rows.length,
      updatedMachines: updated.rows,
      missingAfter: summary.rows[0]?.total_missing_after ?? null,
    },
    null,
    2
  )
);


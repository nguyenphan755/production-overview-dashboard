import { query } from '../../database/connection.js';

function mapRow(row) {
  return {
    id: row.id,
    orderId: row.order_id,
    sequence: Number(row.sequence),
    cutLengthM: parseFloat(row.cut_length_ok_m || 0),
    recordedAt: new Date(row.recorded_at).toISOString(),
    bobbinCountPlanned:
      row.bobbin_count_planned !== null && row.bobbin_count_planned !== undefined
        ? Number(row.bobbin_count_planned)
        : undefined,
  };
}

export async function insertBobbinCuts(cuts) {
  if (!cuts?.length) {
    return { inserted: 0, received: 0 };
  }

  const values = [];
  const placeholders = cuts
    .map((cut, i) => {
      const base = i * 19;
      values.push(
        cut.id,
        cut.machineId,
        cut.machineName ?? null,
        cut.area ?? null,
        cut.orderId,
        cut.orderName ?? null,
        cut.sequence ?? 1,
        cut.qcStatus ?? 'ok',
        cut.triggerType ?? 'reset',
        cut.machineStatus ?? null,
        cut.cutLengthOkM ?? cut.cutLengthM ?? 0,
        cut.producedLengthOkAtCut ?? null,
        cut.producedLengthTotalAtCut ?? null,
        cut.lineSpeedAtCut ?? null,
        cut.targetLengthOrder ?? null,
        cut.bobbinCountPlanned ?? null,
        cut.metadata ? JSON.stringify(cut.metadata) : null,
        cut.recordedAt ? new Date(cut.recordedAt) : new Date(),
        cut.recordedAt ? new Date(cut.recordedAt) : new Date()
      );

      return `(
        $${base + 1},$${base + 2},$${base + 3},$${base + 4},$${base + 5},$${base + 6},
        $${base + 7},$${base + 8},$${base + 9},$${base + 10},$${base + 11},$${base + 12},
        $${base + 13},$${base + 14},$${base + 15},$${base + 16},$${base + 17},$${base + 18},$${base + 19}
      )`;
    })
    .join(',');

  const sql = `
    INSERT INTO bobbin_cut_records (
      id, machine_id, machine_name, area, order_id, order_name, sequence,
      qc_status, trigger_type, machine_status, cut_length_ok_m,
      produced_length_ok_at_cut, produced_length_total_at_cut, line_speed_at_cut,
      target_length_order, bobbin_count_planned, metadata, recorded_at, created_at
    )
    VALUES ${placeholders}
    ON CONFLICT (id) DO NOTHING
  `;

  const result = await query(sql, values);
  return { inserted: result.rowCount ?? 0, received: cuts.length };
}

export async function getBobbinCutsByMachine(machineId, { orderId, from, to, limit = 500 } = {}) {
  const clauses = ['machine_id = $1'];
  const params = [machineId];

  if (orderId) {
    params.push(orderId);
    clauses.push(`order_id = $${params.length}`);
  }
  if (from) {
    params.push(from);
    clauses.push(`recorded_at >= $${params.length}`);
  }
  if (to) {
    params.push(to);
    clauses.push(`recorded_at < $${params.length}`);
  }

  params.push(limit);
  const sql = `
    SELECT id, order_id, sequence, cut_length_ok_m, bobbin_count_planned, recorded_at
    FROM bobbin_cut_records
    WHERE ${clauses.join(' AND ')}
    ORDER BY recorded_at DESC
    LIMIT $${params.length}
  `;

  const result = await query(sql, params);
  return result.rows.map(mapRow);
}

export function groupCutsByOrderId(rows) {
  const byOrder = {};
  for (const row of rows) {
    const mapped = mapRow(row);
    if (!byOrder[mapped.orderId]) byOrder[mapped.orderId] = [];
    byOrder[mapped.orderId].push(mapped);
  }
  for (const orderId of Object.keys(byOrder)) {
    byOrder[orderId].sort(
      (a, b) => new Date(b.recordedAt).getTime() - new Date(a.recordedAt).getTime()
    );
  }
  return byOrder;
}

export async function getBobbinCutsGroupedByOrder(machineId) {
  const result = await query(
    `SELECT id, order_id, sequence, cut_length_ok_m, bobbin_count_planned, recorded_at
     FROM bobbin_cut_records
     WHERE machine_id = $1
     ORDER BY recorded_at DESC`,
    [machineId]
  );
  return groupCutsByOrderId(result.rows);
}

import express from 'express';
import { query } from '../database/connection.js';

const router = express.Router();

// POST /api/bobbin-cuts/sync
// Accepts either a single bobbin cut record or an array.
router.post('/sync', async (req, res) => {
  try {
    const body = req.body;
    const cuts = Array.isArray(body) ? body : body?.cuts ? body.cuts : [body];

    if (!Array.isArray(cuts) || cuts.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No bobbin cuts provided',
      });
    }

    const values = [];
    const placeholders = cuts
      .map((cut, i) => {
        const base = i * 19;
        values.push(
          cut.id,
          cut.machineId,
          cut.machineName,
          cut.area,
          cut.orderId,
          cut.orderName,
          cut.sequence,
          cut.qcStatus,
          cut.triggerType ?? 'reset',
          cut.machineStatus ?? null,
          cut.cutLengthOkM,
          cut.producedLengthOkAtCut ?? null,
          cut.producedLengthTotalAtCut ?? null,
          cut.lineSpeedAtCut ?? null,
          cut.targetLengthOrder ?? null,
          cut.bobbinCountPlanned ?? null,
          cut.metadata ? JSON.stringify(cut.metadata) : null,
          cut.recordedAt ? new Date(cut.recordedAt) : new Date(),
          cut.recordedAt ? new Date(cut.recordedAt) : new Date()
        );

        // columns:
        // id,machine_id,machine_name,area,order_id,order_name,sequence,qc_status,trigger_type,machine_status,
        // cut_length_ok_m,produced_length_ok_at_cut,produced_length_total_at_cut,line_speed_at_cut,target_length_order,
        // bobbin_count_planned,metadata,recorded_at,created_at
        return `(
          $${base + 1},$${base + 2},$${base + 3},$${base + 4},$${base + 5},$${base + 6},
          $${base + 7},$${base + 8},$${base + 9},$${base + 10},$${base + 11},$${base + 12},
          $${base + 13},$${base + 14},$${base + 15},$${base + 16},$${base + 17},$${base + 18},$${base + 19}
        )`;
      })
      .join(',');

    const sql = `
      INSERT INTO bobbin_cut_records (
        id,
        machine_id,
        machine_name,
        area,
        order_id,
        order_name,
        sequence,
        qc_status,
        trigger_type,
        machine_status,
        cut_length_ok_m,
        produced_length_ok_at_cut,
        produced_length_total_at_cut,
        line_speed_at_cut,
        target_length_order,
        bobbin_count_planned,
        metadata,
        recorded_at,
        created_at
      )
      VALUES ${placeholders}
      ON CONFLICT DO NOTHING
    `;

    const result = await query(sql, values);
    return res.json({
      success: true,
      inserted: result.rowCount,
      cutsReceived: cuts.length,
    });
  } catch (error) {
    console.error('Error syncing bobbin cuts:', error);
    return res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;


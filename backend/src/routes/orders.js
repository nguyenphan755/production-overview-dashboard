import express from 'express';
import { query, withClient } from '../../database/connection.js';
import {
  buildTelemetryRowAfterApiUpdate,
  hasMachineTelemetrySnapshotChanged,
  recordEnergyTelemetryAndAggregate,
  telemetryApiShouldSkipUnchanged,
} from '../services/machineLineTelemetry.js';

const router = express.Router();

/** Prefer live current name, then order snapshot — matches Schedule / Equipment display. */
function effectiveProductNameFromOrderRow(orderRow) {
  const cur = orderRow.product_name_current;
  const snap = orderRow.product_name;
  if (cur != null && String(cur).trim() !== '') return String(cur).trim();
  if (snap != null && String(snap).trim() !== '') return String(snap).trim();
  return null;
}

/**
 * machine_line_telemetry is written from machine PATCH/PUT and the interval sampler.
 * Editing only production_orders left machines.product_name stale and skipped telemetry.
 */
async function syncMachineProductAndTelemetryFromOrder(orderRow, bodyUpdates) {
  if (!bodyUpdates || typeof bodyUpdates !== 'object') return;
  if (!('productName' in bodyUpdates) && !('productNameCurrent' in bodyUpdates)) return;

  const machineId = orderRow.machine_id;
  if (!machineId) return;

  const effectiveName = effectiveProductNameFromOrderRow(orderRow);

  try {
    await withClient(async (client) => {
      await client.query('BEGIN');
      const lock = await client.query(
        `SELECT * FROM machines WHERE id = $1 FOR UPDATE`,
        [machineId]
      );
      if (lock.rows.length === 0) {
        await client.query('ROLLBACK');
        return;
      }
      const machineRow = lock.rows[0];
      if (String(machineRow.production_order_id || '') !== String(orderRow.id)) {
        await client.query('ROLLBACK');
        return;
      }

      const prevNorm =
        machineRow.product_name == null || String(machineRow.product_name).trim() === ''
          ? null
          : String(machineRow.product_name).trim();
      if (prevNorm === effectiveName) {
        await client.query('ROLLBACK');
        return;
      }

      await client.query(
        `UPDATE machines SET product_name = $1, last_updated = CURRENT_TIMESTAMP WHERE id = $2`,
        [effectiveName, machineId]
      );
      const nextRes = await client.query(`SELECT * FROM machines WHERE id = $1`, [machineId]);
      const nextRow = nextRes.rows[0];
      const telemetryNextRow = buildTelemetryRowAfterApiUpdate(nextRow, null);
      const skipUnchanged = telemetryApiShouldSkipUnchanged();
      if (!skipUnchanged || hasMachineTelemetrySnapshotChanged(machineRow, telemetryNextRow)) {
        await recordEnergyTelemetryAndAggregate(
          client,
          machineId,
          machineRow,
          telemetryNextRow,
          'PATCH /orders/:orderId'
        );
      }
      await client.query('COMMIT');
    });
  } catch (err) {
    console.error(
      '[PATCH /orders/:orderId] sync machine product / machine_line_telemetry:',
      err.message || err
    );
  }
}

// GET /api/orders
router.get('/', async (req, res) => {
  try {
    const ordersResult = await query(
      `SELECT * FROM production_orders 
       ORDER BY start_time DESC`
    );

    const orders = ordersResult.rows.map((order) => ({
      id: order.id,
      name: order.name,
      productName: order.product_name,
      productNameCurrent: order.product_name_current,
      customer: order.customer,
      machineName: order.machine_name,
      machineId: order.machine_id,
      startTime: new Date(order.start_time).toISOString(),
      endTime: order.end_time ? new Date(order.end_time).toISOString() : undefined,
      producedLength: parseFloat(order.produced_length || 0),
      producedLengthOk:
        order.produced_length_ok !== undefined && order.produced_length_ok !== null
          ? parseFloat(order.produced_length_ok)
          : undefined,
      targetLength: parseFloat(order.target_length || 0),
      status: order.status,
      duration: order.duration,
    }));

    res.json({
      data: orders,
      timestamp: new Date().toISOString(),
      success: true,
    });
  } catch (error) {
    console.error('Error fetching orders:', error);
    res.status(500).json({
      data: null,
      timestamp: new Date().toISOString(),
      success: false,
      message: error.message,
    });
  }
});

// GET /api/orders/:orderId
router.get('/:orderId', async (req, res) => {
  try {
    const { orderId } = req.params;

    const orderResult = await query(
      `SELECT * FROM production_orders WHERE id = $1`,
      [orderId]
    );

    if (orderResult.rows.length === 0) {
      return res.status(404).json({
        data: null,
        timestamp: new Date().toISOString(),
        success: false,
        message: 'Order not found',
      });
    }

    const order = orderResult.rows[0];
    const formattedOrder = {
      id: order.id,
      name: order.name,
      productName: order.product_name,
      productNameCurrent: order.product_name_current,
      customer: order.customer,
      machineName: order.machine_name,
      machineId: order.machine_id,
      startTime: new Date(order.start_time).toISOString(),
      endTime: order.end_time ? new Date(order.end_time).toISOString() : undefined,
      producedLength: parseFloat(order.produced_length || 0),
      producedLengthOk:
        order.produced_length_ok !== undefined && order.produced_length_ok !== null
          ? parseFloat(order.produced_length_ok)
          : undefined,
      targetLength: parseFloat(order.target_length || 0),
      status: order.status,
      duration: order.duration,
    };

    res.json({
      data: formattedOrder,
      timestamp: new Date().toISOString(),
      success: true,
    });
  } catch (error) {
    console.error('Error fetching order:', error);
    res.status(500).json({
      data: null,
      timestamp: new Date().toISOString(),
      success: false,
      message: error.message,
    });
  }
});

// PATCH /api/orders/:orderId - Update production order
router.patch('/:orderId', async (req, res) => {
  try {
    const { orderId } = req.params;
    const updates = req.body;

    // Build dynamic UPDATE query
    const fields = [];
    const values = [];
    let paramIndex = 1;

    const fieldMapping = {
      productName: 'product_name',
      productNameCurrent: 'product_name_current',
      customer: 'customer',
      machineId: 'machine_id',
      machineName: 'machine_name',
      startTime: 'start_time',
      endTime: 'end_time',
      producedLength: 'produced_length',
      producedLengthOk: 'produced_length_ok',
      targetLength: 'target_length',
      status: 'status',
      duration: 'duration',
    };

    for (const [key, value] of Object.entries(updates)) {
      if (fieldMapping[key] && value !== undefined) {
        fields.push(`${fieldMapping[key]} = $${paramIndex}`);
        if (key === 'startTime' || key === 'endTime') {
          values.push(new Date(value));
        } else {
          values.push(value);
        }
        paramIndex++;
      }
    }

    if (fields.length === 0) {
      return res.status(400).json({
        data: null,
        timestamp: new Date().toISOString(),
        success: false,
        message: 'No valid fields to update',
      });
    }

    fields.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(orderId);

    const updateQuery = `
      UPDATE production_orders 
      SET ${fields.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING *
    `;

    const result = await query(updateQuery, values);

    if (result.rows.length === 0) {
      return res.status(404).json({
        data: null,
        timestamp: new Date().toISOString(),
        success: false,
        message: 'Order not found',
      });
    }

    const order = result.rows[0];
    const formattedOrder = {
      id: order.id,
      name: order.name,
      productName: order.product_name,
      productNameCurrent: order.product_name_current,
      customer: order.customer,
      machineName: order.machine_name,
      machineId: order.machine_id,
      startTime: new Date(order.start_time).toISOString(),
      endTime: order.end_time ? new Date(order.end_time).toISOString() : undefined,
      producedLength: parseFloat(order.produced_length || 0),
      producedLengthOk:
        order.produced_length_ok !== undefined && order.produced_length_ok !== null
          ? parseFloat(order.produced_length_ok)
          : undefined,
      targetLength: parseFloat(order.target_length || 0),
      status: order.status,
      duration: order.duration,
    };

    await syncMachineProductAndTelemetryFromOrder(order, updates);

    res.json({
      data: formattedOrder,
      timestamp: new Date().toISOString(),
      success: true,
    });
  } catch (error) {
    console.error('Error updating order:', error);
    res.status(500).json({
      data: null,
      timestamp: new Date().toISOString(),
      success: false,
      message: error.message,
    });
  }
});

export default router;


import express from 'express';
import { query } from '../database/connection.js';

const router = express.Router();

// GET /api/kpis/global
router.get('/global', async (req, res) => {
  try {
    // Get total machines and running machines
    const machinesResult = await query(`
      SELECT 
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE status = 'running') as running,
        COALESCE(SUM(produced_length), 0) as output,
        COALESCE(SUM(power), 0) / 1000.0 as energy
      FROM machines
    `);

    // Get active orders count
    const ordersResult = await query(`
      SELECT COUNT(*) as orders
      FROM production_orders
      WHERE status = 'running'
    `);

    // Get active alarms count
    const alarmsResult = await query(`
      SELECT COUNT(*) as alarms
      FROM alarms
      WHERE acknowledged = FALSE
    `);

    const machines = machinesResult.rows[0];
    const orders = ordersResult.rows[0];
    const alarms = alarmsResult.rows[0];

    const kpis = {
      running: parseInt(machines.running) || 0,
      total: parseInt(machines.total) || 0,
      output: parseFloat(machines.output) || 0,
      orders: parseInt(orders.orders) || 0,
      alarms: parseInt(alarms.alarms) || 0,
      energy: parseFloat(machines.energy) || 0,
    };

    res.json({
      data: kpis,
      timestamp: new Date().toISOString(),
      success: true,
    });
  } catch (error) {
    console.error('Error fetching global KPIs:', error);
    res.status(500).json({
      data: null,
      timestamp: new Date().toISOString(),
      success: false,
      message: error.message,
    });
  }
});

export default router;


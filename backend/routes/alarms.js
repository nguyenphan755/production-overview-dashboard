import express from 'express';
import { query } from '../database/connection.js';

const router = express.Router();

// GET /api/alarms
router.get('/', async (req, res) => {
  try {
    const { machineId, acknowledged } = req.query;
    
    let alarmsResult;
    if (machineId) {
      if (acknowledged !== undefined) {
        alarmsResult = await query(
          `SELECT * FROM alarms 
           WHERE machine_id = $1 AND acknowledged = $2
           ORDER BY timestamp DESC`,
          [machineId, acknowledged === 'true']
        );
      } else {
        alarmsResult = await query(
          `SELECT * FROM alarms 
           WHERE machine_id = $1
           ORDER BY timestamp DESC`,
          [machineId]
        );
      }
    } else {
      alarmsResult = await query(
        `SELECT * FROM alarms 
         ORDER BY timestamp DESC
         LIMIT 100`
      );
    }

    const alarms = alarmsResult.rows.map((alarm) => ({
      id: alarm.id,
      machineId: alarm.machine_id,
      severity: alarm.severity,
      message: alarm.message,
      timestamp: new Date(alarm.timestamp).toISOString(),
      acknowledged: alarm.acknowledged,
    }));

    res.json({
      data: alarms,
      timestamp: new Date().toISOString(),
      success: true,
    });
  } catch (error) {
    console.error('Error fetching alarms:', error);
    res.status(500).json({
      data: null,
      timestamp: new Date().toISOString(),
      success: false,
      message: error.message,
    });
  }
});

// PATCH /api/alarms/:alarmId - Acknowledge alarm
router.patch('/:alarmId', async (req, res) => {
  try {
    const { alarmId } = req.params;
    const { acknowledged } = req.body;

    const result = await query(
      `UPDATE alarms 
       SET acknowledged = $1
       WHERE id = $2
       RETURNING *`,
      [acknowledged !== undefined ? acknowledged : true, alarmId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        data: null,
        timestamp: new Date().toISOString(),
        success: false,
        message: 'Alarm not found',
      });
    }

    const alarm = result.rows[0];
    res.json({
      data: {
        id: alarm.id,
        machineId: alarm.machine_id,
        severity: alarm.severity,
        message: alarm.message,
        timestamp: new Date(alarm.timestamp).toISOString(),
        acknowledged: alarm.acknowledged,
      },
      timestamp: new Date().toISOString(),
      success: true,
    });
  } catch (error) {
    console.error('Error updating alarm:', error);
    res.status(500).json({
      data: null,
      timestamp: new Date().toISOString(),
      success: false,
      message: error.message,
    });
  }
});

export default router;


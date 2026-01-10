import express from 'express';
import { query } from '../database/connection.js';

const router = express.Router();

const areaNames = {
  drawing: { name: 'KÉO', nameEn: 'DRAWING' },
  stranding: { name: 'XOẮN', nameEn: 'STRANDING' },
  armoring: { name: 'GIÁP', nameEn: 'ARMORING' },
  sheathing: { name: 'BỌC', nameEn: 'SHEATHING' },
};

// GET /api/areas
router.get('/', async (req, res) => {
  try {
    const areas = ['drawing', 'stranding', 'armoring', 'sheathing'];
    const areaSummaries = [];

    for (const areaId of areas) {
      // Get machines in this area
      const machinesResult = await query(
        `SELECT * FROM machines WHERE area = $1`,
        [areaId]
      );

      const machines = machinesResult.rows;
      const running = machines.filter((m) => m.status === 'running').length;
      const total = machines.length;
      const output = machines.reduce((sum, m) => sum + parseFloat(m.produced_length || 0), 0);
      
      // Calculate average speed for running machines
      const runningMachines = machines.filter((m) => m.status === 'running');
      const speedAvg = runningMachines.length > 0
        ? runningMachines.reduce((sum, m) => sum + parseFloat(m.line_speed || 0), 0) / runningMachines.length
        : 0;

      // Get alarms count
      const alarmsResult = await query(
        `SELECT COUNT(*) as count FROM alarms 
         WHERE machine_id IN (SELECT id FROM machines WHERE area = $1) 
         AND acknowledged = FALSE`,
        [areaId]
      );
      const alarms = parseInt(alarmsResult.rows[0].count) || 0;

      // Get all machines sorted by ID (for consistent display)
      const allMachines = machines
        .sort((a, b) => a.id.localeCompare(b.id))
        .map((m) => ({
          id: m.id,
          name: m.name || m.id, // Use machine name, fallback to ID if name is missing
          speed: m.status === 'stopped' || m.status === 'error' ? 0 : parseFloat(m.line_speed || 0),
          status: m.status,
        }));
      
      // Keep topMachines for backward compatibility (top 3 running machines)
      const topMachines = machines
        .filter((m) => m.status === 'running')
        .sort((a, b) => parseFloat(b.line_speed || 0) - parseFloat(a.line_speed || 0))
        .slice(0, 3)
        .map((m) => ({
          id: m.id,
          name: m.name || m.id, // Use machine name, fallback to ID if name is missing
          speed: parseFloat(m.line_speed || 0),
          status: m.status,
        }));

      // Get sparkline data (last 10 minutes of speed data)
      const sparklineResult = await query(
        `SELECT value FROM machine_metrics 
         WHERE machine_id IN (SELECT id FROM machines WHERE area = $1)
         AND metric_type = 'speed'
         AND timestamp >= NOW() - INTERVAL '10 minutes'
         ORDER BY timestamp DESC
         LIMIT 10`,
        [areaId]
      );

      const sparklineData = sparklineResult.rows.length > 0
        ? sparklineResult.rows.map((r) => parseFloat(r.value || 0)).reverse()
        : Array(10).fill(speedAvg);

      areaSummaries.push({
        id: areaId,
        name: areaNames[areaId].name,
        nameEn: areaNames[areaId].nameEn,
        running,
        total,
        output: Math.round(output),
        speedAvg: Math.round(speedAvg),
        alarms,
        topMachines,
        allMachines, // All machines in the area
        sparklineData: sparklineData.length > 0 ? sparklineData : Array(10).fill(0),
      });
    }

    res.json({
      data: areaSummaries,
      timestamp: new Date().toISOString(),
      success: true,
    });
  } catch (error) {
    console.error('Error fetching areas:', error);
    res.status(500).json({
      data: null,
      timestamp: new Date().toISOString(),
      success: false,
      message: error.message,
    });
  }
});

// GET /api/areas/:areaId
router.get('/:areaId', async (req, res) => {
  try {
    const { areaId } = req.params;

    // Similar logic as above but for single area
    const machinesResult = await query(
      `SELECT * FROM machines WHERE area = $1`,
      [areaId]
    );

    const machines = machinesResult.rows;
    const running = machines.filter((m) => m.status === 'running').length;
    const total = machines.length;
    const output = machines.reduce((sum, m) => sum + parseFloat(m.produced_length || 0), 0);
    
    const runningMachines = machines.filter((m) => m.status === 'running');
    const speedAvg = runningMachines.length > 0
      ? runningMachines.reduce((sum, m) => sum + parseFloat(m.line_speed || 0), 0) / runningMachines.length
      : 0;

    const alarmsResult = await query(
      `SELECT COUNT(*) as count FROM alarms 
       WHERE machine_id IN (SELECT id FROM machines WHERE area = $1) 
       AND acknowledged = FALSE`,
      [areaId]
    );
    const alarms = parseInt(alarmsResult.rows[0].count) || 0;

    // Get all machines sorted by ID (for consistent display)
    const allMachines = machines
      .sort((a, b) => a.id.localeCompare(b.id))
      .map((m) => ({
        id: m.id,
        name: m.name || m.id, // Use machine name, fallback to ID if name is missing
        speed: m.status === 'stopped' || m.status === 'error' ? 0 : parseFloat(m.line_speed || 0),
        status: m.status,
      }));
    
    // Keep topMachines for backward compatibility (top 3 running machines)
    const topMachines = machines
      .filter((m) => m.status === 'running')
      .sort((a, b) => parseFloat(b.line_speed || 0) - parseFloat(a.line_speed || 0))
      .slice(0, 3)
      .map((m) => ({
        id: m.id,
        name: m.name || m.id, // Use machine name, fallback to ID if name is missing
        speed: parseFloat(m.line_speed || 0),
        status: m.status,
      }));

    const sparklineResult = await query(
      `SELECT value FROM machine_metrics 
       WHERE machine_id IN (SELECT id FROM machines WHERE area = $1)
       AND metric_type = 'speed'
       AND timestamp >= NOW() - INTERVAL '10 minutes'
       ORDER BY timestamp DESC
       LIMIT 10`,
      [areaId]
    );

    const sparklineData = sparklineResult.rows.length > 0
      ? sparklineResult.rows.map((r) => parseFloat(r.value || 0)).reverse()
      : Array(10).fill(speedAvg);

    const areaSummary = {
      id: areaId,
      name: areaNames[areaId]?.name || areaId,
      nameEn: areaNames[areaId]?.nameEn || areaId.toUpperCase(),
      running,
      total,
      output: Math.round(output),
      speedAvg: Math.round(speedAvg),
      alarms,
      topMachines,
      allMachines, // All machines in the area
      sparklineData: sparklineData.length > 0 ? sparklineData : Array(10).fill(0),
    };

    res.json({
      data: areaSummary,
      timestamp: new Date().toISOString(),
      success: true,
    });
  } catch (error) {
    console.error('Error fetching area:', error);
    res.status(500).json({
      data: null,
      timestamp: new Date().toISOString(),
      success: false,
      message: error.message,
    });
  }
});

export default router;


/**
 * Availability Synchronization API Routes
 * 
 * Provides endpoints for managing availability aggregation synchronization
 * across all production lines
 */

import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import {
  syncAllMachinesAvailability,
  syncAreaAvailability,
  getSyncStatus,
  startContinuousSync
} from '../services/availabilitySync.js';

const router = express.Router();

/**
 * GET /api/availability/sync/status
 * Get synchronization status for all machines
 */
router.get('/sync/status', async (req, res) => {
  try {
    const status = await getSyncStatus();
    
    res.json({
      data: status,
      timestamp: new Date().toISOString(),
      success: true,
    });
  } catch (error) {
    console.error('Error getting sync status:', error);
    res.status(500).json({
      data: null,
      timestamp: new Date().toISOString(),
      success: false,
      message: error.message,
    });
  }
});

/**
 * POST /api/availability/sync/all
 * Manually trigger synchronization for all machines
 * Synchronizes all related machine and production data
 */
router.post('/sync/all', authenticateToken, async (req, res) => {
  try {
    const { windowMinutes, retryFailed } = req.body;
    const windowSize = windowMinutes || 10;
    const shouldRetry = retryFailed !== undefined ? retryFailed : true;
    
    console.log(`🔄 Manual sync triggered for all machines (window: ${windowSize}min, retry: ${shouldRetry})`);
    
    const result = await syncAllMachinesAvailability(windowSize, shouldRetry);
    
    res.json({
      data: result,
      timestamp: new Date().toISOString(),
      success: result.success,
      message: `Synchronized ${result.syncedMachines}/${result.totalMachines} machines`
    });
  } catch (error) {
    console.error('Error syncing all machines:', error);
    res.status(500).json({
      data: null,
      timestamp: new Date().toISOString(),
      success: false,
      message: error.message,
    });
  }
});

/**
 * POST /api/availability/sync/area/:area
 * Manually trigger synchronization for machines in a specific area
 */
router.post('/sync/area/:area', authenticateToken, async (req, res) => {
  try {
    const { area } = req.params;
    const { windowMinutes } = req.body;
    const windowSize = windowMinutes || 10;
    
    const validAreas = ['drawing', 'stranding', 'armoring', 'sheathing'];
    if (!validAreas.includes(area)) {
      return res.status(400).json({
        data: null,
        timestamp: new Date().toISOString(),
        success: false,
        message: `Invalid area. Must be one of: ${validAreas.join(', ')}`,
      });
    }
    
    const result = await syncAreaAvailability(area, windowSize);
    
    res.json({
      data: result,
      timestamp: new Date().toISOString(),
      success: result.success,
    });
  } catch (error) {
    console.error(`Error syncing area ${req.params.area}:`, error);
    res.status(500).json({
      data: null,
      timestamp: new Date().toISOString(),
      success: false,
      message: error.message,
    });
  }
});

/**
 * GET /api/availability/machine/:machineId
 * Get latest availability aggregation for a specific machine
 */
router.get('/machine/:machineId', async (req, res) => {
  try {
    const { machineId } = req.params;
    
    const { query } = await import('../database/connection.js');
    const result = await query(
      `SELECT * FROM get_latest_availability($1, 'rolling_window')`,
      [machineId]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        data: null,
        timestamp: new Date().toISOString(),
        success: false,
        message: 'Availability data not found for this machine',
      });
    }
    
    const row = result.rows[0];
    res.json({
      data: {
        machineId,
        availabilityPercentage: parseFloat(row.availability_percentage || 0),
        runningTimeSeconds: parseFloat(row.running_time_seconds || 0),
        downtimeSeconds: parseFloat(row.downtime_seconds || 0),
        durations: {
          running: parseFloat(row.duration_running || 0),
          idle: parseFloat(row.duration_idle || 0),
          warning: parseFloat(row.duration_warning || 0),
          error: parseFloat(row.duration_error || 0),
          stopped: parseFloat(row.duration_stopped || 0),
          setup: parseFloat(row.duration_setup || 0),
        },
        windowStart: new Date(row.window_start),
        windowEnd: new Date(row.window_end),
        calculatedAt: new Date(row.calculated_at),
      },
      timestamp: new Date().toISOString(),
      success: true,
    });
  } catch (error) {
    console.error(`Error getting availability for machine ${req.params.machineId}:`, error);
    res.status(500).json({
      data: null,
      timestamp: new Date().toISOString(),
      success: false,
      message: error.message,
    });
  }
});

export default router;


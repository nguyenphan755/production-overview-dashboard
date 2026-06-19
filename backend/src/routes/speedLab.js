import express from 'express';
import { query } from '../../database/connection.js';
import { querySpeedLab } from '../services/speedLabService.js';

const router = express.Router();

/**
 * GET /api/speed-lab/query
 * Strict oee_calculations speed data for Speed Lab tab.
 */
router.get('/query', async (req, res) => {
  try {
    const {
      machineId,
      start: startQ,
      end: endQ,
      bucketSec: bucketSecQ,
      includeRaw: includeRawQ,
      rawLimit: rawLimitQ,
    } = req.query;

    if (!machineId || String(machineId).trim() === '') {
      return res.status(400).json({
        success: false,
        data: null,
        message: 'machineId is required',
        timestamp: new Date().toISOString(),
      });
    }
    if (startQ == null || String(startQ).trim() === '' || endQ == null || String(endQ).trim() === '') {
      return res.status(400).json({
        success: false,
        data: null,
        message: 'start and end query params are required (ISO 8601)',
        timestamp: new Date().toISOString(),
      });
    }

    const rangeStart = new Date(String(startQ));
    const rangeEnd = new Date(String(endQ));
    const bucketSec = bucketSecQ != null ? parseInt(String(bucketSecQ), 10) : 30;
    const includeRaw = String(includeRawQ || '0') === '1' || String(includeRawQ || '').toLowerCase() === 'true';
    const rawLimit = rawLimitQ != null ? parseInt(String(rawLimitQ), 10) : undefined;

    const data = await querySpeedLab(
      String(machineId).trim(),
      rangeStart,
      rangeEnd,
      bucketSec,
      includeRaw,
      rawLimit
    );

    if (data.buckets.length === 0) {
      return res.json({
        success: true,
        data,
        message: 'No oee_calculations rows in the selected window',
        timestamp: new Date().toISOString(),
      });
    }

    res.json({
      success: true,
      data,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    const status = error.statusCode || (/must be before|Invalid date|exceeds 31 days|not found/i.test(error.message || '') ? 400 : 500);
    console.error('Speed lab query error:', error);
    res.status(status).json({
      success: false,
      data: null,
      message: error.message || 'Speed lab query failed',
      timestamp: new Date().toISOString(),
    });
  }
});

/**
 * GET /api/speed-lab/machines — lightweight machine list for dropdown
 */
router.get('/machines', async (_req, res) => {
  try {
    const result = await query(
      `SELECT id, name, area FROM machines ORDER BY area, id ASC`
    );
    res.json({
      success: true,
      data: result.rows.map((r) => ({
        id: r.id,
        name: r.name,
        area: r.area,
      })),
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Speed lab machines error:', error);
    res.status(500).json({
      success: false,
      data: null,
      message: error.message,
      timestamp: new Date().toISOString(),
    });
  }
});

export default router;

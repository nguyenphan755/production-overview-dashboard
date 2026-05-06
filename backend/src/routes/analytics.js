import express from 'express';
import { getAnalyticsWithCache, computeAndCacheAnalytics } from '../services/analyticsService.js';

const router = express.Router();

// GET /api/analytics?range=today|week|month|shift&area=all&machineId=
router.get('/', async (req, res) => {
  try {
    const { range = 'today', area = 'all', machineId = null, force = 'false', shiftDate, shiftNumber } = req.query;
    const { payload, cached, computedAt } = await getAnalyticsWithCache(
      { range, area, machineId, shiftDate, shiftNumber },
      { force: force === 'true' }
    );

    res.json({
      data: payload,
      cached,
      timestamp: computedAt.toISOString(),
      success: true,
    });
  } catch (error) {
    console.error('Analytics fetch error:', error);
    res.status(500).json({
      data: null,
      timestamp: new Date().toISOString(),
      success: false,
      message: error.message,
    });
  }
});

// POST /api/analytics/recalculate
router.post('/recalculate', async (req, res) => {
  try {
    const { range = 'today', area = 'all', machineId = null, shiftDate, shiftNumber } = req.body || {};
    const payload = await computeAndCacheAnalytics({ range, area, machineId, shiftDate, shiftNumber });

    res.json({
      data: payload,
      cached: false,
      timestamp: new Date().toISOString(),
      success: true,
    });
  } catch (error) {
    console.error('Analytics recalculation error:', error);
    res.status(500).json({
      data: null,
      timestamp: new Date().toISOString(),
      success: false,
      message: error.message,
    });
  }
});

export default router;

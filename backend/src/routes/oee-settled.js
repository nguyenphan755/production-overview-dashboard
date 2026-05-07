import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { getShiftId, getShiftWindow } from '../utils/shiftCalculator.js';
import { listShiftSettlements, settleCompletedShift } from '../services/oeeSettlementService.js';

const router = express.Router();

/**
 * GET /api/oee-settled/shift?shiftDate=YYYY-MM-DD&shiftNumber=1|2|3
 * Resolves shift_id the same way as settlement POST.
 */
router.get('/shift', authenticateToken, async (req, res) => {
  try {
    const { shiftDate, shiftNumber } = req.query;
    if (!shiftDate || shiftNumber === undefined) {
      return res.status(400).json({
        success: false,
        data: null,
        timestamp: new Date().toISOString(),
        message: 'shiftDate and shiftNumber are required',
      });
    }

    const sn = parseInt(String(shiftNumber), 10);
    const parts = String(shiftDate).split('-').map(Number);
    const anchor = new Date(parts[0], (parts[1] || 1) - 1, parts[2] || 1, 12, 0, 0, 0);
    const window = getShiftWindow(sn, anchor);
    const shiftId = getShiftId(sn, window.start);

    const rows = await listShiftSettlements(shiftId);
    res.json({
      success: true,
      data: {
        shiftId,
        periodStart: window.start.toISOString(),
        periodEnd: window.end.toISOString(),
        settlements: rows,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('oee-settled GET error:', error);
    res.status(500).json({
      success: false,
      data: null,
      timestamp: new Date().toISOString(),
      message: error.message,
    });
  }
});

/**
 * POST /api/oee-settled/shift
 * Body: { shiftDate, shiftNumber, area?: 'all' | production_area }
 */
router.post('/shift', authenticateToken, async (req, res) => {
  try {
    const { shiftDate, shiftNumber, area } = req.body || {};
    if (!shiftDate || shiftNumber === undefined) {
      return res.status(400).json({
        success: false,
        data: null,
        timestamp: new Date().toISOString(),
        message: 'shiftDate and shiftNumber are required',
      });
    }

    const result = await settleCompletedShift({
      shiftDate: String(shiftDate),
      shiftNumber,
      area: area || null,
    });

    res.json({
      success: true,
      data: result,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('oee-settled POST error:', error);
    const status = error.message?.includes('not ended') ? 409 : 500;
    res.status(status).json({
      success: false,
      data: null,
      timestamp: new Date().toISOString(),
      message: error.message,
    });
  }
});

export default router;

import express from 'express';
import {
  getBobbinCutsByMachine,
  insertBobbinCuts,
} from '../services/bobbinCutService.js';

const router = express.Router();

// POST /api/bobbin-cuts/sync
router.post('/sync', async (req, res) => {
  try {
    const body = req.body;
    const cuts = Array.isArray(body) ? body : body?.cuts ? body.cuts : [body];

    if (!Array.isArray(cuts) || cuts.length === 0) {
      return res.status(400).json({
        success: false,
        data: null,
        message: 'No bobbin cuts provided',
        timestamp: new Date().toISOString(),
      });
    }

    const { inserted, received } = await insertBobbinCuts(cuts);
    return res.json({
      success: true,
      data: { inserted, cutsReceived: received },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error syncing bobbin cuts:', error);
    return res.status(500).json({
      success: false,
      data: null,
      message: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
    });
  }
});

// GET /api/bobbin-cuts/machines/:machineId?orderId=&from=&to=
router.get('/machines/:machineId', async (req, res) => {
  try {
    const { machineId } = req.params;
    const { orderId, from, to, limit } = req.query;

    const cuts = await getBobbinCutsByMachine(machineId, {
      orderId: typeof orderId === 'string' ? orderId : undefined,
      from: typeof from === 'string' ? from : undefined,
      to: typeof to === 'string' ? to : undefined,
      limit: limit ? parseInt(String(limit), 10) : 500,
    });

    return res.json({
      success: true,
      data: cuts,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error fetching bobbin cuts:', error);
    return res.status(500).json({
      success: false,
      data: null,
      message: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
    });
  }
});

export default router;

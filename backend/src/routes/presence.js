// User presence routes — heartbeat + online count

import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import {
  touchPresence,
  removePresence,
  getPresenceSnapshot,
} from '../services/userPresenceService.js';

const router = express.Router();

// POST /api/presence/heartbeat
router.post('/heartbeat', authenticateToken, (req, res) => {
  const { sessionId } = req.body || {};
  const data = touchPresence(sessionId, req.user.userId ?? req.user.id, req.user.username);
  res.json({
    success: true,
    data,
    timestamp: new Date().toISOString(),
  });
});

// POST /api/presence/leave
router.post('/leave', authenticateToken, (req, res) => {
  const { sessionId } = req.body || {};
  const data = removePresence(sessionId);
  res.json({
    success: true,
    data,
    timestamp: new Date().toISOString(),
  });
});

// GET /api/presence/count
router.get('/count', authenticateToken, (_req, res) => {
  const data = getPresenceSnapshot();
  res.json({
    success: true,
    data,
    timestamp: new Date().toISOString(),
  });
});

export default router;

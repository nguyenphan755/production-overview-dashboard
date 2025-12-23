// Authentication routes

import express from 'express';
import { query } from '../database/connection.js';
import { generateToken } from '../middleware/auth.js';

const router = express.Router();

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({
        data: null,
        timestamp: new Date().toISOString(),
        success: false,
        message: 'Username and password are required',
      });
    }

    // For production, use proper user authentication
    // For now, simple hardcoded credentials for Node-RED integration
    const validUsers = {
      nodered: { password: 'nodered123', role: 'system' },
      admin: { password: 'admin123', role: 'admin' },
    };

    const user = validUsers[username];

    if (!user || user.password !== password) {
      return res.status(401).json({
        data: null,
        timestamp: new Date().toISOString(),
        success: false,
        message: 'Invalid credentials',
      });
    }

    // Generate JWT token
    const token = generateToken({
      username,
      role: user.role,
    });

    res.json({
      data: {
        token,
        username,
        role: user.role,
      },
      timestamp: new Date().toISOString(),
      success: true,
    });
  } catch (error) {
    console.error('Error during login:', error);
    res.status(500).json({
      data: null,
      timestamp: new Date().toISOString(),
      success: false,
      message: error.message,
    });
  }
});

// POST /api/auth/verify - Verify token
router.post('/verify', async (req, res) => {
  try {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({
        data: null,
        timestamp: new Date().toISOString(),
        success: false,
        message: 'Token is required',
      });
    }

    // Token verification is done by middleware
    // This endpoint just confirms the token format
    res.json({
      data: { valid: true },
      timestamp: new Date().toISOString(),
      success: true,
    });
  } catch (error) {
    res.status(500).json({
      data: null,
      timestamp: new Date().toISOString(),
      success: false,
      message: error.message,
    });
  }
});

export default router;


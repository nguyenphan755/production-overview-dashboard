// Authentication routes

import express from 'express';
import bcrypt from 'bcryptjs';
import { query } from '../database/connection.js';
import { generateToken, JWT_SECRET } from '../middleware/auth.js';
import jwt from 'jsonwebtoken';

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

    const normalizedUsername = username.trim().toLowerCase();
    const result = await query(
      `SELECT id, username, password_hash, role, is_active, plant, area, line, last_login_at
       FROM mes_users
       WHERE username = $1`,
      [normalizedUsername]
    );

    if (result.rowCount === 0) {
      return res.status(401).json({
        data: null,
        timestamp: new Date().toISOString(),
        success: false,
        message: 'Invalid credentials',
      });
    }

    const user = result.rows[0];

    if (!user.is_active) {
      return res.status(403).json({
        data: null,
        timestamp: new Date().toISOString(),
        success: false,
        message: 'Account is disabled',
      });
    }

    const previousLastLoginAt = user.last_login_at;
    const passwordMatch = await bcrypt.compare(password, user.password_hash);
    if (!passwordMatch) {
      return res.status(401).json({
        data: null,
        timestamp: new Date().toISOString(),
        success: false,
        message: 'Invalid credentials',
      });
    }

    await query('UPDATE mes_users SET last_login_at = CURRENT_TIMESTAMP WHERE id = $1', [user.id]);

    const token = generateToken({
      userId: user.id,
      username: user.username,
      role: user.role,
    });

    res.json({
      data: {
        token,
        user: {
          id: user.id,
          username: user.username,
          role: user.role,
          isActive: user.is_active,
          plant: user.plant,
          area: user.area,
          line: user.line,
          lastLoginAt: previousLastLoginAt,
        },
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

    jwt.verify(token, JWT_SECRET, (err, user) => {
      if (err) {
        return res.status(403).json({
          data: null,
          timestamp: new Date().toISOString(),
          success: false,
          message: 'Invalid or expired token',
        });
      }

      res.json({
        data: { valid: true, user },
        timestamp: new Date().toISOString(),
        success: true,
      });
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


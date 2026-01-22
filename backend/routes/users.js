import express from 'express';
import bcrypt from 'bcryptjs';
import { query } from '../database/connection.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';

const router = express.Router();

const allowedRoles = ['operator', 'engineer', 'supervisor', 'admin'];

const requireAdminOrSupervisor = requireRole('admin', 'supervisor');

// GET /api/users - list users
router.get('/', authenticateToken, requireAdminOrSupervisor, async (req, res) => {
  try {
    const result = await query(
      `SELECT id, username, role, is_active, plant, area, line, last_login_at, created_at, updated_at
       FROM mes_users
       ORDER BY id`
    );

    res.json({
      data: result.rows.map((row) => ({
        id: row.id,
        username: row.username,
        role: row.role,
        isActive: row.is_active,
        plant: row.plant,
        area: row.area,
        line: row.line,
        lastLoginAt: row.last_login_at,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      })),
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

// POST /api/users - create user
router.post('/', authenticateToken, requireAdminOrSupervisor, async (req, res) => {
  try {
    const { username, password, role, isActive = true, plant, area, line } = req.body;

    if (!username || !password || !role) {
      return res.status(400).json({
        data: null,
        timestamp: new Date().toISOString(),
        success: false,
        message: 'Username, password, and role are required',
      });
    }

    if (!allowedRoles.includes(role)) {
      return res.status(400).json({
        data: null,
        timestamp: new Date().toISOString(),
        success: false,
        message: 'Invalid role',
      });
    }

    const normalizedUsername = username.trim().toLowerCase();
    const passwordHash = await bcrypt.hash(password, 12);

    const result = await query(
      `INSERT INTO mes_users (username, password_hash, role, is_active, plant, area, line)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, username, role, is_active, plant, area, line, created_at, updated_at`,
      [normalizedUsername, passwordHash, role, isActive, plant || null, area || null, line || null]
    );

    const user = result.rows[0];

    res.status(201).json({
      data: {
        id: user.id,
        username: user.username,
        role: user.role,
        isActive: user.is_active,
        plant: user.plant,
        area: user.area,
        line: user.line,
        createdAt: user.created_at,
        updatedAt: user.updated_at,
      },
      timestamp: new Date().toISOString(),
      success: true,
    });
  } catch (error) {
    if (error.code === '23505') {
      return res.status(409).json({
        data: null,
        timestamp: new Date().toISOString(),
        success: false,
        message: 'Username already exists',
      });
    }

    res.status(500).json({
      data: null,
      timestamp: new Date().toISOString(),
      success: false,
      message: error.message,
    });
  }
});

// PATCH /api/users/:id - update user fields
router.patch('/:id', authenticateToken, requireAdminOrSupervisor, async (req, res) => {
  try {
    const { id } = req.params;
    const { username, role, isActive, plant, area, line } = req.body;

    if (role && !allowedRoles.includes(role)) {
      return res.status(400).json({
        data: null,
        timestamp: new Date().toISOString(),
        success: false,
        message: 'Invalid role',
      });
    }

    const fields = [];
    const values = [];
    let index = 1;

    const pushField = (fieldName, value) => {
      if (value === undefined) {
        return;
      }
      fields.push(`${fieldName} = $${index}`);
      values.push(value);
      index += 1;
    };

    if (username !== undefined) {
      pushField('username', username.trim().toLowerCase());
    }
    pushField('role', role);
    pushField('is_active', isActive);
    pushField('plant', plant);
    pushField('area', area);
    pushField('line', line);

    if (fields.length === 0) {
      return res.status(400).json({
        data: null,
        timestamp: new Date().toISOString(),
        success: false,
        message: 'No fields to update',
      });
    }

    values.push(id);
    const result = await query(
      `UPDATE mes_users
       SET ${fields.join(', ')}
       WHERE id = $${index}
       RETURNING id, username, role, is_active, plant, area, line, last_login_at, created_at, updated_at`,
      values
    );

    if (result.rowCount === 0) {
      return res.status(404).json({
        data: null,
        timestamp: new Date().toISOString(),
        success: false,
        message: 'User not found',
      });
    }

    const user = result.rows[0];

    res.json({
      data: {
        id: user.id,
        username: user.username,
        role: user.role,
        isActive: user.is_active,
        plant: user.plant,
        area: user.area,
        line: user.line,
        lastLoginAt: user.last_login_at,
        createdAt: user.created_at,
        updatedAt: user.updated_at,
      },
      timestamp: new Date().toISOString(),
      success: true,
    });
  } catch (error) {
    if (error.code === '23505') {
      return res.status(409).json({
        data: null,
        timestamp: new Date().toISOString(),
        success: false,
        message: 'Username already exists',
      });
    }

    res.status(500).json({
      data: null,
      timestamp: new Date().toISOString(),
      success: false,
      message: error.message,
    });
  }
});

// POST /api/users/:id/reset-password
router.post('/:id/reset-password', authenticateToken, requireAdminOrSupervisor, async (req, res) => {
  try {
    const { id } = req.params;
    const { newPassword } = req.body;

    if (!newPassword) {
      return res.status(400).json({
        data: null,
        timestamp: new Date().toISOString(),
        success: false,
        message: 'New password is required',
      });
    }

    const passwordHash = await bcrypt.hash(newPassword, 12);
    const result = await query(
      `UPDATE mes_users SET password_hash = $1 WHERE id = $2 RETURNING id, username`,
      [passwordHash, id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({
        data: null,
        timestamp: new Date().toISOString(),
        success: false,
        message: 'User not found',
      });
    }

    res.json({
      data: { id: result.rows[0].id, username: result.rows[0].username },
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

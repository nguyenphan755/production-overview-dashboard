// JWT Authentication Middleware

import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

/**
 * Verify JWT token from Authorization header
 */
export const authenticateToken = (req, res, next) => {
  const authHeaderRaw = req.headers.authorization || req.headers.Authorization;
  const authHeader = typeof authHeaderRaw === 'string' ? authHeaderRaw.trim() : '';
  const bearerMatch = /^Bearer\s+(\S+)/i.exec(authHeader);
  const token = bearerMatch ? bearerMatch[1].trim() : null;

  if (!token) {
    return res.status(401).json({
      data: null,
      timestamp: new Date().toISOString(),
      success: false,
      message: 'Access token required',
    });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      const message =
        err.name === 'TokenExpiredError'
          ? 'Token expired — please sign in again'
          : 'Invalid or expired token';
      return res.status(403).json({
        data: null,
        timestamp: new Date().toISOString(),
        success: false,
        message,
      });
    }

    req.user = user;
    next();
  });
};

/**
 * Generate JWT token
 */
export const generateToken = (payload) => {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '24h' });
};

/**
 * Require one of the allowed roles
 */
export const requireRole = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        data: null,
        timestamp: new Date().toISOString(),
        success: false,
        message: 'Insufficient permissions',
      });
    }

    next();
  };
};

export { JWT_SECRET };


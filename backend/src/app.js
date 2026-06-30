import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import kpisRouter from './routes/kpis.js';
import areasRouter from './routes/areas.js';
import machinesRouter from './routes/machines.js';
import ordersRouter from './routes/orders.js';
import alarmsRouter from './routes/alarms.js';
import authRouter from './routes/auth.js';
import availabilityRouter from './routes/availability.js';
import analyticsRouter from './routes/analytics.js';
import oeeSettledRouter from './routes/oee-settled.js';
import usersRouter from './routes/users.js';
import reportsRouter from './routes/reports.js';
import presenceRouter from './routes/presence.js';
import bobbinCutsRouter from './routes/bobbinCuts.js';
import speedLabRouter from './routes/speedLab.js';
import { startPresenceCleanup, stopPresenceCleanup } from './services/userPresenceService.js';
import { startContinuousSync } from './services/availabilitySync.js';
import { initializeCache } from './services/machineStatusCache.js';
import pool, { query } from '../database/connection.js';
import { startAnalyticsScheduler } from './services/analyticsService.js';
import { startMachineLineTelemetrySampler } from './services/machineLineTelemetrySampler.js';

dotenv.config();

const app = express();
const server = createServer(app);
const PORT = process.env.PORT || 3001;

// WebSocket Server for real-time updates
import { addClient, removeClient, getClients } from './websocket/broadcast.js';

const wss = new WebSocketServer({ server, path: '/ws' });

wss.on('connection', (ws) => {
  if (process.env.NODE_ENV !== 'production') console.log('✅ WebSocket client connected');
  addClient(ws);

  // Heartbeat: mark alive on pong; the interval below terminates stale sockets
  // so dead connections (network drop, sleeping laptop) are cleaned up.
  ws.isAlive = true;
  ws.on('pong', () => {
    ws.isAlive = true;
  });

  ws.on('close', () => {
    if (process.env.NODE_ENV !== 'production') console.log('❌ WebSocket client disconnected');
    removeClient(ws);
  });

  ws.on('error', (error) => {
    console.error('❌ WebSocket error:', error.message || error);
    removeClient(ws);
  });

  // Send welcome message
  ws.send(JSON.stringify({
    type: 'connected',
    message: 'Connected to MES real-time updates',
    timestamp: new Date().toISOString(),
  }));
});

// Ping all clients periodically; terminate any that did not pong since last tick.
const WS_HEARTBEAT_MS = parseInt(process.env.WS_HEARTBEAT_MS || '30000', 10);
const wsHeartbeat = setInterval(() => {
  for (const ws of getClients()) {
    if (ws.isAlive === false) {
      removeClient(ws);
      try { ws.terminate(); } catch { /* already gone */ }
      continue;
    }
    ws.isAlive = false;
    try { ws.ping(); } catch { /* will be reaped next tick */ }
  }
}, WS_HEARTBEAT_MS);
wsHeartbeat.unref?.();

// Middleware - CORS configuration for remote access support
const getCorsOrigin = () => {
  const nodeEnv = process.env.NODE_ENV || 'development';
  
  // Always allow all origins in development mode for easier remote access (Tailscale/VPN)
  // This is safe for development but should be restricted in production
  if (nodeEnv !== 'production') {
    console.log('🌐 CORS: Allowing all origins (development mode)');
    return true; // Allow all origins
  }

  // In production, use configured origins
  const corsOrigin = process.env.CORS_ORIGIN || 'http://localhost:5173';
  
  // Support comma-separated list of origins
  if (corsOrigin.includes(',')) {
    const origins = corsOrigin.split(',').map(origin => origin.trim());
    console.log('🌐 CORS: Allowing origins:', origins);
    return origins;
  }
  
  console.log('🌐 CORS: Allowing origin:', corsOrigin);
  return corsOrigin;
};

const corsOptions = {
  origin: getCorsOrigin(),
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  optionsSuccessStatus: 200, // Some legacy browsers (IE11, various SmartTVs) choke on 204
};

// Log CORS configuration on startup
console.log('🔧 CORS Configuration:');
console.log(`   NODE_ENV: ${process.env.NODE_ENV || 'development'}`);
console.log(`   CORS_ORIGIN: ${process.env.CORS_ORIGIN || 'not set (using default)'}`);
console.log(`   CORS allows all origins: ${corsOptions.origin === true}`);

app.use(cors(corsOptions));

// Debug middleware - log all requests (helpful for CORS debugging).
// Disabled in production (set LOG_REQUESTS=true to force on) to cut log volume
// and per-request I/O under load.
if (process.env.NODE_ENV !== 'production' || process.env.LOG_REQUESTS === 'true') {
  app.use((req, res, next) => {
    console.log(`📥 ${req.method} ${req.path} - Origin: ${req.headers.origin || 'none'}`);
    next();
  });
}

const JSON_BODY_LIMIT = process.env.JSON_BODY_LIMIT || '2mb';
app.use(express.json({ limit: JSON_BODY_LIMIT }));
app.use(express.urlencoded({ extended: true, limit: JSON_BODY_LIMIT }));

// Liveness: process is up (fast, no dependencies). Use for "is the app running".
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Readiness: verifies the database is actually reachable. Use this for load
// balancers / monitors so a DB outage is not reported as "healthy".
app.get('/health/ready', async (req, res) => {
  try {
    await query('SELECT 1');
    res.json({ status: 'ready', db: 'ok', timestamp: new Date().toISOString() });
  } catch (err) {
    res.status(503).json({
      status: 'not_ready',
      db: 'error',
      message: err.message || 'database unavailable',
      timestamp: new Date().toISOString(),
    });
  }
});

// Root route - API information
app.get('/', (req, res) => {
  res.json({
    message: 'Production Overview Dashboard API',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    endpoints: {
      health: '/health',
      api: {
        base: '/api',
        routes: {
          auth: '/api/auth',
          kpis: '/api/kpis',
          areas: '/api/areas',
          machines: '/api/machines',
          orders: '/api/orders',
          alarms: '/api/alarms',
          availability: '/api/availability',
          analytics: '/api/analytics',
          oeeSettled: '/api/oee-settled',
          reports: '/api/reports',
          presence: '/api/presence',
          bobbinCuts: '/api/bobbin-cuts',
          speedLab: '/api/speed-lab',
        },
      },
      websocket: '/ws',
    },
    examples: {
      health: `${req.protocol}://${req.get('host')}/health`,
      machines: `${req.protocol}://${req.get('host')}/api/machines`,
      kpis: `${req.protocol}://${req.get('host')}/api/kpis/global`,
    },
  });
});

// API Routes
app.use('/api/auth', authRouter);
app.use('/api/users', usersRouter);
app.use('/api/kpis', kpisRouter);
app.use('/api/areas', areasRouter);
app.use('/api/machines', machinesRouter);
app.use('/api/orders', ordersRouter);
app.use('/api/alarms', alarmsRouter);
app.use('/api/availability', availabilityRouter);
app.use('/api/analytics', analyticsRouter);
app.use('/api/oee-settled', oeeSettledRouter);
app.use('/api/reports', reportsRouter);
app.use('/api/presence', presenceRouter);
app.use('/api/bobbin-cuts', bobbinCutsRouter);
app.use('/api/speed-lab', speedLabRouter);

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({
    data: null,
    timestamp: new Date().toISOString(),
    success: false,
    message: err.message || 'Internal server error',
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    data: null,
    timestamp: new Date().toISOString(),
    success: false,
    message: 'Endpoint not found',
  });
});

// Start server - listen on all interfaces (0.0.0.0) for remote access via Tailscale/VPN
server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`❌ Port ${PORT} is already in use — another backend instance is running.`);
    console.error('   Stop it first, then run npm run start again:');
    console.error(`   netstat -ano | findstr :${PORT}`);
    console.error('   taskkill /PID <pid> /F');
    process.exit(1);
  }
  throw err;
});

// Stop handles for background schedulers, drained on graceful shutdown.
const stopHandles = [];

server.listen(PORT, '0.0.0.0', async () => {
  console.log(`🚀 Server running on http://0.0.0.0:${PORT}`);
  console.log(`📊 API endpoints available at http://localhost:${PORT}/api`);
  console.log(`💚 Health check: http://localhost:${PORT}/health (liveness), /health/ready (DB)`);
  console.log(`🔌 WebSocket server available at ws://localhost:${PORT}/ws`);
  console.log(`🌐 Server accessible from remote machines (Tailscale/VPN)`);
  
  // Initialize machine status cache (event-based status updates)
  await initializeCache(query);
  console.log(`💾 Machine status cache initialized - status updates are event-based (only on change)`);
  
  // Start continuous availability synchronization
  // Syncs all machines every 30 seconds using shift-based calculation
  // Shifts: 06:00-14:00 (Shift 1), 14:00-22:00 (Shift 2), 22:00-06:00 (Shift 3)
  const SYNC_INTERVAL_SECONDS = parseInt(process.env.AVAILABILITY_SYNC_INTERVAL || '30', 10);
  const USE_SHIFT_BASED = process.env.AVAILABILITY_USE_SHIFTS !== 'false'; // Default to true
  
  stopHandles.push(startContinuousSync(SYNC_INTERVAL_SECONDS, USE_SHIFT_BASED));
  const syncType = USE_SHIFT_BASED ? 'shift-based (3 shifts: 06:00-14:00, 14:00-22:00, 22:00-06:00)' : 'rolling window';
  console.log(`🔄 Continuous availability synchronization started (interval: ${SYNC_INTERVAL_SECONDS}s, calculation: ${syncType})`);

  const ANALYTICS_REFRESH_SECONDS = parseInt(process.env.ANALYTICS_REFRESH_INTERVAL || '60', 10);
  stopHandles.push(startAnalyticsScheduler({ ranges: ['shift', 'today'], intervalSeconds: ANALYTICS_REFRESH_SECONDS }));
  console.log(`🤖 Analytics cache scheduler started (interval: ${ANALYTICS_REFRESH_SECONDS}s)`);

  stopHandles.push(startMachineLineTelemetrySampler());

  stopHandles.push(startPresenceCleanup());
  console.log('👥 User presence tracking started');
});

// ── Graceful shutdown ────────────────────────────────────────────────────────
// On SIGTERM/SIGINT (PM2 reload, deploy, Ctrl+C): stop background timers, stop
// accepting new connections, close WebSockets, drain the HTTP server, then end
// the DB pool. Prevents dropped in-flight work and leaked connections/intervals.
let shuttingDown = false;
async function gracefulShutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`\n🛑 ${signal} received — shutting down gracefully...`);

  clearInterval(wsHeartbeat);
  for (const stop of stopHandles) {
    try { if (typeof stop === 'function') stop(); } catch (e) { console.error('stop handle error:', e?.message || e); }
  }
  try { stopPresenceCleanup(); } catch { /* noop */ }

  // Close WebSocket connections.
  for (const ws of getClients()) {
    try { ws.close(1001, 'Server shutting down'); } catch { /* noop */ }
  }
  try { wss.close(); } catch { /* noop */ }

  // Stop accepting new HTTP connections and wait for in-flight ones to finish.
  const forceTimer = setTimeout(() => {
    console.error('⚠️  Shutdown timed out — forcing exit.');
    process.exit(1);
  }, parseInt(process.env.SHUTDOWN_TIMEOUT_MS || '10000', 10));
  forceTimer.unref?.();

  server.close(async () => {
    try {
      await pool.end();
      console.log('✅ HTTP server closed and DB pool drained. Bye.');
    } catch (e) {
      console.error('Error draining DB pool:', e?.message || e);
    } finally {
      clearTimeout(forceTimer);
      process.exit(0);
    }
  });
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Last-resort safety nets: log instead of dying silently. A repeatedly crashing
// process is still restarted by PM2, but these prevent silent data loss.
process.on('unhandledRejection', (reason) => {
  console.error('🚨 Unhandled promise rejection:', reason);
});
process.on('uncaughtException', (err) => {
  console.error('🚨 Uncaught exception:', err);
  // Trigger a graceful shutdown; PM2 will restart a clean process.
  gracefulShutdown('uncaughtException');
});


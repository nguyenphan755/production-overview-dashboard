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
import { startContinuousSync } from './services/availabilitySync.js';
import { initializeCache } from './services/machineStatusCache.js';
import { query } from './database/connection.js';

dotenv.config();

const app = express();
const server = createServer(app);
const PORT = process.env.PORT || 3001;

// WebSocket Server for real-time updates
import { addClient, removeClient } from './websocket/broadcast.js';

const wss = new WebSocketServer({ server, path: '/ws' });

wss.on('connection', (ws) => {
  console.log('✅ WebSocket client connected');
  addClient(ws);

  ws.on('close', () => {
    console.log('❌ WebSocket client disconnected');
    removeClient(ws);
  });

  ws.on('error', (error) => {
    console.error('❌ WebSocket error:', error);
  });

  // Send welcome message
  ws.send(JSON.stringify({
    type: 'connected',
    message: 'Connected to MES real-time updates',
    timestamp: new Date().toISOString(),
  }));
});

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

// Debug middleware - log all requests (helpful for CORS debugging)
app.use((req, res, next) => {
  console.log(`📥 ${req.method} ${req.path} - Origin: ${req.headers.origin || 'none'}`);
  next();
});

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
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
app.use('/api/kpis', kpisRouter);
app.use('/api/areas', areasRouter);
app.use('/api/machines', machinesRouter);
app.use('/api/orders', ordersRouter);
app.use('/api/alarms', alarmsRouter);
app.use('/api/availability', availabilityRouter);

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
server.listen(PORT, '0.0.0.0', async () => {
  console.log(`🚀 Server running on http://0.0.0.0:${PORT}`);
  console.log(`📊 API endpoints available at http://localhost:${PORT}/api`);
  console.log(`💚 Health check: http://localhost:${PORT}/health`);
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
  
  startContinuousSync(SYNC_INTERVAL_SECONDS, USE_SHIFT_BASED);
  const syncType = USE_SHIFT_BASED ? 'shift-based (3 shifts: 06:00-14:00, 14:00-22:00, 22:00-06:00)' : 'rolling window';
  console.log(`🔄 Continuous availability synchronization started (interval: ${SYNC_INTERVAL_SECONDS}s, calculation: ${syncType})`);
});


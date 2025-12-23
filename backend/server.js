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

// Middleware
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API Routes
app.use('/api/auth', authRouter);
app.use('/api/kpis', kpisRouter);
app.use('/api/areas', areasRouter);
app.use('/api/machines', machinesRouter);
app.use('/api/orders', ordersRouter);
app.use('/api/alarms', alarmsRouter);

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

// Start server
server.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`📊 API endpoints available at http://localhost:${PORT}/api`);
  console.log(`💚 Health check: http://localhost:${PORT}/health`);
  console.log(`🔌 WebSocket server available at ws://localhost:${PORT}/ws`);
});


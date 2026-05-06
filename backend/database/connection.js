import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

// Create PostgreSQL connection pool
const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'production_dashboard',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || '',
  max: parseInt(process.env.DB_POOL_MAX || '50'), // Maximum number of clients in the pool
  idleTimeoutMillis: parseInt(process.env.DB_IDLE_TIMEOUT_MS || '30000'),
  // Increase default connection timeout to reduce "timeout exceeded when trying to connect"
  // (e.g. when DB is slow to accept or pool is busy). Override with DB_CONN_TIMEOUT_MS in .env.
  connectionTimeoutMillis: parseInt(process.env.DB_CONN_TIMEOUT_MS || '20000'),
});

// Validate database configuration
if (!process.env.DB_PASSWORD) {
  console.warn('⚠️  WARNING: DB_PASSWORD not set in .env file');
  console.warn('   Please create backend/.env with your PostgreSQL password');
  console.warn('   See BACKEND_DATABASE_SETUP.md for instructions');
}

// Test connection
pool.on('connect', () => {
  console.log('✅ Connected to PostgreSQL database');
});

pool.on('error', (err) => {
  console.error('❌ Unexpected error on idle PostgreSQL client', err.message);
  // Do not process.exit(-1): one bad client should not kill the app; pool can create new connections.
});

// Helper function to execute queries
export const query = async (text, params) => {
  const start = Date.now();
  try {
    const res = await pool.query(text, params);
    const duration = Date.now() - start;
    console.log('Executed query', { text, duration, rows: res.rowCount });
    return res;
  } catch (error) {
    console.error('Database query error:', error);
    throw error;
  }
};

// Helper function to get a client from the pool (caller must call client.release() in finally).
export const getClient = async () => {
  const client = await pool.connect();
  return client;
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** True when pool.connect() failed due to overload / network / DB briefly unavailable (safe to retry). */
function isTransientConnectError(err) {
  if (!err) return false;
  const msg = String(err.message || '');
  if (msg.includes('timeout exceeded when trying to connect')) return true;
  const transient = ['ETIMEDOUT', 'ECONNRESET', 'ECONNREFUSED', 'EHOSTUNREACH', 'EPIPE'];
  return transient.includes(err.code);
}

/**
 * Run a function with a pooled client. The client is always released, even on throw or early return.
 * Retries acquiring a client when the failure looks transient (pool busy, slow DB, short network blip).
 * Tune with DB_CONNECT_RETRIES (default 3) and DB_CONNECT_RETRY_MS base delay (default 150).
 * @param { (client: import('pg').PoolClient) => Promise<T> } fn
 * @returns { Promise<T> }
 */
export const withClient = async (fn) => {
  const maxAttempts = Math.max(1, parseInt(process.env.DB_CONNECT_RETRIES || '3', 10));
  const baseDelayMs = parseInt(process.env.DB_CONNECT_RETRY_MS || '150', 10);

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    let client;
    try {
      client = await pool.connect();
    } catch (e) {
      if (attempt < maxAttempts && isTransientConnectError(e)) {
        console.warn(
          `⚠️  DB connect attempt ${attempt}/${maxAttempts} failed: ${e.message}. Retrying in ${baseDelayMs * attempt}ms...`
        );
        await sleep(baseDelayMs * attempt);
        continue;
      }
      throw e;
    }
    try {
      return await fn(client);
    } finally {
      client.release();
    }
  }
};

export default pool;


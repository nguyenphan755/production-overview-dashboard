// PM2 ecosystem config for Production Overview Dashboard backend.
//
// File extension is `.cjs` because backend/package.json sets
// "type": "module"; PM2 expects this config in CommonJS form.
//
// Run from the `backend/` directory:
//   pm2 start ecosystem.config.cjs
//   pm2 save
//   pm2 status
//
// Env vars not set here (DB_HOST, DB_USER, ...) are still read from
// backend/.env at runtime via dotenv.config() inside src/app.js.

const path = require('path');

module.exports = {
  apps: [
    {
      name: 'production-dashboard-backend',
      script: './server.js',
      cwd: __dirname,
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '512M',
      // Wait a bit before considering app online to avoid restart loops
      // while DB / cache initialization is in progress.
      min_uptime: '10s',
      max_restarts: 10,
      env: {
        NODE_ENV: 'production',
        PORT: 3001,
      },
      error_file: path.join(__dirname, 'logs/pm2-error.log'),
      out_file: path.join(__dirname, 'logs/pm2-out.log'),
      merge_logs: true,
      time: true,
    },
  ],
};

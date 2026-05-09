
# Production Overview Dashboard

This repository is structured as a multi-part project:

- `frontend/` for the web UI
- `backend/` for API and business logic
- `database/` for schema/migrations/queries
- `docs/` for technical documentation

## Running the code

### Frontend

```bash
cd frontend
npm i
npm run dev
```

Frontend runs at `http://localhost:5173`.

### Backend

```bash
cd backend
npm i
npm start
```

Backend runs at `http://localhost:3001`.

## Production deployment

Two supported shapes:

### A) NGINX (recommended): static `frontend/build` + reverse proxy `/api/` (and `/ws`)

1. Build the UI with the **public** API URL the browser will use (often same origin as the site):

   ```bash
   cd frontend
   cp .env.production.example .env.production
   # Edit VITE_API_BASE_URL — e.g. https://mes.example.com/api when nginx serves HTTPS on 443
   npm ci
   npm run build
   ```

2. Add `limit_req_zone $binary_remote_addr zone=api_per_ip:10m rate=10r/s;` to the **`http { }`** block of the main `nginx.conf` (see comment at top of `deploy/nginx.conf`).

3. In `deploy/nginx.conf`, set `root` to the absolute path of `frontend/build` after `npm run build` (replace the `FRONTEND_DIST` placeholder), and align every `proxy_pass http://127.0.0.1:3001` with `PORT` in `backend/.env` (default **3001**).

4. Include the site file from nginx and reload. Example listen port **8080** in the repo config; use **80**/**443** in real production as needed.

Express exposes **`/health`** and WebSocket **`/ws`**; the sample nginx config proxies both so realtime and probes work behind one host.

### B) PM2 (“dev-like prod”): Node API + static UI (no nginx)

`pm2 serve` does **not** proxy `/api`, so **`VITE_API_BASE_URL` must be an absolute URL** to the API (see `frontend/.env.production.example`), then rebuild the frontend.

**Backend** (entry is `backend/server.js`, not a `dist` bundle):

```bash
cd backend
npm ci
pm2 start server.js --name production-dashboard-api --cwd "/absolute/path/to/repo/backend"
```

**Frontend** (after `npm run build` in `frontend/`):

```bash
pm2 serve "/absolute/path/to/repo/frontend/build" 4173 --name production-dashboard-ui --spa
```

On Windows, prefer `pm2 start … server.js` directly instead of `npm.cmd start` if PM2 fails around `npm`.

Persist and operate:

```bash
pm2 save
pm2 status
pm2 restart production-dashboard-api production-dashboard-ui
pm2 logs production-dashboard-api
```

Set **`NODE_ENV=production`** and **`CORS_ORIGIN`** (comma-separated allowed origins) in `backend/.env` when the UI is on another origin/port.

### IIS and port 80

This repository does **not** configure IIS. If you use **nginx on Windows/Linux**:

- **Port 80** is optional; the sample listens on **8080** to avoid colliding with IIS or other services.
- If IIS already binds **80**/**443**, either stop/disable the IIS site, run nginx on another port, or front nginx with IIS **ARR** as a reverse proxy (advanced).

Nothing in this repo turns IIS on or claims port 80 by itself — that is entirely your server layout.

### Windows 11 (VMware VM)

Use the same **A)** / **B)** flows above inside the guest OS. Practical notes:

- **Paths**: Prefer forward slashes in nginx `root`, e.g. `root C:/MES/Production-Overview-Dashboard/frontend/build;`. Wrap paths that contain spaces in quotes for PM2 (`--cwd`, `pm2 serve "…"`).
- **Shell**: PowerShell or **cmd** are fine; `cp` in build steps is PowerShell `Copy-Item` or copy the example file manually.
- **nginx on Windows**: Install the official Windows build, put `limit_req_zone` in the main `conf/nginx.conf` inside `http { }`, then `include` your edited `deploy/nginx.conf` or paste the `server { }` block. Run `nginx.exe` from its install directory (or install as a service). Reload: `nginx -s reload`.
- **Firewall**: Allow inbound TCP on the ports you use (e.g. **8080** for nginx sample, **3001** for API, **4173** for `pm2 serve`) — *Windows Defender Firewall → Inbound rules*.
- **IIS on Win11**: Usually **not** listening on 80 unless you enabled IIS features; if something already uses a port, change `listen` / `PORT` / PM2 UI port.
- **PM2 persistence after reboot**: On Windows, scheduling varies; after `pm2 save`, look at [PM2 startup on Windows](https://pm2.keymetrics.io/docs/usage/startup/) (e.g. `pm2 startup` / ecosystem + Scheduled Task, or a wrapper service). Easiest for a lab VM is starting PM2 manually or a login script.

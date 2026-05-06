# Remote Access Configuration Guide

## Overview

The frontend now automatically detects the current hostname and constructs the API URL dynamically. This enables remote access via Tailscale or other VPN solutions without additional configuration.

## How It Works

1. **Automatic Detection**: When the frontend loads, it detects the current hostname from `window.location.hostname`
2. **Dynamic API URL**: It automatically constructs the API base URL using:
   - Same protocol (http/https) as the frontend
   - Same hostname (e.g., `100.94.207.3` when accessed via Tailscale)
   - Backend port `3001`
   - Path `/api`

**Example:**
- Frontend accessed at: `http://100.94.207.3:5173`
- API automatically uses: `http://100.94.207.3:3001/api`

## Configuration Options

### Option 1: Automatic (Recommended)

No configuration needed! The frontend automatically detects the hostname and uses it for API calls.

**Use this when:**
- Accessing from the same machine (localhost)
- Accessing remotely via Tailscale or VPN
- The backend is on the same hostname but different port

### Option 2: Explicit Configuration

Create a `.env` file in the project root to explicitly set the API base URL:

```env
VITE_API_BASE_URL=http://100.94.207.3:3001/api
VITE_USE_MOCK_DATA=false
VITE_REALTIME_ENABLED=false
```

**Use this when:**
- The backend is on a different hostname than the frontend
- You want to override the automatic detection
- You need a specific backend server address

## Setup for Tailscale Remote Access

### Step 1: Ensure Backend is Accessible

Make sure your backend server is listening on all interfaces (not just localhost):

```javascript
// backend/server.js should have:
app.listen(3001, '0.0.0.0', () => {
  console.log('🚀 Server running on http://0.0.0.0:3001');
});
```

This allows the backend to accept connections from Tailscale IPs.

### Step 2: Access Frontend Remotely

1. Start the frontend dev server (if not already running):
   ```bash
   npm run dev
   ```

2. Access from another machine via Tailscale:
   ```
   http://100.94.207.3:5173
   ```

3. The frontend will automatically detect the hostname and make API calls to:
   ```
   http://100.94.207.3:3001/api
   ```

### Step 3: Verify Connection

1. Open browser developer console (F12)
2. Check the API Configuration log:
   ```
   🔧 API Configuration:
      Base URL: http://100.94.207.3:3001/api
   ```
3. Check for API requests in the Network tab
4. Verify data loads correctly in the UI

## Troubleshooting

### Issue: API calls still using localhost

**Solution**: Clear browser cache and restart the frontend dev server:
```bash
# Stop the server (Ctrl+C)
npm run dev
```

### Issue: Backend not accessible from remote machine

**Check:**
1. Backend server is running and listening on `0.0.0.0:3001`
2. Tailscale is connected on both machines
3. Firewall allows connections on port 3001
4. Backend health check works: `http://100.94.207.3:3001/health`

### Issue: CORS errors

Ensure backend CORS configuration allows requests from your Tailscale IP:
```javascript
// backend/server.js
app.use(cors({
  origin: ['http://localhost:5173', 'http://100.94.207.3:5173'],
  credentials: true
}));
```

### Issue: WebSocket not connecting

WebSocket connections automatically use the same hostname as HTTP API calls. Verify:
1. WebSocket endpoint is enabled in backend
2. Backend WebSocket server is listening on the correct port
3. Check browser console for WebSocket connection errors

## Environment Variables Reference

| Variable | Description | Default |
|----------|-------------|---------|
| `VITE_API_BASE_URL` | Explicit API base URL (overrides auto-detection) | Auto-detected from hostname |
| `VITE_USE_MOCK_DATA` | Use mock data instead of real API | `true` |
| `VITE_REALTIME_ENABLED` | Enable WebSocket real-time updates | `false` |

## Notes

- **WebSocket Support**: WebSocket connections automatically use the same hostname detection logic
- **HTTPS Support**: If accessing via HTTPS, WebSocket will automatically use WSS
- **Development vs Production**: This works in both development (Vite dev server) and production builds
- **Port Configuration**: The backend port is hardcoded to `3001`. To change it, either:
  - Set `VITE_API_BASE_URL` explicitly with your custom port
  - Modify the `port` variable in `src/services/api.ts` (line 29)

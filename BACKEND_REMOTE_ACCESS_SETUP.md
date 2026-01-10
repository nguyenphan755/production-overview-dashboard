# Backend Remote Access Setup Guide

This guide explains how to configure the backend API to accept requests from remote machines via Tailscale, VPN, or other network access.

## Overview

The backend API has been configured to:
1. **Listen on all interfaces** (`0.0.0.0`) instead of just `localhost`
2. **Allow CORS from any origin in development mode** for easy remote access
3. **Support configurable CORS origins** in production mode

## Configuration

### 1. Server Binding (Already Configured)

The server now listens on `0.0.0.0:3001`, which means it accepts connections from:
- Localhost: `http://localhost:3001`
- Tailscale IP: `http://100.94.207.3:3001`
- Any other network interface

**Location**: `backend/server.js` line 143
```javascript
server.listen(PORT, '0.0.0.0', async () => {
  // Server is accessible from all network interfaces
});
```

### 2. CORS Configuration

#### Development Mode (Default)

In development mode (`NODE_ENV=development`), CORS **allows all origins** automatically:
- ✅ `http://localhost:5173` - Local access
- ✅ `http://100.94.207.3:5173` - Tailscale access
- ✅ Any other origin

**No configuration needed** - it works out of the box!

#### Production Mode

In production mode, configure allowed origins in `.env`:

```env
NODE_ENV=production
CORS_ORIGIN=http://localhost:5173,http://100.94.207.3:5173,https://yourdomain.com
```

Multiple origins can be specified as a comma-separated list.

**Location**: `backend/server.js` lines 51-65

### 3. Environment Variables

Update `backend/.env`:

```env
# Database Configuration
DB_HOST=localhost
DB_PORT=5432
DB_NAME=production_dashboard
DB_USER=postgres
DB_PASSWORD=your_password

# Server Configuration
PORT=3001
NODE_ENV=development

# CORS (optional in development - all origins allowed by default)
# CORS_ORIGIN=http://localhost:5173
```

## Verification Steps

### Step 1: Restart Backend Server

After configuration changes, restart the backend:

```bash
cd backend
npm start
```

You should see:
```
🚀 Server running on http://0.0.0.0:3001
📊 API endpoints available at http://localhost:3001/api
💚 Health check: http://localhost:3001/health
🔌 WebSocket server available at ws://localhost:3001/ws
🌐 Server accessible from remote machines (Tailscale/VPN)
```

### Step 2: Test Backend Access from Remote Machine

From the remote machine, test the backend:

```bash
# Test health endpoint
curl http://100.94.207.3:3001/health

# Test API endpoint
curl http://100.94.207.3:3001/api/machines
```

Expected response:
```json
{"status":"ok","timestamp":"2026-01-10T..."}
```

### Step 3: Test Frontend from Remote Machine

1. Start frontend dev server (if not already running):
   ```bash
   npm run dev
   ```

2. Access from remote machine via Tailscale:
   ```
   http://100.94.207.3:5173
   ```

3. Open browser developer console (F12) and check:
   ```
   🔧 API Configuration:
      Base URL: http://100.94.207.3:3001/api
   ```

4. Check Network tab for API requests - they should succeed!

### Step 4: Verify CORS Headers

In browser developer console → Network tab → Select any API request → Headers:

You should see:
```
Access-Control-Allow-Origin: http://100.94.207.3:5173
Access-Control-Allow-Credentials: true
```

## Docker Configuration

If using Docker, ensure port mapping includes `0.0.0.0`:

### docker-compose.yml
```yaml
services:
  backend:
    build: ./backend
    ports:
      - "0.0.0.0:3001:3001"  # Listen on all interfaces
    environment:
      - NODE_ENV=development
      - PORT=3001
```

### Dockerfile
```dockerfile
# Expose port 3001
EXPOSE 3001

# Start server (will listen on 0.0.0.0 inside container)
CMD ["node", "server.js"]
```

## Troubleshooting

### Issue: CORS errors in browser console

**Symptoms**: `Access to fetch at 'http://100.94.207.3:3001/api/machines' from origin 'http://100.94.207.3:5173' has been blocked by CORS policy`

**Solution**:
1. Ensure `NODE_ENV=development` in `backend/.env`
2. Restart backend server
3. Check browser console for the actual origin being blocked
4. In production, add the origin to `CORS_ORIGIN` in `.env`

### Issue: Backend not accessible from remote machine

**Symptoms**: Connection timeout or "refused to connect"

**Solution**:
1. Verify backend is running: `netstat -ano | findstr :3001`
2. Verify backend is listening on `0.0.0.0` (check server.js line 143)
3. Check firewall allows port 3001
4. Verify Tailscale/VPN connection is active
5. Test backend directly: `curl http://100.94.207.3:3001/health`

### Issue: Backend accessible but API returns 404

**Symptoms**: Backend responds but API endpoints return "Endpoint not found"

**Solution**:
1. Check API endpoint URL - should be `/api/machines`, not `/machines`
2. Verify routes are registered in `server.js`
3. Check backend console for route registration logs

### Issue: WebSocket not connecting from remote machine

**Solution**:
1. Verify WebSocket endpoint: `ws://100.94.207.3:3001/ws`
2. Check backend console for WebSocket connection logs
3. Ensure firewall allows WebSocket connections
4. Test WebSocket connection: Use browser console:
   ```javascript
   const ws = new WebSocket('ws://100.94.207.3:3001/ws');
   ws.onopen = () => console.log('Connected!');
   ws.onerror = (e) => console.error('Error:', e);
   ```

## Security Notes

### Development Mode
- **Allows all origins** - Convenient for development and testing
- **Suitable for**: Local development, testing, Tailscale/VPN access
- **Not suitable for**: Production deployments exposed to internet

### Production Mode
- **Requires explicit CORS configuration** - Only allows specified origins
- **Recommended**: Specify exact origins in `CORS_ORIGIN`
- **Example**: `CORS_ORIGIN=https://yourdomain.com,https://dashboard.yourdomain.com`

## Summary

✅ **Server listens on `0.0.0.0:3001`** - Accepts connections from all network interfaces
✅ **CORS allows all origins in development** - Easy remote access via Tailscale/VPN
✅ **Configurable CORS in production** - Secure with explicit origin whitelist
✅ **WebSocket support** - Real-time updates work from remote machines

The backend is now fully configured for remote access!

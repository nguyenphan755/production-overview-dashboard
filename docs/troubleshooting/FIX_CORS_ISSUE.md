# Fix CORS Issue for Tailscale Remote Access

## Problem

CORS error blocking API requests:
```
Access to fetch at 'http://localhost:3001/api/...' 
from origin 'http://100.94.207.3:5173' has been blocked by CORS policy
```

## Root Cause

Backend CORS configuration is correct but needs verification:
- Frontend origin: `http://100.94.207.3:5173` (Tailscale IP)
- Backend should allow all origins in development mode

## Solution

### Step 1: Verify Backend `.env` File

Ensure `backend/.env` has `NODE_ENV=development`:

```env
# Server Configuration
PORT=3001
NODE_ENV=development  ← Must be set to 'development'

# Database Configuration
DB_HOST=localhost
DB_PORT=5432
DB_NAME=production_dashboard
DB_USER=postgres
DB_PASSWORD=your_password
```

**Important**: If `NODE_ENV` is not set or is `production`, CORS will only allow configured origins.

### Step 2: Restart Backend Server

After updating `.env`, restart the backend:

```bash
cd backend
npm start
```

You should see in the console:
```
🔧 CORS Configuration:
   NODE_ENV: development
   CORS_ORIGIN: not set (using default)
   CORS allows all origins: true
🌐 CORS: Allowing all origins (development mode)
🚀 Server running on http://0.0.0.0:3001
```

### Step 3: Verify CORS is Working

After restarting backend, check the console logs for incoming requests:

```
📥 GET /api/machines - Origin: http://100.94.207.3:5173
```

If you see the origin logged, CORS middleware is active.

### Step 4: Test API Directly

From the remote machine, test with curl to verify CORS headers:

```bash
curl -v -H "Origin: http://100.94.207.3:5173" \
     -H "Access-Control-Request-Method: GET" \
     -H "Access-Control-Request-Headers: Content-Type" \
     -X OPTIONS \
     http://100.94.207.3:3001/api/machines
```

Expected response headers:
```
Access-Control-Allow-Origin: http://100.94.207.3:5173
Access-Control-Allow-Methods: GET, POST, PUT, PATCH, DELETE, OPTIONS
Access-Control-Allow-Credentials: true
```

### Step 5: Check Browser Network Tab

1. Open browser developer tools (F12)
2. Go to Network tab
3. Make a request from the UI
4. Check the failed request → Headers tab
5. Look for:
   - **Request Headers**: `Origin: http://100.94.207.3:5173`
   - **Response Headers**: Should have `Access-Control-Allow-Origin: http://100.94.207.3:5173`

## Alternative: Explicitly Allow Tailscale Origin

If you want to be explicit (not recommended for development), update `backend/.env`:

```env
NODE_ENV=development
CORS_ORIGIN=http://localhost:5173,http://100.94.207.3:5173
```

Then modify `backend/server.js` to check `CORS_ORIGIN` even in development:

```javascript
const getCorsOrigin = () => {
  // If CORS_ORIGIN is explicitly set, use it even in development
  if (process.env.CORS_ORIGIN) {
    const corsOrigin = process.env.CORS_ORIGIN;
    if (corsOrigin.includes(',')) {
      return corsOrigin.split(',').map(origin => origin.trim());
    }
    return corsOrigin;
  }
  
  // Otherwise, allow all origins in development
  if (process.env.NODE_ENV !== 'production') {
    return true;
  }
  
  return 'http://localhost:5173';
};
```

## Troubleshooting

### Issue: Still seeing CORS errors after restart

**Check:**
1. Backend console shows: `CORS allows all origins: true`
2. Backend console shows incoming requests: `📥 GET /api/machines - Origin: ...`
3. Browser Network tab shows correct `Origin` header
4. No firewall blocking requests

**Solution:**
- Verify `NODE_ENV=development` in `backend/.env`
- Restart backend server
- Clear browser cache and reload
- Check backend console for CORS logs

### Issue: Requests going to localhost instead of Tailscale IP

**Check:**
1. Browser console shows: `Base URL: http://100.94.207.3:3001/api` (not localhost)
2. Network tab shows requests to Tailscale IP (not localhost)

**Solution:**
- If still using localhost, check frontend `.env` file
- Verify `window.location.hostname` is correct (should be `100.94.207.3`)
- Restart frontend dev server

### Issue: Backend not accessible from remote machine

**Check:**
1. Backend is listening on `0.0.0.0:3001` (check server.js)
2. Backend console shows: `Server running on http://0.0.0.0:3001`
3. Can access directly: `curl http://100.94.207.3:3001/health`

**Solution:**
- Verify server.listen uses `'0.0.0.0'` (not `'localhost'`)
- Check firewall allows port 3001
- Verify Tailscale connection is active

## Summary

✅ **Backend CORS is configured to allow all origins in development mode**
✅ **Backend listens on `0.0.0.0:3001` for remote access**
✅ **CORS logging added for debugging**

**Action Required:**
1. Ensure `NODE_ENV=development` in `backend/.env`
2. Restart backend server
3. Check backend console for CORS configuration logs
4. Test from browser - CORS should now work!

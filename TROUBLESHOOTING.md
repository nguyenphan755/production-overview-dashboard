# Troubleshooting: SQL Updates Not Showing in Frontend

## Quick Fix Steps

### ✅ Step 1: Create .env File

The `.env` file has been created automatically. Verify it exists and contains:

```env
VITE_API_BASE_URL=http://localhost:3001/api
VITE_USE_MOCK_DATA=false
VITE_REALTIME_ENABLED=false
```

### ✅ Step 2: Restart Frontend Dev Server

**IMPORTANT:** After creating/updating `.env`, you MUST restart the frontend!

1. Stop the current dev server (Ctrl+C)
2. Start again: `npm run dev`
3. Check console - you should see:
   ```
   🔧 API Configuration:
      Base URL: http://localhost:3001/api
      Using Mock: false
   ```

### ✅ Step 3: Start Backend Server

```bash
cd backend
npm install  # First time only
npm start
```

You should see:
```
🚀 Server running on http://localhost:3001
```

### ✅ Step 4: Test Backend

Open in browser: http://localhost:3001/health

Should return: `{"status":"ok",...}`

### ✅ Step 5: Test API

Open in browser: http://localhost:3001/api/machines

Should return JSON with machine data.

### ✅ Step 6: Update via SQL and Verify

```sql
-- Update machine
UPDATE machines 
SET line_speed = 999,
    last_updated = CURRENT_TIMESTAMP
WHERE id = 'D-01';
```

Wait 5 seconds, then check frontend - you should see the change!

---

## Debugging Checklist

### Check Browser Console (F12)

Look for:
- ✅ `🌐 API Request: http://localhost:3001/api/...` - Using real API
- ✅ `✅ API Success: ...` - API calls working
- ❌ `❌ API Error: ...` - Backend not running or wrong URL
- ❌ `📦 Using MOCK API data` - Still using mock (check .env)

### Check Network Tab

1. Open browser DevTools (F12)
2. Go to **Network** tab
3. Filter by "api" or "machines"
4. You should see requests to `http://localhost:3001/api/machines`
5. Click on a request to see response

### Verify Environment Variables

In browser console, check:
```javascript
console.log(import.meta.env.VITE_USE_MOCK_DATA); // Should be "false"
console.log(import.meta.env.VITE_API_BASE_URL); // Should be "http://localhost:3001/api"
```

---

## Common Problems & Solutions

### Problem 1: Still Shows Mock Data

**Symptoms:**
- Console shows "📦 Using MOCK API data"
- Data doesn't change when updating SQL

**Solution:**
1. Verify `.env` file exists in project root
2. Check `VITE_USE_MOCK_DATA=false` (not `true` or missing)
3. **Restart frontend dev server** (this is critical!)

### Problem 2: Backend Not Running

**Symptoms:**
- Console shows "❌ API Error: Failed to fetch"
- Network tab shows failed requests

**Solution:**
1. Start backend: `cd backend && npm start`
2. Verify it's running: http://localhost:3001/health
3. Check backend terminal for errors

### Problem 3: Database Not Connected

**Symptoms:**
- Backend running but API returns empty data
- Backend shows database errors

**Solution:**
1. Check `backend/.env` file exists
2. Verify PostgreSQL is running
3. Test connection: `psql -U postgres -d production_dashboard`
4. Run seed script: `cd backend && npm run seed`

### Problem 4: CORS Errors

**Symptoms:**
- Browser console shows CORS policy errors

**Solution:**
1. Check `backend/.env` has: `CORS_ORIGIN=http://localhost:5173`
2. Restart backend server

---

## Verification Test

Run this complete test:

```bash
# 1. Update via SQL
psql -U postgres -d production_dashboard -c "UPDATE machines SET line_speed = 999 WHERE id = 'D-01';"

# 2. Wait 5 seconds

# 3. Check API
curl http://localhost:3001/api/machines | findstr "D-01"

# 4. Check frontend - should show line_speed = 999
```

---

## Still Not Working?

1. **Check all logs:**
   - Browser console (F12)
   - Backend terminal
   - Frontend terminal

2. **Verify setup:**
   - `.env` file exists and correct
   - Backend running on port 3001
   - Database connected
   - Frontend restarted after .env change

3. **Test each component:**
   - Database: `SELECT * FROM machines WHERE id = 'D-01';`
   - Backend API: http://localhost:3001/api/machines
   - Frontend: Check Network tab for API calls

For more details, see `FRONTEND_DATABASE_CONNECTION.md`


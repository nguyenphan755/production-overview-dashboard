# Frontend Database Connection - Troubleshooting Guide

## Problem: SQL Updates Not Showing in Frontend

If you update data via SQL but don't see changes in the frontend, follow these steps:

---

## Step 1: Create .env File

**The frontend is currently using mock data because no `.env` file exists.**

Create a `.env` file in the **project root** (same folder as `package.json`):

```env
VITE_API_BASE_URL=http://localhost:3001/api
VITE_USE_MOCK_DATA=false
VITE_REALTIME_ENABLED=false
```

**Important:** After creating `.env`, you MUST restart the frontend dev server!

---

## Step 2: Verify Backend is Running

The backend API server must be running on port 3001.

### Check if Backend is Running

```bash
# Check if port 3001 is in use
netstat -ano | findstr :3001
```

### Start Backend Server

```bash
cd backend
npm install  # If not already installed
npm start
```

You should see:
```
🚀 Server running on http://localhost:3001
📊 API endpoints available at http://localhost:3001/api
💚 Health check: http://localhost:3001/health
```

### Test Backend Connection

Open in browser: http://localhost:3001/health

Should return: `{"status":"ok",...}`

---

## Step 3: Verify Database Connection

### Check Database is Accessible

```bash
psql -U postgres -d production_dashboard -c "SELECT COUNT(*) FROM machines;"
```

### Verify Data Exists

```sql
SELECT id, name, status, line_speed, last_updated 
FROM machines 
ORDER BY last_updated DESC 
LIMIT 5;
```

---

## Step 4: Test API Endpoint

### Test API Directly

Open in browser: http://localhost:3001/api/machines

Should return JSON with machine data.

### Test with cURL

```bash
curl http://localhost:3001/api/machines
```

---

## Step 5: Restart Frontend

**After creating `.env` file, you MUST restart:**

1. Stop frontend (Ctrl+C in terminal)
2. Start again: `npm run dev`
3. Open: http://localhost:5173

---

## Step 6: Verify Frontend is Using Real API

### Check Browser Console

1. Open http://localhost:5173
2. Press F12 (Developer Tools)
3. Go to **Network** tab
4. Look for requests to `http://localhost:3001/api/machines`
5. If you see requests to `localhost:3001`, frontend is using real API ✅
6. If no requests or errors, check `.env` file

### Check for Errors

In browser console, look for:
- ❌ `Failed to fetch` - Backend not running
- ❌ `Network error` - Backend not accessible
- ❌ `404 Not Found` - Wrong API URL

---

## Step 7: Test SQL Update

### Update via SQL

```sql
UPDATE machines 
SET line_speed = 999,
    last_updated = CURRENT_TIMESTAMP
WHERE id = 'D-01';
```

### Wait 5 Seconds

The frontend polls every 5 seconds, so wait up to 5 seconds.

### Check Frontend

Refresh the page or wait - you should see `line_speed = 999` for D-01.

---

## Troubleshooting Checklist

- [ ] `.env` file exists in project root
- [ ] `.env` has `VITE_USE_MOCK_DATA=false`
- [ ] Frontend dev server restarted after creating `.env`
- [ ] Backend server running on port 3001
- [ ] Backend health check works: http://localhost:3001/health
- [ ] Database connection works
- [ ] API endpoint works: http://localhost:3001/api/machines
- [ ] Browser console shows no errors
- [ ] Network tab shows requests to `localhost:3001`

---

## Common Issues

### Issue 1: Still Using Mock Data

**Symptom:** Data doesn't change, shows same values

**Solution:**
1. Check `.env` file exists
2. Verify `VITE_USE_MOCK_DATA=false`
3. **Restart frontend dev server**

### Issue 2: Backend Not Running

**Symptom:** Browser console shows "Failed to fetch" or network errors

**Solution:**
1. Start backend: `cd backend && npm start`
2. Verify it's running on port 3001
3. Test: http://localhost:3001/health

### Issue 3: Database Connection Error

**Symptom:** Backend shows database errors

**Solution:**
1. Check `backend/.env` file exists
2. Verify PostgreSQL is running
3. Test connection: `psql -U postgres -d production_dashboard`

### Issue 4: CORS Errors

**Symptom:** Browser console shows CORS errors

**Solution:**
1. Check `backend/.env` has: `CORS_ORIGIN=http://localhost:5173`
2. Restart backend server

---

## Quick Fix Commands

```bash
# 1. Create .env file (Windows PowerShell)
@"
VITE_API_BASE_URL=http://localhost:3001/api
VITE_USE_MOCK_DATA=false
VITE_REALTIME_ENABLED=false
"@ | Out-File -FilePath .env -Encoding utf8

# 2. Start backend
cd backend
npm start

# 3. Restart frontend (in new terminal)
npm run dev
```

---

## Verification Steps

1. **Backend running?** → http://localhost:3001/health
2. **API working?** → http://localhost:3001/api/machines
3. **Frontend connected?** → Check browser Network tab
4. **Data updating?** → Update SQL, wait 5 seconds, check frontend

---

## Still Not Working?

1. Check browser console for errors
2. Check backend terminal for errors
3. Verify all environment variables are set
4. Make sure both servers are running
5. Check firewall isn't blocking port 3001


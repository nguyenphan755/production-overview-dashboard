# Fix: Frontend Not Updating After SQL Changes

## Problem

You update data in PostgreSQL, but the frontend at localhost:5173 doesn't show the changes.

---

## Root Cause

The frontend is still using **mock data** instead of the real API because the `.env` file is missing.

---

## Solution

### Step 1: Create `.env` File

The `.env` file has been created automatically. It contains:

```env
VITE_API_BASE_URL=http://localhost:3001/api
VITE_USE_MOCK_DATA=false
VITE_REALTIME_ENABLED=false
```

### Step 2: Restart Frontend Dev Server

**CRITICAL:** After creating/updating `.env`, you MUST restart the frontend!

1. **Stop the frontend** (Ctrl+C in the terminal)
2. **Start again:**
   ```bash
   npm run dev
   ```

### Step 3: Verify It's Working

1. **Check browser console (F12):**
   - Should see: `🔧 API Configuration:`
   - Should see: `Using Mock: false`
   - Should see: `🌐 API Request: http://localhost:3001/api/...`
   - Should see: `✅ API Success: ...`
   - Should see: `🔄 Polling for machine updates...` every 3 seconds

2. **Check Network tab:**
   - Should see requests to `http://localhost:3001/api/machines`
   - Should see responses with updated data

3. **Test SQL update:**
   ```sql
   UPDATE machines 
   SET line_speed = 999,
       last_updated = CURRENT_TIMESTAMP
   WHERE id = 'D-01';
   ```
   - Wait 3 seconds
   - Check frontend - should see `line_speed = 999`

---

## Why This Happens

- Vite (the frontend build tool) reads `.env` file **only on startup**
- If `.env` is missing, it defaults to mock data
- **Restart is required** for `.env` changes to take effect

---

## Verification Checklist

- [ ] `.env` file exists in project root
- [ ] `.env` has `VITE_USE_MOCK_DATA=false`
- [ ] Frontend dev server restarted after creating `.env`
- [ ] Browser console shows "Using Mock: false"
- [ ] Network tab shows requests to `localhost:3001`
- [ ] Backend is running on port 3001
- [ ] Backend connected to PostgreSQL

---

## Still Not Working?

1. **Check browser console:**
   - Look for `📦 Using MOCK API data` - means still using mock
   - Look for `🌐 API Request` - means using real API ✅

2. **Check Network tab:**
   - Should see requests to `http://localhost:3001/api/machines`
   - Click on a request → Response tab → Should see JSON data

3. **Verify backend is returning updated data:**
   - Open: http://localhost:3001/api/machines
   - Check if the updated values are in the JSON response

4. **Check polling:**
   - Browser console should show `🔄 Polling for machine updates...` every 3 seconds
   - If not, refresh the page

---

## Quick Test

1. **Update SQL:**
   ```sql
   UPDATE machines SET line_speed = 888 WHERE id = 'D-01';
   ```

2. **Wait 3 seconds**

3. **Check frontend:**
   - Should show `line_speed = 888` for D-01

4. **Check browser console:**
   - Should see polling messages
   - Should see API success messages

---

## Summary

- ✅ `.env` file created
- ⚠️ **Restart frontend now!**
- ✅ Polling every 3 seconds (faster for testing)
- ✅ Debug logging enabled

**After restarting, the frontend will poll the API every 3 seconds and show updated data automatically!**


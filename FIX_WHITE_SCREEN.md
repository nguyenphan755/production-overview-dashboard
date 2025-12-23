# Fix: White Screen on localhost:5173

## Problem

After refreshing, you see a white screen instead of the dashboard.

---

## Quick Fixes

### Step 1: Check Browser Console (F12)

Open browser console and look for errors:
- Red error messages
- Failed API requests
- JavaScript errors

### Step 2: Check Backend is Running

```bash
# Test backend
curl http://localhost:3001/health
```

Or open: http://localhost:3001/health

Should return: `{"status":"ok",...}`

### Step 3: Check Frontend Terminal

Look for errors in the terminal where `npm run dev` is running:
- Build errors
- Module not found errors
- TypeScript errors

### Step 4: Clear Browser Cache

1. Press `Ctrl+Shift+R` (hard refresh)
2. Or `Ctrl+F5`
3. Or clear browser cache

### Step 5: Restart Frontend

```bash
# Stop frontend (Ctrl+C)
# Then restart
npm run dev
```

---

## Common Causes

### Cause 1: Backend Not Running

**Symptom:** Console shows "Failed to fetch" errors

**Fix:**
```bash
cd backend
npm start
```

### Cause 2: API Errors

**Symptom:** Console shows API errors

**Fix:**
- Check backend is running
- Check `backend/.env` has correct database password
- Check database connection

### Cause 3: Environment Variables

**Symptom:** Still using mock data or wrong API URL

**Fix:**
- Check `.env` file exists in project root
- Verify `VITE_USE_MOCK_DATA=false`
- Restart frontend after changing `.env`

### Cause 4: JavaScript Errors

**Symptom:** Console shows syntax errors or runtime errors

**Fix:**
- Check browser console for specific error
- Fix the error in the code
- Restart frontend

---

## Debug Steps

1. **Open Browser Console (F12)**
   - Look for red errors
   - Check Network tab for failed requests

2. **Check Frontend Terminal**
   - Look for build errors
   - Check if dev server started successfully

3. **Test Backend**
   - http://localhost:3001/health
   - http://localhost:3001/api/machines

4. **Check .env Files**
   - Frontend `.env` exists?
   - Backend `backend/.env` exists?
   - Both have correct values?

---

## Quick Test

1. **Hard refresh:** `Ctrl+Shift+R`
2. **Check console:** F12 → Console tab
3. **Check network:** F12 → Network tab → Look for errors
4. **Restart frontend:** Stop and start `npm run dev`

---

## Still White Screen?

1. **Check console errors** - What specific error is shown?
2. **Check backend** - Is it running?
3. **Check .env** - Are environment variables set?
4. **Clear cache** - Hard refresh the page
5. **Restart everything** - Both frontend and backend

Share the console error message for more specific help!


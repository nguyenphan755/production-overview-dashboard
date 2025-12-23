# Debug: White Screen on localhost:5173

## Backend Status ✅

Backend is running correctly:
- Health check: http://localhost:3001/health ✅
- API should be accessible

---

## Steps to Debug

### Step 1: Open Browser Console (F12)

**This is the most important step!**

1. Open http://localhost:5173
2. Press **F12** to open Developer Tools
3. Go to **Console** tab
4. Look for:
   - ❌ Red error messages
   - ✅ "App rendered successfully" message
   - 🔧 API Configuration messages
   - 🌐 API Request messages

**Share what you see in the console!**

### Step 2: Check Network Tab

1. Press **F12** → **Network** tab
2. Refresh the page (F5)
3. Look for:
   - Requests to `localhost:3001/api/...`
   - Failed requests (red)
   - Status codes (200 = success, 4xx/5xx = error)

### Step 3: Check Frontend Terminal

Look at the terminal where `npm run dev` is running:
- Are there any errors?
- Does it say "Local: http://localhost:5173"?
- Any TypeScript errors?

### Step 4: Verify Files

Check if these files exist:
- ✅ `index.html` (should have `<div id="root"></div>`)
- ✅ `src/main.tsx` (entry point)
- ✅ `src/App.tsx` (main component)
- ✅ `.env` file in project root

---

## Common Issues & Fixes

### Issue 1: JavaScript Error

**Symptom:** Console shows red error

**Fix:** 
- Check the error message
- Fix the code issue
- Restart frontend

### Issue 2: API Connection Failed

**Symptom:** Console shows "Failed to fetch" or network errors

**Fix:**
1. Check backend is running: http://localhost:3001/health
2. Check `.env` file has correct API URL
3. Restart frontend after changing `.env`

### Issue 3: Module Not Found

**Symptom:** Console shows "Cannot find module" errors

**Fix:**
```bash
npm install
npm run dev
```

### Issue 4: CORS Error

**Symptom:** Console shows CORS policy errors

**Fix:**
- Check `backend/.env` has: `CORS_ORIGIN=http://localhost:5173`
- Restart backend

---

## Quick Test

1. **Hard refresh:** `Ctrl+Shift+R`
2. **Check console:** F12 → Console tab
3. **Check network:** F12 → Network tab
4. **Check terminal:** Look at `npm run dev` output

---

## What to Share

If still white screen, please share:

1. **Browser console errors** (F12 → Console)
2. **Network tab** - Any failed requests?
3. **Frontend terminal** - Any errors?
4. **Backend terminal** - Is it running?

This will help identify the exact issue!

---

## Added Error Handling

I've added better error handling that will:
- Show error messages instead of white screen
- Log errors to console
- Display a reload button if error occurs

Try refreshing the page and check the console!


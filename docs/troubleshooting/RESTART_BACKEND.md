# Restart Backend to See Changes

## Quick Steps:

1. **Stop the current backend server:**
   - Go to the terminal where backend is running
   - Press `Ctrl+C` to stop it

2. **Restart the backend:**
   ```powershell
   cd backend
   npm run dev
   ```

3. **Hard refresh your browser:**
   - Press `Ctrl+F5` or `Ctrl+Shift+R`
   - Or open DevTools (F12) → Right-click refresh button → "Empty Cache and Hard Reload"

## What Changed:

✅ **Backend** now returns `allMachines` field with ALL machines in each area (sorted by ID)

✅ **Frontend** displays:
   - All machines (not just top 3)
   - Status indicators: 
     - 🟢 Green = Running
     - 🟡 Yellow = Idle/Warning  
     - 🔴 Red = Stopped/Error
   - Speed shows `0` for stopped/error machines
   - Always 10 lines (with placeholders for empty slots)

## Verify It's Working:

1. Check browser console (F12) - should see API calls to `/api/areas`
2. Check Network tab - response should include `allMachines` array
3. Area cards should show "ALL MACHINES" instead of "TOP MACHINES"
4. You should see colored status indicators (green/yellow/red dots)


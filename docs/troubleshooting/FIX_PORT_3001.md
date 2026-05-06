# Fix: Port 3001 Already in Use

## Problem

Error: `EADDRINUSE: address already in use :::3001`

This means another process is already using port 3001.

---

## Quick Fix

### Option 1: Kill the Process (Automatic)

The process has been killed automatically. Now restart:

```bash
cd backend
npm start
```

### Option 2: Kill Manually (If needed)

**Windows PowerShell:**
```powershell
# Find process using port 3001
netstat -ano | findstr :3001

# Kill the process (replace PID with actual process ID)
taskkill /F /PID <PID>
```

**Example:**
```powershell
# If PID is 45660
taskkill /F /PID 45660
```

### Option 3: Change Port (Alternative)

If you want to use a different port, edit `backend/.env`:

```env
PORT=3002
```

Then update frontend `.env`:
```env
VITE_API_BASE_URL=http://localhost:3002/api
```

---

## Verify Port is Free

```powershell
netstat -ano | findstr :3001
```

Should return nothing (port is free).

---

## Restart Backend

After killing the process:

```bash
cd backend
npm start
```

You should see:
```
✅ Connected to PostgreSQL database
🚀 Server running on http://localhost:3001
```

---

## Prevent This in Future

1. **Always stop backend properly** - Use Ctrl+C
2. **Check if running** - Before starting, check port 3001
3. **Use different port** - If needed, change PORT in `.env`


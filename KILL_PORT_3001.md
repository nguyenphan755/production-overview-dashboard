# Quick Fix: Port 3001 Already in Use

## Problem

Error: `EADDRINUSE: address already in use :::3001`

This means another process is using port 3001.

---

## Quick Fix (Automatic)

The process has been killed automatically. Now restart:

```bash
cd backend
npm run dev
```

---

## Manual Fix (If Needed)

### Windows PowerShell:

```powershell
# Find process using port 3001
netstat -ano | findstr :3001

# Kill the process (replace PID with actual process ID)
taskkill /F /PID <PID>
```

### Example:

```powershell
# If PID is 12345
taskkill /F /PID 12345
```

---

## Alternative: Use Different Port

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
npm run dev
```

You should see:
```
✅ Connected to PostgreSQL database
🚀 Server running on http://localhost:3001
```

---

## Prevent This

1. **Always stop backend properly** - Use Ctrl+C
2. **Check before starting** - Make sure no other instance is running
3. **Use task manager** - End Node.js processes if needed


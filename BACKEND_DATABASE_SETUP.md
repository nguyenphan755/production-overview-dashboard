# Backend Database Setup - Fix PostgreSQL Connection Error

## Error: "client password must be a string"

This error means the backend cannot connect to PostgreSQL because the database password is missing or incorrect.

---

## Quick Fix

### Step 1: Create `backend/.env` File

Create a file named `.env` in the `backend` folder with your PostgreSQL credentials:

```env
DB_HOST=localhost
DB_PORT=5432
DB_NAME=production_dashboard
DB_USER=postgres
DB_PASSWORD=your_actual_postgres_password
PORT=3001
CORS_ORIGIN=http://localhost:5173
```

**Important:** Replace `your_actual_postgres_password` with your real PostgreSQL password!

### Step 2: Find Your PostgreSQL Password

If you don't know your PostgreSQL password:

#### Option A: Check if you have a password set
```bash
# Try connecting without password
psql -U postgres -d production_dashboard
```

If it asks for a password, you have one set.

#### Option B: Reset PostgreSQL Password (if needed)

1. **Windows (using pgAdmin):**
   - Open pgAdmin
   - Right-click on PostgreSQL server → Properties
   - Go to Connection tab to see/change password

2. **Windows (using psql):**
   ```bash
   # Connect as postgres user
   psql -U postgres
   
   # Change password
   ALTER USER postgres WITH PASSWORD 'new_password';
   ```

3. **If you forgot the password:**
   - Edit `C:\Program Files\PostgreSQL\[version]\data\pg_hba.conf`
   - Change `md5` to `trust` for local connections
   - Restart PostgreSQL service
   - Connect and set new password
   - Change back to `md5` and restart

### Step 3: Update `backend/.env`

Edit `backend/.env` and set your actual password:

```env
DB_PASSWORD=your_actual_password_here
```

### Step 4: Restart Backend Server

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

## Verify Database Connection

### Test 1: Direct PostgreSQL Connection

```bash
psql -U postgres -d production_dashboard
```

If this works, use the same password in `backend/.env`.

### Test 2: Test Backend Connection

```bash
cd backend
node -e "require('dotenv').config(); console.log('DB_PASSWORD:', process.env.DB_PASSWORD ? 'Set' : 'Missing');"
```

Should output: `DB_PASSWORD: Set`

### Test 3: Test API

Open: http://localhost:3001/health

Should return: `{"status":"ok",...}`

---

## Common Issues

### Issue 1: Password Contains Special Characters

If your password has special characters, make sure to:
- Wrap in quotes if needed
- Escape special characters properly
- Or use a simpler password for testing

### Issue 2: Password is Empty String

Make sure `DB_PASSWORD` is not empty:
```env
# ❌ Wrong
DB_PASSWORD=

# ✅ Correct
DB_PASSWORD=your_password
```

### Issue 3: Wrong Database Name

Verify the database exists:
```sql
-- List databases
\l

-- Create if missing
CREATE DATABASE production_dashboard;
```

### Issue 4: PostgreSQL Not Running

Check if PostgreSQL service is running:
```bash
# Windows
Get-Service -Name postgresql*

# Start if stopped
Start-Service -Name postgresql-x64-[version]
```

---

## Complete Setup Checklist

- [ ] PostgreSQL is installed and running
- [ ] Database `production_dashboard` exists
- [ ] You know your PostgreSQL password
- [ ] `backend/.env` file exists
- [ ] `backend/.env` has correct `DB_PASSWORD`
- [ ] Backend server restarted after creating `.env`
- [ ] Backend shows "✅ Connected to PostgreSQL database"
- [ ] API health check works: http://localhost:3001/health

---

## Quick Setup Script

For Windows PowerShell:

```powershell
# 1. Create backend/.env
@"
DB_HOST=localhost
DB_PORT=5432
DB_NAME=production_dashboard
DB_USER=postgres
DB_PASSWORD=YOUR_PASSWORD_HERE
PORT=3001
CORS_ORIGIN=http://localhost:5173
"@ | Out-File -FilePath backend\.env -Encoding utf8

# 2. Edit the file and replace YOUR_PASSWORD_HERE with your actual password
notepad backend\.env

# 3. Test connection
cd backend
npm start
```

---

## Still Having Issues?

1. **Check backend terminal** - Look for connection errors
2. **Verify PostgreSQL is running** - Check Windows Services
3. **Test direct connection** - `psql -U postgres`
4. **Check password** - Make sure it's correct in `.env`
5. **Restart backend** - After changing `.env`

For more help, see `QUICK_START.md` or `POSTGRESQL_SETUP.md`


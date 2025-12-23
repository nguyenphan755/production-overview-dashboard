# Why Are There 2 .env Files? ✅

## This is CORRECT and NORMAL! 

You need **2 separate `.env` files** because:

1. **Frontend** (React/Vite) uses `.env` in the **project root**
2. **Backend** (Node.js/Express) uses `.env` in the **backend/** folder

---

## File Structure

```
Production Overview Dashboard NEW/
├── .env                    ← Frontend configuration (Vite)
├── backend/
│   └── .env               ← Backend configuration (Node.js)
└── ...
```

---

## Why Two Files?

### 1. Frontend `.env` (Project Root)

**Location:** `.env` (in project root)

**Used by:** Vite (frontend build tool)

**Purpose:** Frontend configuration

**Variables:**
```env
VITE_API_BASE_URL=http://localhost:3001/api
VITE_USE_MOCK_DATA=false
VITE_REALTIME_ENABLED=true
```

**Why:** Vite only reads `.env` files from the project root, and variables must start with `VITE_` to be exposed to the browser.

---

### 2. Backend `.env` (backend/ folder)

**Location:** `backend/.env`

**Used by:** Node.js backend server

**Purpose:** Backend configuration (database, server, secrets)

**Variables:**
```env
DB_HOST=localhost
DB_PORT=5432
DB_NAME=mes_db
DB_USER=postgres
DB_PASSWORD=root
PORT=3001
JWT_SECRET=your-secret-key
```

**Why:** Node.js `dotenv` reads from the current working directory. When you run `npm start` in the `backend/` folder, it looks for `.env` in that folder.

---

## How They Work Together

```
Frontend (.env)
    ↓
    VITE_API_BASE_URL=http://localhost:3001/api
    ↓
    Frontend connects to → Backend API
                              ↓
                         Backend (backend/.env)
                              ↓
                         DB_PASSWORD=root
                              ↓
                         Connects to → PostgreSQL
```

---

## Quick Check

### Check Frontend .env
```powershell
# In project root
Get-Content .env
```

**Should contain:**
- `VITE_API_BASE_URL`
- `VITE_USE_MOCK_DATA`
- `VITE_REALTIME_ENABLED`

### Check Backend .env
```powershell
# In backend folder
Get-Content backend\.env
```

**Should contain:**
- `DB_HOST`
- `DB_PASSWORD`
- `PORT`
- `JWT_SECRET`

---

## If You're Missing One

### Create Frontend .env (Project Root)

```powershell
# In project root (not in backend folder)
@"
VITE_API_BASE_URL=http://localhost:3001/api
VITE_USE_MOCK_DATA=false
VITE_REALTIME_ENABLED=true
"@ | Out-File -FilePath .env -Encoding utf8
```

### Create Backend .env

```powershell
# In backend folder
cd backend
@"
DB_HOST=localhost
DB_PORT=5432
DB_NAME=mes_db
DB_USER=postgres
DB_PASSWORD=root
PORT=3001
NODE_ENV=development
CORS_ORIGIN=http://localhost:5173
JWT_SECRET=your-secret-key-change-in-production
"@ | Out-File -FilePath .env -Encoding utf8
```

---

## Common Mistakes

### ❌ Wrong: One .env file for both
- Frontend can't read backend secrets
- Backend can't find its .env file
- Security risk (exposing secrets to frontend)

### ✅ Correct: Two separate .env files
- Frontend has its own config
- Backend has its own config
- Proper separation of concerns

---

## Summary

| File | Location | Used By | Purpose |
|------|----------|---------|---------|
| `.env` | Project root | Frontend (Vite) | Frontend configuration |
| `backend/.env` | backend/ folder | Backend (Node.js) | Backend configuration |

**✅ Having 2 `.env` files is CORRECT and REQUIRED!**

---

## Security Note

- **Frontend `.env`** - Variables are exposed to the browser (must start with `VITE_`)
- **Backend `.env`** - Variables are server-side only (never exposed to browser)

**Never put secrets in frontend `.env`!**

Only put:
- API URLs
- Feature flags
- Public configuration

Keep passwords, tokens, and secrets in `backend/.env` only!


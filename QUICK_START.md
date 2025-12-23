# Quick Start Guide - PostgreSQL Integration

## Step-by-Step Setup

### 1. Install Backend Dependencies

```bash
cd backend
npm install
```

### 2. Create PostgreSQL Database

Connect to PostgreSQL (using psql or pgAdmin) and run:

```sql
CREATE DATABASE production_dashboard;
```

### 3. Configure Backend Environment

Create `backend/.env` file:

```env
DB_HOST=localhost
DB_PORT=5432
DB_NAME=production_dashboard
DB_USER=postgres
DB_PASSWORD=your_postgres_password
PORT=3001
CORS_ORIGIN=http://localhost:5173
```

**Replace `your_postgres_password` with your actual PostgreSQL password.**

### 4. Setup Database Schema

```bash
cd backend
npm run setup-db
```

This creates all tables, indexes, and triggers.

### 5. (Optional) Seed Sample Data

```bash
cd backend
npm run seed
```

This inserts sample machines and orders for testing.

### 6. Start Backend Server

```bash
cd backend
npm start
```

You should see:
```
🚀 Server running on http://localhost:3001
📊 API endpoints available at http://localhost:3001/api
💚 Health check: http://localhost:3001/health
```

### 7. Update Frontend Configuration

Create or update `.env` in the **project root** (not backend folder):

```env
VITE_API_BASE_URL=http://localhost:3001/api
VITE_USE_MOCK_DATA=false
```

### 8. Restart Frontend

Stop the frontend dev server (Ctrl+C) and restart:

```bash
npm run dev
```

## Verify Connection

1. **Test Backend API:**
   - Open: http://localhost:3001/health
   - Should return: `{"status":"ok",...}`

2. **Test API Endpoint:**
   - Open: http://localhost:3001/api/kpis/global
   - Should return JSON with KPIs

3. **Check Frontend:**
   - Open: http://localhost:5173
   - Dashboard should load data from PostgreSQL

## Troubleshooting

### Database Connection Error

- Verify PostgreSQL is running
- Check credentials in `backend/.env`
- Test connection: `psql -U postgres -d production_dashboard`

### API Not Responding

- Check backend server is running on port 3001
- Verify CORS settings in `backend/.env`
- Check browser console for errors

### Frontend Shows No Data

- Verify `VITE_USE_MOCK_DATA=false` in frontend `.env`
- Check `VITE_API_BASE_URL` is correct
- Restart frontend dev server after changing `.env`

## Next Steps

- Insert your real production data into the database
- Set up automated data collection from PLCs/Node-RED
- Configure real-time updates (WebSocket/SSE)


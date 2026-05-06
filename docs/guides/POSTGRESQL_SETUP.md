# PostgreSQL Database Setup Guide

## Quick Setup Steps

### 1. Create Database

Connect to PostgreSQL and create the database:

```sql
CREATE DATABASE production_dashboard;
```

### 2. Install Backend Dependencies

```bash
cd backend
npm install
```

### 3. Configure Environment

Create `backend/.env` file:

```env
DB_HOST=localhost
DB_PORT=5432
DB_NAME=production_dashboard
DB_USER=postgres
DB_PASSWORD=your_actual_password
PORT=3001
CORS_ORIGIN=http://localhost:5173
```

### 4. Run Database Schema

```bash
cd backend
npm run setup-db
```

This will create all tables, indexes, and triggers.

### 5. Start Backend Server

```bash
cd backend
npm start
```

The API will be available at `http://localhost:3001/api`

### 6. Update Frontend Configuration

Create or update `.env` in the project root:

```env
VITE_API_BASE_URL=http://localhost:3001/api
VITE_USE_MOCK_DATA=false
```

### 7. Restart Frontend

The frontend will now use the PostgreSQL database instead of mock data.

## Database Schema

The database includes:

- **machines** - Machine master data with status, speeds, OEE metrics
- **production_orders** - Production order information
- **alarms** - Machine alarms and notifications
- **machine_metrics** - Time-series data (speed, temperature, current, power)
- **energy_consumption** - Energy consumption tracking

## Inserting Sample Data

You can insert sample data using SQL. Example:

```sql
-- Insert a machine
INSERT INTO machines (id, name, area, status, line_speed, target_speed, operator_name)
VALUES ('D-01', 'Drawing Line 01', 'drawing', 'running', 920, 1000, 'Nguyễn Văn An');

-- Insert a production order
INSERT INTO production_orders (id, name, product_name, customer, machine_id, start_time, target_length, status)
VALUES ('PO-2024-156', 'PO-2024-156', 'CV 3x2.5mm²', 'Công ty ABC', 'D-01', NOW(), 5000, 'running');
```

## Troubleshooting

### Connection Issues

- Verify PostgreSQL is running: `pg_isready`
- Check database credentials in `.env`
- Ensure database exists: `\l` in psql

### Schema Issues

- Drop and recreate: `DROP DATABASE production_dashboard; CREATE DATABASE production_dashboard;`
- Re-run setup: `npm run setup-db`

### Port Conflicts

- Change `PORT` in `backend/.env` if 3001 is in use
- Update `VITE_API_BASE_URL` in frontend `.env` accordingly


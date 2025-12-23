# Production Dashboard Backend API

Backend API server for Production Overview Dashboard with PostgreSQL database.

## Setup

### 1. Install Dependencies

```bash
cd backend
npm install
```

### 2. Configure Database

Create a `.env` file in the `backend` directory:

```env
# Database Configuration
DB_HOST=localhost
DB_PORT=5432
DB_NAME=production_dashboard
DB_USER=postgres
DB_PASSWORD=your_password

# Server Configuration
PORT=3001
NODE_ENV=development

# CORS
CORS_ORIGIN=http://localhost:5173
```

### 3. Create Database

```sql
CREATE DATABASE production_dashboard;
```

### 4. Run Database Schema

```bash
npm run setup-db
```

This will create all necessary tables, indexes, and triggers.

### 5. Start Server

```bash
npm start
```

For development with auto-reload:
```bash
npm run dev
```

## API Endpoints

All endpoints are prefixed with `/api`:

- `GET /api/kpis/global` - Get global KPIs
- `GET /api/areas` - Get all production areas
- `GET /api/areas/:areaId` - Get single area
- `GET /api/machines` - Get all machines
- `GET /api/machines?area=drawing` - Get machines by area
- `GET /api/machines/:machineId` - Get machine detail
- `GET /api/machines/:machineId/orders` - Get machine orders
- `GET /api/orders` - Get all orders
- `GET /api/orders/:orderId` - Get single order

## Database Schema

The database includes:

- `machines` - Machine master data
- `production_orders` - Production order information
- `alarms` - Machine alarms
- `machine_metrics` - Time-series metrics (speed, temperature, current, power)
- `energy_consumption` - Energy consumption data

## Inserting Sample Data

You can insert sample data using SQL or create a seed script. Example:

```sql
INSERT INTO machines (id, name, area, status, line_speed, target_speed) 
VALUES ('D-01', 'Drawing Line 01', 'drawing', 'running', 920, 1000);
```

## Frontend Integration

Update your frontend `.env` file:

```env
VITE_API_BASE_URL=http://localhost:3001/api
VITE_USE_MOCK_DATA=false
```

Then restart your frontend dev server.


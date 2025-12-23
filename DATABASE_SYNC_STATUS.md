# PostgreSQL Database Synchronization Status

## ✅ Confirmation: MES System Data

**YES - All values in this project are intended for the MES (Manufacturing Execution System) system.**

The project includes:

### MES System Components:
1. **Production Areas:**
   - Drawing (8 machines)
   - Stranding (5 machines)
   - Armoring (3 machines)
   - Sheathing (6 machines)
   - **Total: 20 machines**

2. **Database Tables:**
   - `machines` - Machine master data with OEE metrics
   - `production_orders` - Production order tracking
   - `alarms` - Machine alarms and notifications
   - `machine_metrics` - Time-series data (speed, temperature, current, power)
   - `energy_consumption` - Energy tracking

3. **MES Data Includes:**
   - Machine status (running, idle, warning, error, stopped, setup)
   - Line speeds and production metrics
   - OEE (Overall Equipment Effectiveness)
   - Production orders with customer information
   - Real-time machine metrics
   - Alarm management
   - Energy consumption tracking

---

## ⚠️ PostgreSQL Synchronization Status

### Current Status: **NOT YET VERIFIED**

To verify if your PostgreSQL database is synchronized, you need to:

### Step 1: Check Database Connection

```powershell
# Test if PostgreSQL is running
Get-Service -Name postgresql*

# Test database connection (replace with your password)
psql -U postgres -d production_dashboard
```

### Step 2: Verify Database Schema Exists

Connect to PostgreSQL and check if tables exist:

```sql
-- Connect to database
\c production_dashboard

-- List all tables
\dt

-- Should show:
-- machines
-- production_orders
-- alarms
-- machine_metrics
-- energy_consumption
```

### Step 3: Check if Data Exists

```sql
-- Count machines
SELECT COUNT(*) FROM machines;

-- Count production orders
SELECT COUNT(*) FROM production_orders;

-- Should return counts > 0 if data is synchronized
```

---

## 🔧 Setup Database (If Not Synchronized)

If the database is NOT set up yet, follow these steps:

### Option A: Quick Setup Script

```powershell
# 1. Navigate to backend
cd backend

# 2. Create database schema
npm run setup-db

# 3. Seed sample MES data
npm run seed
```

### Option B: Manual Setup

1. **Create Database:**
   ```sql
   CREATE DATABASE production_dashboard;
   ```

2. **Run Schema:**
   ```powershell
   cd backend
   npm run setup-db
   ```

3. **Seed Data:**
   ```powershell
   npm run seed
   ```

This will insert:
- ✅ 20 machines (Drawing, Stranding, Armoring, Sheathing)
- ✅ Production orders
- ✅ Alarms
- ✅ Time-series metrics
- ✅ Energy consumption data

---

## ✅ Verification Checklist

Before proceeding with GitHub, verify:

- [ ] PostgreSQL is installed and running
- [ ] Database `production_dashboard` exists
- [ ] `backend/.env` file exists with correct credentials
- [ ] Database schema is created (tables exist)
- [ ] Sample data is seeded (machines, orders, etc.)
- [ ] Backend server can connect to database
- [ ] API endpoints return data from PostgreSQL

---

## 🚀 Next Steps

**Once database is verified/synchronized:**

1. ✅ Git repository is already initialized
2. ✅ Initial commit is created
3. ✅ Ready to push to GitHub

**To verify database status, run:**

```powershell
cd backend
npm run setup-db  # Creates schema if missing
npm run seed      # Seeds data if missing
npm start         # Test connection
```

---

## 📝 Important Notes

- **`.env` files are NOT committed to Git** (protected by `.gitignore`)
- Database credentials stay local
- Only code and schema files are version controlled
- Sample data can be re-seeded anytime using `npm run seed`

---

## 📝 Guide: How to INSERT Machines into PostgreSQL

This guide shows you how to add new machines to any production area (group) in the `machines` table.

---

### 📋 Required Fields

When inserting a machine, you **MUST** provide:

- `id` - Machine ID (VARCHAR(50), PRIMARY KEY) - Must be unique
- `name` - Machine display name (VARCHAR(255), NOT NULL)
- `area` - Production area (ENUM: 'drawing', 'stranding', 'armoring', 'sheathing')
- `status` - Machine status (ENUM: 'running', 'idle', 'warning', 'error', 'stopped', 'setup')

---

### ✅ Optional Fields

These fields have default values or can be NULL:

- `line_speed` - Current line speed (DECIMAL, default: 0)
- `target_speed` - Target line speed (DECIMAL, default: 0)
- `produced_length` - Produced length in meters (DECIMAL, default: 0)
- `target_length` - Target length in meters (DECIMAL, nullable)
- `production_order_id` - Current production order ID (VARCHAR(100), nullable)
- `production_order_name` - Production order name (VARCHAR(255), nullable)
- `operator_name` - Operator name (VARCHAR(255), nullable)
- `oee` - Overall Equipment Effectiveness (DECIMAL(5,2), nullable, 0-100)
- `availability` - Availability percentage (DECIMAL(5,2), nullable, 0-100)
- `performance` - Performance percentage (DECIMAL(5,2), nullable, 0-100)
- `quality` - Quality percentage (DECIMAL(5,2), nullable, 0-100)
- `current` - Current in Amperes (DECIMAL(10,2), nullable)
- `power` - Power in kW (DECIMAL(10,2), nullable)
- `temperature` - Temperature in Celsius (DECIMAL(10,2), nullable)
- `multi_zone_temperatures` - Multi-zone temperatures as JSONB (nullable)

---

### 🎯 Method 1: Using SQL (psql or pgAdmin Query Tool)

#### Basic INSERT (Minimum Required Fields)

```sql
-- Insert a new machine with only required fields
INSERT INTO machines (id, name, area, status)
VALUES ('D-09', 'Drawing Line 09', 'drawing', 'idle');
```

#### Complete INSERT (All Fields)

```sql
-- Insert a complete machine record
INSERT INTO machines (
    id, name, area, status,
    line_speed, target_speed,
    produced_length, target_length,
    production_order_id, production_order_name,
    operator_name,
    oee, availability, performance, quality,
    current, power, temperature,
    multi_zone_temperatures
) VALUES (
    'D-09',                          -- Machine ID
    'Drawing Line 09',               -- Machine name
    'drawing',                       -- Production area
    'running',                       -- Status
    920,                             -- Line speed (m/min)
    1000,                            -- Target speed (m/min)
    3850,                            -- Produced length (meters)
    5000,                            -- Target length (meters)
    'PO-2024-200',                   -- Production order ID
    'PO-2024-200',                   -- Production order name
    'Nguyễn Văn An',                 -- Operator name
    83.6,                            -- OEE (%)
    94.5,                            -- Availability (%)
    89.2,                            -- Performance (%)
    99.1,                            -- Quality (%)
    45.2,                            -- Current (A)
    68.5,                            -- Power (kW)
    68,                              -- Temperature (°C)
    '{"zone1": 148, "zone2": 161, "zone3": 169, "zone4": 155}'::jsonb  -- Multi-zone temps
);
```

---

### 🏭 Examples by Production Area

#### Drawing Area Machines

```sql
-- Drawing machine example
INSERT INTO machines (id, name, area, status, line_speed, target_speed, operator_name)
VALUES ('D-09', 'Drawing Line 09', 'drawing', 'running', 920, 1000, 'Operator Name');
```

#### Stranding Area Machines

```sql
-- Stranding machine example
INSERT INTO machines (id, name, area, status, line_speed, target_speed, operator_name)
VALUES ('S-06', 'Stranding Unit 06', 'stranding', 'running', 650, 720, 'Operator Name');
```

#### Armoring Area Machines

```sql
-- Armoring machine example
INSERT INTO machines (id, name, area, status, line_speed, target_speed, operator_name)
VALUES ('A-04', 'Armoring Line 04', 'armoring', 'running', 320, 350, 'Operator Name');
```

#### Sheathing Area Machines

```sql
-- Sheathing machine example
INSERT INTO machines (id, name, area, status, line_speed, target_speed, operator_name)
VALUES ('SH-07', 'Sheathing Line 07', 'sheathing', 'running', 450, 500, 'Operator Name');
```

---

### 🖥️ Method 2: Using pgAdmin Interface

1. **Open pgAdmin** and connect to your PostgreSQL server

2. **Navigate to the table:**
   - Expand: `Databases` → `production_dashboard` → `Schemas` → `public` → `Tables`
   - Right-click on `machines` table
   - Select **"View/Edit Data"** → **"All Rows"**

3. **Insert new row:**
   - Click the **"+" (Add Row)** button at the top
   - Fill in the required fields:
     - `id`: Enter unique machine ID (e.g., 'D-09')
     - `name`: Enter machine name (e.g., 'Drawing Line 09')
     - `area`: Select from dropdown: 'drawing', 'stranding', 'armoring', or 'sheathing'
     - `status`: Select from dropdown: 'running', 'idle', 'warning', 'error', 'stopped', or 'setup'
   - Fill optional fields as needed
   - Click **"Save"** button (💾)

4. **Verify insertion:**
   - The new machine should appear in the list
   - Refresh the frontend dashboard to see the new machine

---

### 🔧 Method 3: Using psql Command Line

```bash
# Connect to PostgreSQL
psql -U postgres -d production_dashboard

# Then run INSERT command
INSERT INTO machines (id, name, area, status)
VALUES ('D-09', 'Drawing Line 09', 'drawing', 'idle');

# Verify the insertion
SELECT id, name, area, status FROM machines WHERE id = 'D-09';

# Exit psql
\q
```

---

### ✅ Valid Enum Values

#### Production Areas (`area` field):
- `'drawing'` - Drawing area
- `'stranding'` - Stranding area
- `'armoring'` - Armoring area
- `'sheathing'` - Sheathing area

#### Machine Status (`status` field):
- `'running'` - Machine is running
- `'idle'` - Machine is idle
- `'warning'` - Machine has warning
- `'error'` - Machine has error
- `'stopped'` - Machine is stopped
- `'setup'` - Machine is in setup mode

---

### 🚨 Common Errors and Solutions

#### Error: "duplicate key value violates unique constraint"
**Solution:** Machine ID already exists. Use a different ID or update existing machine.

```sql
-- Check if ID exists
SELECT id, name FROM machines WHERE id = 'D-09';

-- If exists, use different ID or update
UPDATE machines SET name = 'New Name' WHERE id = 'D-09';
```

#### Error: "invalid input value for enum"
**Solution:** Check that area and status values match the enum exactly (case-sensitive).

```sql
-- Valid area values
'drawing', 'stranding', 'armoring', 'sheathing'

-- Valid status values
'running', 'idle', 'warning', 'error', 'stopped', 'setup'
```

#### Error: "null value in column violates not-null constraint"
**Solution:** Ensure `id`, `name`, `area`, and `status` are provided.

---

### 📊 Verify Your Insertion

After inserting, verify the machine was added correctly:

```sql
-- Check all machines in a specific area
SELECT id, name, area, status, line_speed 
FROM machines 
WHERE area = 'drawing'
ORDER BY id;

-- Check specific machine
SELECT * FROM machines WHERE id = 'D-09';

-- Count machines by area
SELECT area, COUNT(*) as machine_count 
FROM machines 
GROUP BY area 
ORDER BY area;
```

---

### 🔄 Update Existing Machine

If you need to update a machine instead of inserting:

```sql
-- Update machine details
UPDATE machines 
SET 
    name = 'Updated Machine Name',
    status = 'running',
    line_speed = 950,
    operator_name = 'New Operator'
WHERE id = 'D-09';
```

---

### 💡 Best Practices

1. **Use consistent ID format:**
   - Drawing: `D-01`, `D-02`, `D-03`, ...
   - Stranding: `S-01`, `S-02`, `S-03`, ...
   - Armoring: `A-01`, `A-02`, `A-03`, ...
   - Sheathing: `SH-01`, `SH-02`, `SH-03`, ...

2. **Use descriptive names:**
   - Good: `'Drawing Line 09'`, `'Stranding Unit 06'`
   - Bad: `'Machine 1'`, `'Line 9'`

3. **Set realistic default values:**
   - Start with `status = 'idle'` for new machines
   - Set `line_speed = 0` for stopped machines
   - Set `target_speed` based on machine type

4. **Check for duplicates before inserting:**
   ```sql
   SELECT id FROM machines WHERE id = 'D-09';
   -- If no rows returned, ID is available
   ```

---

### 🎯 Quick Reference: Minimal INSERT Template

```sql
-- Copy and modify this template
INSERT INTO machines (id, name, area, status)
VALUES ('MACHINE-ID', 'Machine Display Name', 'drawing', 'idle');
```

Replace:
- `'MACHINE-ID'` with your unique machine ID
- `'Machine Display Name'` with the machine name
- `'drawing'` with: 'drawing', 'stranding', 'armoring', or 'sheathing'
- `'idle'` with: 'running', 'idle', 'warning', 'error', 'stopped', or 'setup'

---

**Status:** Ready for GitHub after database verification ✅


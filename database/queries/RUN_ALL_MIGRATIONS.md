# Run All Required Migrations for OEE and Availability

## Migration Order

You need to run migrations in this specific order:

1. **Base Schema** (if not already run)
2. **OEE Tracking** - Creates `machine_status_history` table
3. **OK/NG Length** - Adds quality tracking columns
4. **Availability Aggregation** - Creates aggregation table

## Step-by-Step Guide

### Step 1: Run OEE Tracking Migration (REQUIRED FIRST!)

This creates the `machine_status_history` table that the availability aggregation needs.

```powershell
# Navigate to project directory
cd "C:\Users\Admin\Downloads\Production Overview Dashboard NEW"

# Set your PostgreSQL password
$env:PGPASSWORD="your_password"

# Run OEE tracking migration
psql -U postgres -d production_dashboard -f backend\database\migration_add_oee_tracking.sql
```

**Expected Output:**
```
CREATE TABLE
CREATE INDEX
CREATE FUNCTION
CREATE TRIGGER
Migration completed: Real-time OEE tracking tables created
```

### Step 2: Run OK/NG Length Migration

```powershell
psql -U postgres -d production_dashboard -f backend\database\migration_add_ok_ng_length.sql
```

**Expected Output:**
```
ALTER TABLE
CREATE INDEX
Migration completed: OK/NG length columns added to machines table
```

### Step 3: Run Availability Aggregation Migration

```powershell
psql -U postgres -d production_dashboard -f backend\database\migration_add_availability_aggregation.sql
```

**Expected Output:**
```
CREATE TABLE
CREATE INDEX
CREATE FUNCTION
CREATE TRIGGER
Migration completed: Availability aggregation table and functions created
```

## Quick Run All Script

Create a PowerShell script to run all migrations at once:

```powershell
# Save as: backend/database/run-all-migrations.ps1

$env:PGPASSWORD="your_password"  # Replace with your password
$dbName = "production_dashboard"
$dbUser = "postgres"

Write-Host "🔄 Running all OEE and Availability migrations..." -ForegroundColor Cyan

Write-Host "`n1️⃣ Running OEE Tracking Migration..." -ForegroundColor Yellow
psql -U $dbUser -d $dbName -f backend\database\migration_add_oee_tracking.sql
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ OEE Tracking migration failed!" -ForegroundColor Red
    exit 1
}

Write-Host "`n2️⃣ Running OK/NG Length Migration..." -ForegroundColor Yellow
psql -U $dbUser -d $dbName -f backend\database\migration_add_ok_ng_length.sql
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ OK/NG Length migration failed!" -ForegroundColor Red
    exit 1
}

Write-Host "`n3️⃣ Running Availability Aggregation Migration..." -ForegroundColor Yellow
psql -U $dbUser -d $dbName -f backend\database\migration_add_availability_aggregation.sql
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Availability Aggregation migration failed!" -ForegroundColor Red
    exit 1
}

Write-Host "`n✅ All migrations completed successfully!" -ForegroundColor Green
```

Run it:
```powershell
cd "C:\Users\Admin\Downloads\Production Overview Dashboard NEW"
.\backend\database\run-all-migrations.ps1
```

## Verification

After running all migrations, verify everything is created:

```sql
-- Check if machine_status_history exists
SELECT table_name FROM information_schema.tables 
WHERE table_name = 'machine_status_history';

-- Check if availability_aggregations exists
SELECT table_name FROM information_schema.tables 
WHERE table_name = 'availability_aggregations';

-- Check if produced_length_ok column exists
SELECT column_name FROM information_schema.columns 
WHERE table_name = 'machines' 
AND column_name IN ('produced_length_ok', 'produced_length_ng');

-- Check if functions exist
SELECT routine_name FROM information_schema.routines 
WHERE routine_name IN (
  'calculate_availability_aggregation',
  'get_latest_availability',
  'trigger_availability_calculation'
);
```

## Troubleshooting

### Error: "relation machine_status_history does not exist"

**Solution:** Run `migration_add_oee_tracking.sql` first!

### Error: "column produced_length_ok does not exist"

**Solution:** Run `migration_add_ok_ng_length.sql`!

### Error: "relation availability_aggregations does not exist"

**Solution:** Run `migration_add_availability_aggregation.sql`!

## Migration Dependencies

```
schema.sql (base tables)
    ↓
migration_add_oee_tracking.sql (machine_status_history)
    ↓
migration_add_ok_ng_length.sql (quality columns)
    ↓
migration_add_availability_aggregation.sql (aggregation table)
```

## What Each Migration Does

### 1. migration_add_oee_tracking.sql
- Creates `machine_status_history` table
- Creates `production_quality` table
- Creates `oee_calculations` table
- Creates triggers for automatic status tracking

### 2. migration_add_ok_ng_length.sql
- Adds `produced_length_ok` column to `machines` table
- Adds `produced_length_ng` column to `machines` table

### 3. migration_add_availability_aggregation.sql
- Creates `availability_aggregations` table
- Creates aggregation calculation functions
- Creates trigger for automatic aggregation


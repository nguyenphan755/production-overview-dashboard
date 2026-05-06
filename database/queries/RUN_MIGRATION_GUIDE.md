# How to Run Migration: migration_add_availability_aggregation.sql

This guide will help you run the availability aggregation migration file.

## Prerequisites

1. **PostgreSQL is installed and running**
   - Check if PostgreSQL is running: `pg_isready` (Linux/Mac) or check Windows Services
   
2. **Database exists**
   - Database name: `production_dashboard` (or your custom name)
   - If not created: `CREATE DATABASE production_dashboard;`

3. **Database credentials**
   - Default user: `postgres`
   - Password: Check your `backend/.env` file for `DB_PASSWORD`

## Method 1: Using psql Command Line (Recommended)

### Step 1: Open Terminal/Command Prompt

**Windows:**
- Open PowerShell or Command Prompt
- Navigate to your project directory

**Linux/Mac:**
- Open Terminal

### Step 2: Navigate to Project Directory

```bash
cd "C:\Users\Admin\Downloads\Production Overview Dashboard NEW"
```

### Step 3: Run the Migration

**Option A: Using environment variables from .env file**

If you have a `.env` file in the `backend` directory:

```bash
# Windows PowerShell
$env:PGPASSWORD="your_password"; psql -U postgres -d production_dashboard -f backend\database\migration_add_availability_aggregation.sql

# Windows Command Prompt
set PGPASSWORD=your_password && psql -U postgres -d production_dashboard -f backend\database\migration_add_availability_aggregation.sql

# Linux/Mac
PGPASSWORD=your_password psql -U postgres -d production_dashboard -f backend/database/migration_add_availability_aggregation.sql
```

**Option B: Interactive (will prompt for password)**

```bash
# Windows
psql -U postgres -d production_dashboard -f backend\database\migration_add_availability_aggregation.sql

# Linux/Mac
psql -U postgres -d production_dashboard -f backend/database/migration_add_availability_aggregation.sql
```

**Option C: Full connection string**

```bash
# Windows
psql -h localhost -p 5432 -U postgres -d production_dashboard -f backend\database\migration_add_availability_aggregation.sql

# Linux/Mac
psql -h localhost -p 5432 -U postgres -d production_dashboard -f backend/database/migration_add_availability_aggregation.sql
```

### Step 4: Verify Success

You should see output like:
```
CREATE TABLE
CREATE INDEX
CREATE FUNCTION
CREATE TRIGGER
Migration completed: Availability aggregation table and functions created
```

## Method 2: Using pgAdmin (GUI)

### Step 1: Open pgAdmin

1. Launch pgAdmin
2. Connect to your PostgreSQL server
3. Navigate to: **Servers** → **PostgreSQL** → **Databases** → **production_dashboard**

### Step 2: Open Query Tool

1. Right-click on `production_dashboard` database
2. Select **Query Tool**

### Step 3: Load Migration File

1. Click **Open File** button (folder icon) or press `Ctrl+O`
2. Navigate to: `backend/database/migration_add_availability_aggregation.sql`
3. Select the file and click **Open**

### Step 4: Execute Migration

1. Click **Execute** button (play icon) or press `F5`
2. Wait for execution to complete
3. Check the **Messages** tab for success messages

### Step 5: Verify

Run this query in Query Tool:

```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_name = 'availability_aggregations';
```

Should return: `availability_aggregations`

## Method 3: Using Node.js Script (Automated)

Create a script to run the migration programmatically:

### Create migration runner script:

```javascript
// backend/scripts/run-migration.js
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import pg from 'pg';

const { Pool } = pg;
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'production_dashboard',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || '',
});

async function runMigration() {
  try {
    console.log('🔄 Running availability aggregation migration...');
    
    const migrationPath = join(__dirname, '../database/migration_add_availability_aggregation.sql');
    const migrationSQL = readFileSync(migrationPath, 'utf8');
    
    await pool.query(migrationSQL);
    
    console.log('✅ Migration completed successfully!');
    
    // Verify
    const result = await pool.query(
      `SELECT table_name FROM information_schema.tables WHERE table_name = 'availability_aggregations'`
    );
    
    if (result.rows.length > 0) {
      console.log('✅ Table "availability_aggregations" created successfully');
    }
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

runMigration();
```

### Run the script:

```bash
cd backend
node scripts/run-migration.js
```

## Verification Steps

After running the migration, verify everything was created correctly:

### 1. Check if table exists:

```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_name = 'availability_aggregations';
```

### 2. Check table structure:

```sql
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'availability_aggregations'
ORDER BY ordinal_position;
```

### 3. Check if functions exist:

```sql
SELECT routine_name 
FROM information_schema.routines 
WHERE routine_name IN (
  'calculate_availability_aggregation',
  'get_latest_availability',
  'trigger_availability_calculation'
);
```

### 4. Check if trigger exists:

```sql
SELECT trigger_name, event_object_table
FROM information_schema.triggers
WHERE trigger_name = 'trigger_calculate_availability';
```

### 5. Test the function:

```sql
-- This should return a table structure (may be empty if no data)
SELECT * FROM get_latest_availability('D-01', 'rolling_window');
```

## Troubleshooting

### Error: "relation does not exist"

**Problem:** The `machines` table doesn't exist yet.

**Solution:** Run the base schema first:
```bash
psql -U postgres -d production_dashboard -f backend/database/schema.sql
```

### Error: "permission denied"

**Problem:** User doesn't have CREATE TABLE permission.

**Solution:** Grant permissions or use superuser:
```sql
GRANT ALL PRIVILEGES ON DATABASE production_dashboard TO postgres;
```

### Error: "password authentication failed"

**Problem:** Wrong password.

**Solution:** 
- Check your `backend/.env` file
- Or use interactive mode: `psql -U postgres -d production_dashboard`

### Error: "could not connect to server"

**Problem:** PostgreSQL is not running.

**Solution:**
- **Windows:** Check Services → PostgreSQL
- **Linux:** `sudo systemctl start postgresql`
- **Mac:** Check if PostgreSQL is running in Activity Monitor

### Error: "database does not exist"

**Problem:** Database `production_dashboard` doesn't exist.

**Solution:** Create it first:
```sql
CREATE DATABASE production_dashboard;
```

## Quick Reference

**Default Connection Settings:**
- Host: `localhost`
- Port: `5432`
- Database: `production_dashboard`
- User: `postgres`
- Password: Check `backend/.env` file

**Migration File Location:**
```
backend/database/migration_add_availability_aggregation.sql
```

**What This Migration Creates:**
1. `availability_aggregations` table
2. `calculate_availability_aggregation()` function
3. `get_latest_availability()` function
4. `trigger_availability_calculation()` trigger function
5. `trigger_calculate_availability` trigger on `machines` table
6. Indexes for performance

## Next Steps

After successful migration:

1. **Start the backend server:**
   ```bash
   cd backend
   npm start
   ```

2. **Verify synchronization is working:**
   - Check server logs for: "🔄 Starting continuous availability synchronization"
   - The system will automatically start syncing all machines

3. **Test the API:**
   ```bash
   GET http://localhost:3001/api/availability/sync/status
   ```

## Need Help?

If you encounter issues:
1. Check PostgreSQL logs
2. Verify database connection settings in `backend/.env`
3. Ensure all prerequisite migrations have been run
4. Check that the `machines` table exists


# Guide: Renaming Production Lines, Line Groups, and Related Entities

This guide provides a **safe, step-by-step approach** to rename production lines (machines), line groups (production areas), and related entities in your MES system **without breaking existing data**.

---

## 📋 Overview

### What Can Be Renamed:

1. **Production Lines (Machines)**
   - Machine IDs (`machines.id`) - ⚠️ **Complex** (used as foreign keys)
   - Machine Names (`machines.name`) - ✅ **Easy** (display names only)

2. **Line Groups (Production Areas)**
   - Area Enum Values (`production_area` ENUM) - ⚠️ **Complex** (requires enum migration)
   - Area Display Names - ✅ **Easy** (just update backend code)

3. **Related Entities**
   - Production Orders (reference machine IDs)
   - Alarms (reference machine IDs)
   - Machine Metrics (reference machine IDs)
   - Energy Consumption (reference machine IDs)

---

## 🎯 Recommended Approach

### **Option 1: Rename Display Names Only (Safest & Easiest)**

**Best for:** Changing how names appear in the UI without changing database structure.

#### A. Rename Machine Display Names

```sql
-- Connect to PostgreSQL
psql -U postgres -d production_dashboard

-- Update machine names
UPDATE machines SET name = 'New Machine Name' WHERE id = 'D-01';
UPDATE machines SET name = 'Another New Name' WHERE id = 'D-02';
-- ... repeat for all machines
```

#### B. Rename Area Display Names

**No database change needed!** Just update the backend code:

**File:** `backend/routes/areas.js`

```javascript
const areaNames = {
  drawing: { name: 'NEW_VIETNAMESE_NAME', nameEn: 'NEW_ENGLISH_NAME' },
  stranding: { name: 'NEW_VIETNAMESE_NAME', nameEn: 'NEW_ENGLISH_NAME' },
  armoring: { name: 'NEW_VIETNAMESE_NAME', nameEn: 'NEW_ENGLISH_NAME' },
  sheathing: { name: 'NEW_VIETNAMESE_NAME', nameEn: 'NEW_ENGLISH_NAME' },
};
```

**Also update frontend types if needed:** `src/types/index.ts`

```typescript
export type ProductionArea = 'drawing' | 'stranding' | 'armoring' | 'sheathing';
// Keep enum values same, only change display names
```

---

### **Option 2: Rename Machine IDs (Requires Migration)**

**⚠️ WARNING:** Machine IDs are used as foreign keys. This requires careful migration.

#### Step-by-Step Process:

1. **Backup Database First!**
   ```bash
   pg_dump -U postgres production_dashboard > backup_before_rename.sql
   ```

2. **Create Migration Script**
   - Use the provided `backend/database/migration_rename_entities.sql`
   - Customize the rename mappings in the script

3. **Review the Migration**
   ```sql
   -- Example rename mappings
   INSERT INTO machine_id_renames (old_id, new_id) VALUES
       ('D-01', 'DRW-001'),
       ('D-02', 'DRW-002'),
       ('S-01', 'STR-001');
   ```

4. **Test in Development First**
   - Run on a copy of production data
   - Verify all foreign keys are updated correctly

5. **Run Migration**
   ```bash
   cd backend
   psql -U postgres -d production_dashboard -f database/migration_rename_entities.sql
   ```

6. **Verify Results**
   ```sql
   -- Check for orphaned references (should return 0)
   SELECT COUNT(*) FROM production_orders po
   WHERE NOT EXISTS (SELECT 1 FROM machines m WHERE m.id = po.machine_id);
   ```

7. **Update Code References**
   - Update any hardcoded machine IDs in:
     - `backend/scripts/seed-sample-data.js`
     - `backend/node-red-*.json` files
     - Frontend code (if any hardcoded IDs)

---

### **Option 3: Rename Production Area Enum Values**

**⚠️ WARNING:** This is the most complex operation. Only do this if you absolutely need to change the enum values themselves.

#### Process:

1. **Create New Enum Type**
   ```sql
   CREATE TYPE production_area_new AS ENUM (
       'new_drawing_name',
       'new_stranding_name',
       'new_armoring_name',
       'new_sheathing_name'
   );
   ```

2. **Add Temporary Column**
   ```sql
   ALTER TABLE machines ADD COLUMN area_new production_area_new;
   ```

3. **Map Old to New Values**
   ```sql
   UPDATE machines SET area_new = 'new_drawing_name'::production_area_new 
   WHERE area = 'drawing'::production_area;
   -- Repeat for all areas
   ```

4. **Swap Columns**
   ```sql
   ALTER TABLE machines DROP COLUMN area;
   ALTER TABLE machines RENAME COLUMN area_new TO area;
   ALTER TABLE machines ALTER COLUMN area SET NOT NULL;
   ```

5. **Clean Up**
   ```sql
   DROP TYPE production_area;
   ALTER TYPE production_area_new RENAME TO production_area;
   ```

6. **Update Code**
   - Update `src/types/index.ts` ProductionArea type
   - Update `backend/routes/areas.js` area array
   - Update all code that references area values

---

## 🔒 Safety Best Practices

### 1. **Always Backup First**
```bash
pg_dump -U postgres production_dashboard > backup_$(date +%Y%m%d_%H%M%S).sql
```

### 2. **Use Transactions**
The migration script uses `BEGIN`/`COMMIT` to ensure atomicity. If anything fails, rollback:
```sql
ROLLBACK;
```

### 3. **Test in Development**
- Never run migrations directly on production
- Test with a copy of production data first
- Verify all foreign key relationships

### 4. **Verify After Migration**
```sql
-- Check machine count
SELECT COUNT(*) FROM machines;

-- Check area distribution
SELECT area, COUNT(*) FROM machines GROUP BY area;

-- Check for orphaned references
SELECT 'production_orders' as table, COUNT(*) as orphans
FROM production_orders po
WHERE NOT EXISTS (SELECT 1 FROM machines m WHERE m.id = po.machine_id);
```

### 5. **Update All Code References**
After renaming, update:
- ✅ Backend routes (`backend/routes/areas.js`)
- ✅ Seed scripts (`backend/scripts/seed-sample-data.js`)
- ✅ Node-RED flows (`backend/node-red-*.json`)
- ✅ Frontend types (`src/types/index.ts`)
- ✅ Any hardcoded IDs in frontend components

---

## 📝 Quick Reference: What to Update

### If Renaming Machine IDs:
- [ ] `machines.id` (primary key)
- [ ] `production_orders.machine_id` (foreign key)
- [ ] `alarms.machine_id` (foreign key)
- [ ] `machine_metrics.machine_id` (foreign key)
- [ ] `energy_consumption.machine_id` (foreign key)
- [ ] `backend/scripts/seed-sample-data.js`
- [ ] `backend/node-red-*.json` files
- [ ] Any hardcoded machine IDs in code

### If Renaming Machine Names:
- [ ] `machines.name` (display name only)
- [ ] No foreign key updates needed ✅

### If Renaming Area Display Names:
- [ ] `backend/routes/areas.js` (areaNames mapping)
- [ ] No database changes needed ✅

### If Renaming Area Enum Values:
- [ ] `machines.area` (enum column)
- [ ] `production_area` ENUM type
- [ ] `src/types/index.ts` (ProductionArea type)
- [ ] `backend/routes/areas.js` (area array)
- [ ] All code referencing area values

---

## 🚨 Common Pitfalls to Avoid

1. **❌ Don't rename machine IDs without updating foreign keys first**
   - This will break referential integrity

2. **❌ Don't drop enum types while they're still in use**
   - Always create new enum, migrate data, then drop old one

3. **❌ Don't forget to update code after database changes**
   - Hardcoded values will cause errors

4. **❌ Don't skip backups**
   - Always backup before migrations

5. **❌ Don't run migrations on production without testing**
   - Test in development environment first

---

## 🔧 Migration Script Usage

The provided migration script (`backend/database/migration_rename_entities.sql`) includes:

1. ✅ Transaction safety (BEGIN/COMMIT)
2. ✅ Foreign key update order (child tables first)
3. ✅ Verification queries
4. ✅ Rollback instructions

**To use it:**

1. Open `backend/database/migration_rename_entities.sql`
2. Customize the rename mappings
3. Review carefully
4. Run: `psql -U postgres -d production_dashboard -f database/migration_rename_entities.sql`

---

## 📞 Need Help?

If you encounter issues:

1. Check the verification queries in the migration script
2. Review PostgreSQL logs for errors
3. Use `ROLLBACK` if something goes wrong
4. Restore from backup if needed

---

## ✅ Checklist

Before starting:
- [ ] Database backup created
- [ ] Migration script reviewed
- [ ] Rename mappings defined
- [ ] Development environment tested
- [ ] All code references identified

After migration:
- [ ] Verification queries passed
- [ ] No orphaned references
- [ ] Backend code updated
- [ ] Frontend code updated
- [ ] Node-RED flows updated (if applicable)
- [ ] System tested end-to-end

---

**Remember:** When in doubt, start with Option 1 (display names only). It's the safest and easiest approach! 🎯


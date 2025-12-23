# Quick Start: Renaming Production Lines & Line Groups

## 🎯 Recommended Approach (Safest)

### **Option 1: Rename Display Names Only** ⭐ RECOMMENDED

**Best for:** Changing how names appear without changing database structure.

#### Rename Machine Names:
```sql
-- Connect to PostgreSQL
psql -U postgres -d production_dashboard

-- Update machine display names
UPDATE machines SET name = 'New Machine Name' WHERE id = 'D-01';
UPDATE machines SET name = 'Another Name' WHERE id = 'D-02';
```

#### Rename Area Display Names:
**File:** `backend/routes/areas.js` (line 6-11)

```javascript
const areaNames = {
  drawing: { name: 'NEW_VIETNAMESE', nameEn: 'NEW_ENGLISH' },
  stranding: { name: 'NEW_VIETNAMESE', nameEn: 'NEW_ENGLISH' },
  armoring: { name: 'NEW_VIETNAMESE', nameEn: 'NEW_ENGLISH' },
  sheathing: { name: 'NEW_VIETNAMESE', nameEn: 'NEW_ENGLISH' },
};
```

**No database changes needed!** ✅

---

### **Option 2: Rename Machine IDs** ⚠️ ADVANCED

**Requires:** Foreign key updates across multiple tables.

#### Using Interactive Script:
```bash
cd backend
npm run rename-entities
```

#### Using SQL Migration:
1. Edit `backend/database/migration_rename_entities.sql`
2. Add your rename mappings:
   ```sql
   INSERT INTO machine_id_renames (old_id, new_id) VALUES
       ('D-01', 'DRW-001'),
       ('D-02', 'DRW-002');
   ```
3. Run migration:
   ```bash
   psql -U postgres -d production_dashboard -f backend/database/migration_rename_entities.sql
   ```

---

## 📋 What Gets Updated When Renaming Machine IDs

The migration automatically updates:
- ✅ `machines.id` (primary key)
- ✅ `production_orders.machine_id` (foreign key)
- ✅ `alarms.machine_id` (foreign key)
- ✅ `machine_metrics.machine_id` (foreign key)
- ✅ `energy_consumption.machine_id` (foreign key)

---

## 🔒 Safety Checklist

Before renaming:
- [ ] **Backup database:** `pg_dump -U postgres production_dashboard > backup.sql`
- [ ] Review rename mappings
- [ ] Test in development environment first

After renaming:
- [ ] Verify integrity: `npm run rename-entities` → Option 3
- [ ] Update code references (seed scripts, Node-RED flows)
- [ ] Test system end-to-end

---

## 📚 Full Documentation

See `RENAME_ENTITIES_GUIDE.md` for:
- Detailed step-by-step instructions
- All three renaming options
- Safety best practices
- Troubleshooting guide

---

## 🚨 Important Notes

1. **Machine IDs** are used as foreign keys → Requires careful migration
2. **Machine Names** are display-only → Safe to change anytime
3. **Area Display Names** → Just update backend code, no DB change
4. **Area Enum Values** → Complex, only if absolutely necessary

**When in doubt, use Option 1 (display names only)!** 🎯


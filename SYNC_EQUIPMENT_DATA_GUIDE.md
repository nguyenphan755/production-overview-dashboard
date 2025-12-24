# Sync Equipment Data from PostgreSQL Guide

## ✅ What Was Done

Successfully synced all Equipment (machines) data from your PostgreSQL database back to the backend seed file!

### Summary:
- **Exported**: 30 machines from PostgreSQL
- **Updated**: `backend/scripts/seed-sample-data.js` with actual data
- **Included**: All equipment status fields (health_score, vibration_level, runtime_hours)
- **Distribution**:
  - Drawing: 6 machines
  - Stranding: 10 machines
  - Armoring: 5 machines
  - Sheathing: 9 machines

## 📋 Files Created/Updated

### 1. Export Script
**File**: `backend/scripts/export-machines-data.js`
- Exports all machines data from PostgreSQL
- Generates JavaScript array format
- Saves to `backend/scripts/exported-machines-data.js`

### 2. Sync Script (Advanced)
**File**: `backend/scripts/sync-machines-from-db.js`
- Automatically syncs data from PostgreSQL to seed file
- Updates INSERT query to include equipment fields

### 3. Updated Seed File
**File**: `backend/scripts/seed-sample-data.js`
- ✅ Updated with 30 actual machines from PostgreSQL
- ✅ Includes all equipment status fields
- ✅ INSERT query updated to include: health_score, vibration_level, runtime_hours

## 🚀 How to Use

### Option 1: Export Data (Manual Review)
```bash
cd backend
npm run export-machines
```

This will:
- Export all machines from PostgreSQL
- Save to `backend/scripts/exported-machines-data.js`
- You can review and manually copy to seed file

### Option 2: Auto-Sync (Automatic)
```bash
cd backend
npm run sync-machines
```

This will:
- Automatically sync data from PostgreSQL
- Update seed file with actual data
- Update INSERT query to include equipment fields

## 📊 Equipment Status Fields

The seed file now includes these equipment status fields for each machine:
- `health_score`: Machine health score (0-100)
- `vibration_level`: Vibration level ('Normal', 'Elevated', 'High', 'Critical')
- `runtime_hours`: Total runtime hours

## 🔄 Future Updates

When you modify data in PostgreSQL and want to sync back:

1. **Quick Export**:
   ```bash
   cd backend
   npm run export-machines
   ```

2. **Auto-Sync** (recommended):
   ```bash
   cd backend
   npm run sync-machines
   ```

3. **Manual Update**:
   - Review `backend/scripts/exported-machines-data.js`
   - Copy machines array to `seed-sample-data.js`
   - Update INSERT query if needed

## ✨ Benefits

- ✅ Seed file now matches your actual PostgreSQL data
- ✅ Can restore exact same data using seed script
- ✅ Equipment status fields preserved
- ✅ All 30 machines with actual names and values
- ✅ Easy to sync future changes

## 📝 Notes

- The exported data includes all actual values you modified in PostgreSQL
- Equipment status fields (health_score, vibration_level, runtime_hours) are now included
- Machine names are actual names (e.g., 'DA13', 'LHT-1', '1250', etc.)
- All metrics and values match your PostgreSQL database

---

**Last Synced**: Data synced from PostgreSQL with 30 machines
**Status**: ✅ Complete - Seed file updated with actual data


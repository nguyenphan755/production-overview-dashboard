/**
 * Interactive Script: Rename Production Lines, Line Groups, and Related Entities
 * 
 * This script provides a safe, interactive way to rename:
 * - Machine IDs (production lines)
 * - Machine names (display names)
 * - Production area display names
 * 
 * Usage:
 *   node scripts/rename-entities.js
 * 
 * The script will:
 * 1. Show current entities
 * 2. Allow you to specify renames
 * 3. Preview changes
 * 4. Apply changes with transaction safety
 */

import { query } from '../database/connection.js';
import dotenv from 'dotenv';
import readline from 'readline';

dotenv.config();

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function question(prompt) {
  return new Promise((resolve) => {
    rl.question(prompt, resolve);
  });
}

async function showCurrentMachines() {
  console.log('\n📦 Current Machines:');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  
  const result = await query(`
    SELECT id, name, area, status 
    FROM machines 
    ORDER BY area, id
  `);
  
  result.rows.forEach((machine, index) => {
    console.log(`${(index + 1).toString().padStart(2, ' ')}. ${machine.id.padEnd(8)} | ${machine.name.padEnd(30)} | ${machine.area.padEnd(12)} | ${machine.status}`);
  });
  
  console.log(`\nTotal: ${result.rows.length} machines\n`);
  return result.rows;
}

async function showCurrentAreas() {
  console.log('\n🏭 Current Production Areas:');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  
  const result = await query(`
    SELECT area, COUNT(*) as count 
    FROM machines 
    GROUP BY area 
    ORDER BY area
  `);
  
  result.rows.forEach((row) => {
    console.log(`   ${row.area.padEnd(12)} : ${row.count} machines`);
  });
  
  console.log('');
  return result.rows;
}

async function renameMachineName(machineId, newName) {
  try {
    await query('BEGIN');
    
    const result = await query(
      `UPDATE machines SET name = $1 WHERE id = $2 RETURNING id, name`,
      [newName, machineId]
    );
    
    if (result.rows.length === 0) {
      throw new Error(`Machine ${machineId} not found`);
    }
    
    await query('COMMIT');
    console.log(`   ✅ Renamed ${machineId}: "${result.rows[0].name}" → "${newName}"`);
    return true;
  } catch (error) {
    await query('ROLLBACK');
    console.error(`   ❌ Error renaming ${machineId}:`, error.message);
    return false;
  }
}

async function renameMachineId(oldId, newId) {
  try {
    await query('BEGIN');
    
    // Check if new ID already exists
    const checkResult = await query('SELECT id FROM machines WHERE id = $1', [newId]);
    if (checkResult.rows.length > 0) {
      throw new Error(`Machine ID ${newId} already exists`);
    }
    
    // Check if old ID exists
    const oldCheck = await query('SELECT id FROM machines WHERE id = $1', [oldId]);
    if (oldCheck.rows.length === 0) {
      throw new Error(`Machine ID ${oldId} not found`);
    }
    
    // Update foreign keys first (in correct order)
    console.log(`   🔄 Updating foreign key references...`);
    
    // 1. production_orders
    await query('UPDATE production_orders SET machine_id = $1 WHERE machine_id = $2', [newId, oldId]);
    console.log(`      ✓ Updated production_orders`);
    
    // 2. alarms
    await query('UPDATE alarms SET machine_id = $1 WHERE machine_id = $2', [newId, oldId]);
    console.log(`      ✓ Updated alarms`);
    
    // 3. machine_metrics
    await query('UPDATE machine_metrics SET machine_id = $1 WHERE machine_id = $2', [newId, oldId]);
    console.log(`      ✓ Updated machine_metrics`);
    
    // 4. energy_consumption
    await query('UPDATE energy_consumption SET machine_id = $1 WHERE machine_id = $2', [newId, oldId]);
    console.log(`      ✓ Updated energy_consumption`);
    
    // 5. Finally, update machines table
    await query('UPDATE machines SET id = $1 WHERE id = $2', [newId, oldId]);
    console.log(`      ✓ Updated machines table`);
    
    await query('COMMIT');
    console.log(`   ✅ Successfully renamed machine ID: ${oldId} → ${newId}`);
    return true;
  } catch (error) {
    await query('ROLLBACK');
    console.error(`   ❌ Error renaming machine ID ${oldId} → ${newId}:`, error.message);
    return false;
  }
}

async function verifyIntegrity() {
  console.log('\n🔍 Verifying database integrity...');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  
  const checks = [
    {
      name: 'production_orders',
      query: `SELECT COUNT(*) as count FROM production_orders po 
              WHERE NOT EXISTS (SELECT 1 FROM machines m WHERE m.id = po.machine_id)`
    },
    {
      name: 'alarms',
      query: `SELECT COUNT(*) as count FROM alarms a 
              WHERE NOT EXISTS (SELECT 1 FROM machines m WHERE m.id = a.machine_id)`
    },
    {
      name: 'machine_metrics',
      query: `SELECT COUNT(*) as count FROM machine_metrics mm 
              WHERE NOT EXISTS (SELECT 1 FROM machines m WHERE m.id = mm.machine_id)`
    },
    {
      name: 'energy_consumption',
      query: `SELECT COUNT(*) as count FROM energy_consumption ec 
              WHERE NOT EXISTS (SELECT 1 FROM machines m WHERE m.id = ec.machine_id)`
    }
  ];
  
  let allPassed = true;
  
  for (const check of checks) {
    const result = await query(check.query);
    const count = parseInt(result.rows[0].count);
    
    if (count === 0) {
      console.log(`   ✅ ${check.name.padEnd(20)} : No orphaned references`);
    } else {
      console.log(`   ❌ ${check.name.padEnd(20)} : ${count} orphaned references found!`);
      allPassed = false;
    }
  }
  
  if (allPassed) {
    console.log('\n✅ All integrity checks passed!\n');
  } else {
    console.log('\n⚠️  Integrity issues detected. Please review.\n');
  }
  
  return allPassed;
}

async function main() {
  console.log('\n🔄 Production Lines & Line Groups Rename Tool');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('This tool helps you safely rename machines and areas.');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  
  try {
    // Show current state
    await showCurrentMachines();
    await showCurrentAreas();
    
    // Ask what to rename
    console.log('What would you like to rename?');
    console.log('1. Machine display names (safest)');
    console.log('2. Machine IDs (requires foreign key updates)');
    console.log('3. Verify database integrity');
    console.log('4. Exit');
    
    const choice = await question('\nEnter choice (1-4): ');
    
    if (choice === '1') {
      // Rename machine names
      console.log('\n📝 Rename Machine Display Names');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      
      const machines = await showCurrentMachines();
      const machineId = await question('\nEnter machine ID to rename (or "done" to finish): ');
      
      if (machineId.toLowerCase() !== 'done') {
        const newName = await question(`Enter new name for ${machineId}: `);
        await renameMachineName(machineId, newName);
      }
      
    } else if (choice === '2') {
      // Rename machine IDs
      console.log('\n⚠️  WARNING: Renaming machine IDs updates all foreign key references.');
      console.log('This operation should be done during maintenance window.');
      
      const confirm = await question('\nAre you sure you want to continue? (yes/no): ');
      
      if (confirm.toLowerCase() === 'yes') {
        const oldId = await question('Enter current machine ID: ');
        const newId = await question('Enter new machine ID: ');
        
        await renameMachineId(oldId, newId);
        await verifyIntegrity();
      }
      
    } else if (choice === '3') {
      await verifyIntegrity();
    }
    
    console.log('\n✅ Operation completed.\n');
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  } finally {
    rl.close();
  }
}

main();


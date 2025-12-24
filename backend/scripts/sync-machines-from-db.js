import { query } from '../database/connection.js';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function syncMachinesFromDB() {
  try {
    console.log('🔄 Syncing machines data from PostgreSQL to seed file...\n');

    // Fetch all machines from database
    const result = await query(`
      SELECT 
        id, name, area, status, 
        line_speed, target_speed, 
        produced_length, target_length,
        production_order_id, production_order_name,
        operator_name,
        oee, availability, performance, quality,
        current, power, temperature,
        multi_zone_temperatures,
        health_score, vibration_level, runtime_hours
      FROM machines
      ORDER BY area, id
    `);

    if (result.rows.length === 0) {
      console.log('⚠️  No machines found in database.');
      process.exit(1);
    }

    console.log(`✅ Found ${result.rows.length} machines in database\n`);

    // Convert database rows to JavaScript objects
    const machines = result.rows.map((row) => {
      const machine = {
        id: row.id,
        name: row.name,
        area: row.area,
        status: row.status,
        line_speed: row.line_speed ? parseFloat(row.line_speed) : 0,
        target_speed: row.target_speed ? parseFloat(row.target_speed) : 0,
        produced_length: row.produced_length ? parseFloat(row.produced_length) : 0,
        target_length: row.target_length ? parseFloat(row.target_length) : null,
        production_order_id: row.production_order_id || null,
        production_order_name: row.production_order_name || null,
        operator_name: row.operator_name || null,
        oee: row.oee ? parseFloat(row.oee) : 0,
        availability: row.availability ? parseFloat(row.availability) : 0,
        performance: row.performance ? parseFloat(row.performance) : 0,
        quality: row.quality ? parseFloat(row.quality) : 0,
        current: row.current ? parseFloat(row.current) : 0,
        power: row.power ? parseFloat(row.power) : 0,
        temperature: row.temperature ? parseFloat(row.temperature) : null,
        multi_zone_temperatures: row.multi_zone_temperatures 
          ? (typeof row.multi_zone_temperatures === 'string' 
              ? row.multi_zone_temperatures 
              : JSON.stringify(row.multi_zone_temperatures))
          : null,
        health_score: row.health_score ? parseFloat(row.health_score) : null,
        vibration_level: row.vibration_level || null,
        runtime_hours: row.runtime_hours ? parseFloat(row.runtime_hours) : null,
      };

      return machine;
    });

    // Read the seed file
    const seedFilePath = path.join(__dirname, 'seed-sample-data.js');
    let seedContent = fs.readFileSync(seedFilePath, 'utf8');

    // Find the machines array section
    const machinesArrayStart = seedContent.indexOf('const machines = [');
    const machinesArrayEnd = seedContent.indexOf('];', machinesArrayStart);

    if (machinesArrayStart === -1 || machinesArrayEnd === -1) {
      console.error('❌ Could not find machines array in seed file');
      process.exit(1);
    }

    // Generate new machines array code
    let newMachinesArray = `    const machines = [\n`;
    
    machines.forEach((machine, index) => {
      const isLast = index === machines.length - 1;
      
      // Format multi_zone_temperatures
      let multiZoneStr = 'null';
      if (machine.multi_zone_temperatures) {
        try {
          const parsed = typeof machine.multi_zone_temperatures === 'string' 
            ? JSON.parse(machine.multi_zone_temperatures)
            : machine.multi_zone_temperatures;
          multiZoneStr = `JSON.stringify(${JSON.stringify(parsed)})`;
        } catch (e) {
          multiZoneStr = 'null';
        }
      }

      // Build machine object string
      let machineStr = `      {\n`;
      machineStr += `        id: '${machine.id}', name: '${machine.name.replace(/'/g, "\\'")}', area: '${machine.area}', status: '${machine.status}',\n`;
      machineStr += `        line_speed: ${machine.line_speed}, target_speed: ${machine.target_speed}, produced_length: ${machine.produced_length}, target_length: ${machine.target_length !== null ? machine.target_length : 'null'},\n`;
      machineStr += `        production_order_id: ${machine.production_order_id ? `'${machine.production_order_id}'` : 'null'}, production_order_name: ${machine.production_order_name ? `'${machine.production_order_name.replace(/'/g, "\\'")}'` : 'null'},\n`;
      machineStr += `        operator_name: ${machine.operator_name ? `'${machine.operator_name.replace(/'/g, "\\'")}'` : 'null'}, oee: ${machine.oee}, availability: ${machine.availability}, performance: ${machine.performance}, quality: ${machine.quality},\n`;
      machineStr += `        current: ${machine.current}, power: ${machine.power}, temperature: ${machine.temperature !== null ? machine.temperature : 'null'},\n`;
      machineStr += `        multi_zone_temperatures: ${multiZoneStr}`;
      
      // Add equipment status fields if they exist
      if (machine.health_score !== null || machine.vibration_level !== null || machine.runtime_hours !== null) {
        machineStr += `,\n        health_score: ${machine.health_score !== null ? machine.health_score : 'null'}, vibration_level: ${machine.vibration_level ? `'${machine.vibration_level}'` : 'null'}, runtime_hours: ${machine.runtime_hours !== null ? machine.runtime_hours : 'null'}`;
      }
      
      machineStr += `,\n      }`;
      if (!isLast) machineStr += ',';
      machineStr += '\n';
      
      newMachinesArray += machineStr;
    });
    
    newMachinesArray += `    ];\n`;

    // Replace the machines array in seed file
    const beforeArray = seedContent.substring(0, machinesArrayStart);
    const afterArray = seedContent.substring(machinesArrayEnd + 2); // +2 for '];'
    
    // Also update the INSERT query to include equipment fields
    let updatedContent = beforeArray + newMachinesArray + afterArray;
    
    // Update INSERT query if it doesn't include equipment fields
    const insertQueryStart = updatedContent.indexOf('INSERT INTO machines (');
    if (insertQueryStart !== -1) {
      const insertQueryEnd = updatedContent.indexOf(')', insertQueryStart);
      const insertQuery = updatedContent.substring(insertQueryStart, insertQueryEnd + 1);
      
      // Check if equipment fields are already in the INSERT
      if (!insertQuery.includes('health_score')) {
        // Find the VALUES part
        const valuesStart = updatedContent.indexOf('VALUES ($1', insertQueryStart);
        if (valuesStart !== -1) {
          // Update column list
          const columnListEnd = updatedContent.indexOf(')', insertQueryStart);
          const columnList = updatedContent.substring(insertQueryStart, columnListEnd);
          
          // Add equipment fields to column list
          const newColumnList = columnList.replace(
            'multi_zone_temperatures, last_updated',
            'multi_zone_temperatures, health_score, vibration_level, runtime_hours, last_updated'
          );
          
          // Update VALUES clause
          const valuesEnd = updatedContent.indexOf(')', valuesStart);
          const valuesClause = updatedContent.substring(valuesStart, valuesEnd);
          
          // Count current parameters
          const paramCount = (valuesClause.match(/\$/g) || []).length;
          
          // Add new parameters
          const newValuesClause = valuesClause.replace(
            `$${paramCount}, CURRENT_TIMESTAMP)`,
            `$${paramCount}, $${paramCount + 1}, $${paramCount + 2}, $${paramCount + 3}, CURRENT_TIMESTAMP)`
          );
          
          // Update ON CONFLICT clause
          const conflictStart = updatedContent.indexOf('ON CONFLICT', valuesEnd);
          if (conflictStart !== -1) {
            const conflictEnd = updatedContent.indexOf('CURRENT_TIMESTAMP', conflictStart) + 'CURRENT_TIMESTAMP'.length;
            const conflictClause = updatedContent.substring(conflictStart, conflictEnd);
            
            const newConflictClause = conflictClause.replace(
              'multi_zone_temperatures = EXCLUDED.multi_zone_temperatures,',
              'multi_zone_temperatures = EXCLUDED.multi_zone_temperatures,\n          health_score = EXCLUDED.health_score, vibration_level = EXCLUDED.vibration_level, runtime_hours = EXCLUDED.runtime_hours,'
            );
            
            updatedContent = updatedContent.substring(0, insertQueryStart) +
              newColumnList + ')' +
              updatedContent.substring(columnListEnd + 1, valuesStart) +
              newValuesClause +
              updatedContent.substring(valuesEnd, conflictStart) +
              newConflictClause +
              updatedContent.substring(conflictEnd);
          }
        }
      }
      
      // Update the parameter array in the query call
      const queryCallStart = updatedContent.indexOf('await query(', insertQueryStart);
      if (queryCallStart !== -1) {
        const arrayStart = updatedContent.indexOf('[', queryCallStart);
        const arrayEnd = updatedContent.indexOf(']', arrayStart);
        const paramArray = updatedContent.substring(arrayStart, arrayEnd);
        
        // Add equipment fields to parameter array
        const newParamArray = paramArray.replace(
          'machine.multi_zone_temperatures,',
          'machine.multi_zone_temperatures, machine.health_score, machine.vibration_level, machine.runtime_hours,'
        );
        
        updatedContent = updatedContent.substring(0, arrayStart) +
          newParamArray +
          updatedContent.substring(arrayEnd);
      }
    }

    // Write updated seed file
    fs.writeFileSync(seedFilePath, updatedContent, 'utf8');

    console.log('✅ Successfully synced machines data to seed file!');
    console.log(`📁 Updated file: ${seedFilePath}\n`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`   📦 Total machines: ${machines.length}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    // Display summary by area
    const byArea = {};
    machines.forEach(m => {
      byArea[m.area] = (byArea[m.area] || 0) + 1;
    });
    console.log('📊 Machines by area:');
    Object.entries(byArea).forEach(([area, count]) => {
      console.log(`   ${area}: ${count}`);
    });

    console.log('\n✨ Seed file updated with actual PostgreSQL data!');
    console.log('   You can now use this seed file to restore the same data.');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error syncing machines data:', error);
    process.exit(1);
  }
}

syncMachinesFromDB();


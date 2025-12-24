import { query } from '../database/connection.js';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function exportMachinesData() {
  try {
    console.log('📤 Exporting machines data from PostgreSQL...\n');

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
        health_score, vibration_level, runtime_hours,
        last_updated, created_at, updated_at
      FROM machines
      ORDER BY area, id
    `);

    if (result.rows.length === 0) {
      console.log('⚠️  No machines found in database.');
      console.log('   Please ensure you have data in the machines table.');
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

    // Generate JavaScript code for seed file
    let jsCode = `    const machines = [\n`;
    
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
      
      jsCode += machineStr;
    });
    
    jsCode += `    ];\n`;

    // Save to file
    const outputPath = path.join(__dirname, 'exported-machines-data.js');
    fs.writeFileSync(outputPath, jsCode, 'utf8');

    console.log('✅ Machines data exported successfully!');
    console.log(`📁 Output file: ${outputPath}\n`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`   📦 Total machines: ${machines.length}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    console.log('📝 Next step:');
    console.log('   1. Review the exported data in: backend/scripts/exported-machines-data.js');
    console.log('   2. Copy the machines array to seed-sample-data.js');
    console.log('   3. Update the INSERT query in seed-sample-data.js to include equipment fields if needed\n');

    // Also display summary by area
    const byArea = {};
    machines.forEach(m => {
      byArea[m.area] = (byArea[m.area] || 0) + 1;
    });
    console.log('📊 Machines by area:');
    Object.entries(byArea).forEach(([area, count]) => {
      console.log(`   ${area}: ${count}`);
    });

    process.exit(0);
  } catch (error) {
    console.error('❌ Error exporting machines data:', error);
    process.exit(1);
  }
}

exportMachinesData();


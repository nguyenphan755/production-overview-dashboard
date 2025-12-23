import { query } from '../database/connection.js';
import dotenv from 'dotenv';

dotenv.config();

// Helper function to generate time series data
function generateTimeSeriesData(startValue, endValue, points = 7, minutesAgo = 30) {
  const data = [];
  const now = new Date();
  const interval = minutesAgo / points; // minutes between points
  
  for (let i = points - 1; i >= 0; i--) {
    const time = new Date(now.getTime() - i * interval * 60000);
    const progress = i / (points - 1);
    const value = startValue + (endValue - startValue) * (1 - progress) + (Math.random() - 0.5) * (endValue * 0.05);
    data.push({
      timestamp: time,
      value: Math.max(0, value),
    });
  }
  return data;
}

async function seedSampleData() {
  try {
    console.log('🌱 Seeding comprehensive sample data...');

    // Clear existing data (optional - comment out if you want to keep existing data)
    console.log('🗑️  Clearing existing data...');
    await query('TRUNCATE TABLE alarms, machine_metrics, energy_consumption, production_orders, machines CASCADE');

    // ============================================
    // 1. INSERT ALL MACHINES (20 machines total)
    // ============================================
    console.log('📦 Inserting machines...');

    const machines = [
      // Drawing machines (8 machines)
      {
        id: 'D-01', name: 'Drawing Line 01', area: 'drawing', status: 'running',
        line_speed: 920, target_speed: 1000, produced_length: 3850, target_length: 5000,
        production_order_id: 'PO-2024-156', production_order_name: 'PO-2024-156',
        operator_name: 'Nguyễn Văn An', oee: 83.6, availability: 94.5, performance: 89.2, quality: 99.1,
        current: 45.2, power: 68.5, temperature: 68,
        multi_zone_temperatures: JSON.stringify({ zone1: 148, zone2: 161, zone3: 169, zone4: 155 }),
      },
      {
        id: 'D-02', name: 'Drawing Line 02', area: 'drawing', status: 'running',
        line_speed: 875, target_speed: 1000, produced_length: 4200, target_length: 5000,
        production_order_id: 'PO-2024-157', production_order_name: 'PO-2024-157',
        operator_name: 'Trần Thị Bình', oee: 81.2, availability: 92.3, performance: 87.5, quality: 98.8,
        current: 43.8, power: 65.2, temperature: 72,
        multi_zone_temperatures: null,
      },
      {
        id: 'D-03', name: 'Drawing Line 03', area: 'drawing', status: 'running',
        line_speed: 885, target_speed: 1000, produced_length: 3980, target_length: 5000,
        production_order_id: 'PO-2024-158', production_order_name: 'PO-2024-158',
        operator_name: 'Lê Văn Cường', oee: 82.5, availability: 93.1, performance: 88.5, quality: 99.0,
        current: 44.1, power: 66.8, temperature: 70,
        multi_zone_temperatures: null,
      },
      {
        id: 'D-04', name: 'Drawing Line 04', area: 'drawing', status: 'stopped',
        line_speed: 0, target_speed: 1000, produced_length: 0, target_length: null,
        production_order_id: null, production_order_name: null,
        operator_name: 'Phạm Thị Dung', oee: 0, availability: 0, performance: 0, quality: 0,
        current: 0, power: 2.1, temperature: 45,
        multi_zone_temperatures: null,
      },
      {
        id: 'D-05', name: 'Drawing Line 05', area: 'drawing', status: 'setup',
        line_speed: 810, target_speed: 1000, produced_length: 2100, target_length: 5000,
        production_order_id: 'PO-2024-159', production_order_name: 'PO-2024-159',
        operator_name: 'Hoàng Văn Em', oee: 75.3, availability: 88.2, performance: 81.0, quality: 97.5,
        current: 38.2, power: 55.3, temperature: 82,
        multi_zone_temperatures: null,
      },
      {
        id: 'D-06', name: 'Drawing Line 06', area: 'drawing', status: 'running',
        line_speed: 895, target_speed: 1000, produced_length: 4450, target_length: 5000,
        production_order_id: 'PO-2024-160', production_order_name: 'PO-2024-160',
        operator_name: 'Vũ Thị Phương', oee: 84.2, availability: 95.1, performance: 89.5, quality: 99.2,
        current: 45.8, power: 69.2, temperature: 69,
        multi_zone_temperatures: null,
      },
      {
        id: 'D-07', name: 'Drawing Line 07', area: 'drawing', status: 'running',
        line_speed: 840, target_speed: 1000, produced_length: 3650, target_length: 5000,
        production_order_id: 'PO-2024-161', production_order_name: 'PO-2024-161',
        operator_name: 'Đỗ Văn Giang', oee: 79.8, availability: 91.2, performance: 84.0, quality: 98.5,
        current: 42.3, power: 63.5, temperature: 71,
        multi_zone_temperatures: null,
      },
      {
        id: 'D-08', name: 'Drawing Line 08', area: 'drawing', status: 'error',
        line_speed: 0, target_speed: 1000, produced_length: 0, target_length: null,
        production_order_id: null, production_order_name: null,
        operator_name: 'Bùi Thị Hoa', oee: 0, availability: 0, performance: 0, quality: 0,
        current: 0, power: 0, temperature: 85,
        multi_zone_temperatures: null,
      },
      // Stranding machines (5 machines)
      {
        id: 'S-01', name: 'Stranding Unit 01', area: 'stranding', status: 'running',
        line_speed: 650, target_speed: 720, produced_length: 2800, target_length: 3500,
        production_order_id: 'PO-2024-162', production_order_name: 'PO-2024-162',
        operator_name: 'Nguyễn Văn Khoa', oee: 78.5, availability: 90.2, performance: 90.3, quality: 96.5,
        current: 38.5, power: 52.3, temperature: 65,
        multi_zone_temperatures: null,
      },
      {
        id: 'S-02', name: 'Stranding Unit 02', area: 'stranding', status: 'running',
        line_speed: 680, target_speed: 720, produced_length: 2950, target_length: 3500,
        production_order_id: 'PO-2024-163', production_order_name: 'PO-2024-163',
        operator_name: 'Trần Thị Lan', oee: 81.2, availability: 92.5, performance: 94.4, quality: 97.8,
        current: 40.2, power: 54.8, temperature: 68,
        multi_zone_temperatures: null,
      },
      {
        id: 'S-03', name: 'Stranding Unit 03', area: 'stranding', status: 'running',
        line_speed: 625, target_speed: 720, produced_length: 2650, target_length: 3500,
        production_order_id: 'PO-2024-164', production_order_name: 'PO-2024-164',
        operator_name: 'Lê Văn Minh', oee: 76.3, availability: 88.7, performance: 86.8, quality: 96.2,
        current: 36.8, power: 50.1, temperature: 63,
        multi_zone_temperatures: null,
      },
      {
        id: 'S-04', name: 'Stranding Unit 04', area: 'stranding', status: 'stopped',
        line_speed: 0, target_speed: 720, produced_length: 0, target_length: null,
        production_order_id: null, production_order_name: null,
        operator_name: 'Phạm Thị Nga', oee: 0, availability: 0, performance: 0, quality: 0,
        current: 0, power: 1.5, temperature: 42,
        multi_zone_temperatures: null,
      },
      {
        id: 'S-05', name: 'Stranding Unit 05', area: 'stranding', status: 'running',
        line_speed: 665, target_speed: 720, produced_length: 2880, target_length: 3500,
        production_order_id: 'PO-2024-165', production_order_name: 'PO-2024-165',
        operator_name: 'Hoàng Văn Oanh', oee: 79.8, availability: 91.3, performance: 92.4, quality: 97.1,
        current: 39.5, power: 53.6, temperature: 66,
        multi_zone_temperatures: null,
      },
      // Armoring machines (3 machines)
      {
        id: 'A-01', name: 'Armoring Line 01', area: 'armoring', status: 'running',
        line_speed: 320, target_speed: 350, produced_length: 1850, target_length: 2500,
        production_order_id: 'PO-2024-166', production_order_name: 'PO-2024-166',
        operator_name: 'Vũ Thị Phượng', oee: 82.1, availability: 93.5, performance: 91.4, quality: 98.2,
        current: 28.3, power: 42.5, temperature: 55,
        multi_zone_temperatures: null,
      },
      {
        id: 'A-02', name: 'Armoring Line 02', area: 'armoring', status: 'running',
        line_speed: 310, target_speed: 350, produced_length: 1750, target_length: 2500,
        production_order_id: 'PO-2024-167', production_order_name: 'PO-2024-167',
        operator_name: 'Đỗ Văn Quang', oee: 80.5, availability: 92.1, performance: 88.6, quality: 97.8,
        current: 27.5, power: 41.2, temperature: 58,
        multi_zone_temperatures: null,
      },
      {
        id: 'A-03', name: 'Armoring Line 03', area: 'armoring', status: 'idle',
        line_speed: 0, target_speed: 350, produced_length: 0, target_length: null,
        production_order_id: null, production_order_name: null,
        operator_name: 'Bùi Thị Rương', oee: 0, availability: 0, performance: 0, quality: 0,
        current: 0, power: 1.2, temperature: 38,
        multi_zone_temperatures: null,
      },
      // Sheathing machines (6 machines)
      {
        id: 'SH-01', name: 'Sheathing Line 01', area: 'sheathing', status: 'running',
        line_speed: 450, target_speed: 500, produced_length: 2200, target_length: 3000,
        production_order_id: 'PO-2024-168', production_order_name: 'PO-2024-168',
        operator_name: 'Nguyễn Văn Sơn', oee: 85.2, availability: 94.8, performance: 90.0, quality: 99.5,
        current: 52.3, power: 78.5, temperature: 70,
        multi_zone_temperatures: JSON.stringify({ zone1: 145, zone2: 158, zone3: 165, zone4: 152 }),
      },
      {
        id: 'SH-02', name: 'Sheathing Line 02', area: 'sheathing', status: 'running',
        line_speed: 425, target_speed: 500, produced_length: 2100, target_length: 3000,
        production_order_id: 'PO-2024-169', production_order_name: 'PO-2024-169',
        operator_name: 'Trần Thị Tuyết', oee: 83.7, availability: 93.2, performance: 85.0, quality: 99.2,
        current: 50.8, power: 76.2, temperature: 68,
        multi_zone_temperatures: JSON.stringify({ zone1: 142, zone2: 155, zone3: 162, zone4: 149 }),
      },
      {
        id: 'SH-03', name: 'Sheathing Line 03', area: 'sheathing', status: 'stopped',
        line_speed: 0, target_speed: 500, produced_length: 0, target_length: null,
        production_order_id: null, production_order_name: null,
        operator_name: 'Lê Văn Uyên', oee: 0, availability: 0, performance: 0, quality: 0,
        current: 0, power: 3.2, temperature: 48,
        multi_zone_temperatures: null,
      },
      {
        id: 'SH-04', name: 'Sheathing Line 04', area: 'sheathing', status: 'running',
        line_speed: 440, target_speed: 500, produced_length: 2150, target_length: 3000,
        production_order_id: 'PO-2024-170', production_order_name: 'PO-2024-170',
        operator_name: 'Phạm Thị Vân', oee: 84.5, availability: 94.1, performance: 88.0, quality: 99.3,
        current: 51.1, power: 76.8, temperature: 69,
        multi_zone_temperatures: JSON.stringify({ zone1: 144, zone2: 157, zone3: 164, zone4: 151 }),
      },
      {
        id: 'SH-05', name: 'Sheathing Line 05', area: 'sheathing', status: 'setup',
        line_speed: 410, target_speed: 500, produced_length: 1950, target_length: 3000,
        production_order_id: 'PO-2024-171', production_order_name: 'PO-2024-171',
        operator_name: 'Hoàng Văn Xuyên', oee: 77.8, availability: 89.5, performance: 82.0, quality: 98.1,
        current: 48.2, power: 72.3, temperature: 75,
        multi_zone_temperatures: JSON.stringify({ zone1: 150, zone2: 163, zone3: 170, zone4: 157 }),
      },
      {
        id: 'SH-06', name: 'Sheathing Line 06', area: 'sheathing', status: 'error',
        line_speed: 0, target_speed: 500, produced_length: 0, target_length: null,
        production_order_id: null, production_order_name: null,
        operator_name: 'Vũ Thị Yến', oee: 0, availability: 0, performance: 0, quality: 0,
        current: 0, power: 0, temperature: 85,
        multi_zone_temperatures: null,
      },
    ];

    for (const machine of machines) {
      await query(
        `INSERT INTO machines (
          id, name, area, status, line_speed, target_speed, produced_length, target_length,
          production_order_id, production_order_name, operator_name, oee, availability,
          performance, quality, current, power, temperature, multi_zone_temperatures, last_updated
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, CURRENT_TIMESTAMP)
        ON CONFLICT (id) DO UPDATE SET
          name = EXCLUDED.name, area = EXCLUDED.area, status = EXCLUDED.status,
          line_speed = EXCLUDED.line_speed, target_speed = EXCLUDED.target_speed,
          produced_length = EXCLUDED.produced_length, target_length = EXCLUDED.target_length,
          production_order_id = EXCLUDED.production_order_id,
          production_order_name = EXCLUDED.production_order_name,
          operator_name = EXCLUDED.operator_name, oee = EXCLUDED.oee,
          availability = EXCLUDED.availability, performance = EXCLUDED.performance,
          quality = EXCLUDED.quality, current = EXCLUDED.current, power = EXCLUDED.power,
          temperature = EXCLUDED.temperature, multi_zone_temperatures = EXCLUDED.multi_zone_temperatures,
          last_updated = CURRENT_TIMESTAMP`,
        [
          machine.id, machine.name, machine.area, machine.status,
          machine.line_speed, machine.target_speed, machine.produced_length, machine.target_length,
          machine.production_order_id, machine.production_order_name, machine.operator_name,
          machine.oee, machine.availability, machine.performance, machine.quality,
          machine.current, machine.power, machine.temperature, machine.multi_zone_temperatures,
        ]
      );
    }
    console.log(`   ✅ Inserted ${machines.length} machines`);

    // ============================================
    // 2. INSERT PRODUCTION ORDERS
    // ============================================
    console.log('📋 Inserting production orders...');

    const now = new Date();
    const orders = [
      // Current running orders
      {
        id: 'PO-2024-156', name: 'PO-2024-156', product_name: 'CV 3x2.5mm²', customer: 'Công ty ABC',
        machine_id: 'D-01', start_time: new Date(now.getTime() - 4.25 * 3600000),
        produced_length: 3850, target_length: 5000, status: 'running',
      },
      {
        id: 'PO-2024-157', name: 'PO-2024-157', product_name: 'CV 3x4.0mm²', customer: 'Nhà máy XYZ',
        machine_id: 'D-02', start_time: new Date(now.getTime() - 3.5 * 3600000),
        produced_length: 4200, target_length: 5000, status: 'running',
      },
      {
        id: 'PO-2024-158', name: 'PO-2024-158', product_name: 'CV 3x1.5mm²', customer: 'Tổng công ty DEF',
        machine_id: 'D-03', start_time: new Date(now.getTime() - 3.8 * 3600000),
        produced_length: 3980, target_length: 5000, status: 'running',
      },
      {
        id: 'PO-2024-159', name: 'PO-2024-159', product_name: 'CV 3x2.5mm²', customer: 'Công ty GHI',
        machine_id: 'D-05', start_time: new Date(now.getTime() - 2.1 * 3600000),
        produced_length: 2100, target_length: 5000, status: 'running',
      },
      {
        id: 'PO-2024-160', name: 'PO-2024-160', product_name: 'CV 3x4.0mm²', customer: 'Nhà máy JKL',
        machine_id: 'D-06', start_time: new Date(now.getTime() - 4.5 * 3600000),
        produced_length: 4450, target_length: 5000, status: 'running',
      },
      {
        id: 'PO-2024-161', name: 'PO-2024-161', product_name: 'CV 3x2.5mm²', customer: 'Công ty MNO',
        machine_id: 'D-07', start_time: new Date(now.getTime() - 3.9 * 3600000),
        produced_length: 3650, target_length: 5000, status: 'running',
      },
      {
        id: 'PO-2024-162', name: 'PO-2024-162', product_name: 'CV 3x6.0mm²', customer: 'Công ty PQR',
        machine_id: 'S-01', start_time: new Date(now.getTime() - 3.2 * 3600000),
        produced_length: 2800, target_length: 3500, status: 'running',
      },
      {
        id: 'PO-2024-163', name: 'PO-2024-163', product_name: 'CV 3x4.0mm²', customer: 'Nhà máy STU',
        machine_id: 'S-02', start_time: new Date(now.getTime() - 3.5 * 3600000),
        produced_length: 2950, target_length: 3500, status: 'running',
      },
      {
        id: 'PO-2024-164', name: 'PO-2024-164', product_name: 'CV 3x2.5mm²', customer: 'Tổng công ty VWX',
        machine_id: 'S-03', start_time: new Date(now.getTime() - 3.0 * 3600000),
        produced_length: 2650, target_length: 3500, status: 'running',
      },
      {
        id: 'PO-2024-165', name: 'PO-2024-165', product_name: 'CV 3x4.0mm²', customer: 'Công ty YZA',
        machine_id: 'S-05', start_time: new Date(now.getTime() - 3.3 * 3600000),
        produced_length: 2880, target_length: 3500, status: 'running',
      },
      {
        id: 'PO-2024-166', name: 'PO-2024-166', product_name: 'CV 3x10.0mm²', customer: 'Nhà máy BCD',
        machine_id: 'A-01', start_time: new Date(now.getTime() - 4.5 * 3600000),
        produced_length: 1850, target_length: 2500, status: 'running',
      },
      {
        id: 'PO-2024-167', name: 'PO-2024-167', product_name: 'CV 3x16.0mm²', customer: 'Công ty EFG',
        machine_id: 'A-02', start_time: new Date(now.getTime() - 4.2 * 3600000),
        produced_length: 1750, target_length: 2500, status: 'running',
      },
      {
        id: 'PO-2024-168', name: 'PO-2024-168', product_name: 'CV 3x2.5mm²', customer: 'Công ty HIJ',
        machine_id: 'SH-01', start_time: new Date(now.getTime() - 4.0 * 3600000),
        produced_length: 2200, target_length: 3000, status: 'running',
      },
      {
        id: 'PO-2024-169', name: 'PO-2024-169', product_name: 'CV 3x4.0mm²', customer: 'Nhà máy KLM',
        machine_id: 'SH-02', start_time: new Date(now.getTime() - 3.8 * 3600000),
        produced_length: 2100, target_length: 3000, status: 'running',
      },
      {
        id: 'PO-2024-170', name: 'PO-2024-170', product_name: 'CV 3x2.5mm²', customer: 'Tổng công ty NOP',
        machine_id: 'SH-04', start_time: new Date(now.getTime() - 3.6 * 3600000),
        produced_length: 2150, target_length: 3000, status: 'running',
      },
      {
        id: 'PO-2024-171', name: 'PO-2024-171', product_name: 'CV 3x1.5mm²', customer: 'Công ty QRS',
        machine_id: 'SH-05', start_time: new Date(now.getTime() - 3.2 * 3600000),
        produced_length: 1950, target_length: 3000, status: 'running',
      },
      // Completed orders (for history)
      {
        id: 'PO-2024-155', name: 'PO-2024-155', product_name: 'CV 3x4.0mm²', customer: 'Nhà máy XYZ',
        machine_id: 'D-01', start_time: new Date(now.getTime() - 7.5 * 3600000),
        end_time: new Date(now.getTime() - 3.9 * 3600000),
        produced_length: 4500, target_length: 4500, status: 'completed', duration: '3h 40m',
      },
      {
        id: 'PO-2024-154', name: 'PO-2024-154', product_name: 'CV 3x1.5mm²', customer: 'Tổng công ty DEF',
        machine_id: 'D-02', start_time: new Date(now.getTime() - 10.5 * 3600000),
        end_time: new Date(now.getTime() - 7.4 * 3600000),
        produced_length: 3200, target_length: 3200, status: 'completed', duration: '3h 10m',
      },
      {
        id: 'PO-2024-153', name: 'PO-2024-153', product_name: 'CV 3x2.5mm²', customer: 'Công ty GHI',
        machine_id: 'D-01', start_time: new Date(now.getTime() - 13.5 * 3600000),
        end_time: new Date(now.getTime() - 10.2 * 3600000),
        produced_length: 2800, target_length: 3500, status: 'interrupted', duration: '3h 25m',
      },
      {
        id: 'PO-2024-152', name: 'PO-2024-152', product_name: 'CV 3x6.0mm²', customer: 'Nhà máy ABC',
        machine_id: 'S-01', start_time: new Date(now.getTime() - 8.0 * 3600000),
        end_time: new Date(now.getTime() - 4.5 * 3600000),
        produced_length: 3500, target_length: 3500, status: 'completed', duration: '3h 30m',
      },
      {
        id: 'PO-2024-151', name: 'PO-2024-151', product_name: 'CV 3x10.0mm²', customer: 'Công ty DEF',
        machine_id: 'A-01', start_time: new Date(now.getTime() - 6.5 * 3600000),
        end_time: new Date(now.getTime() - 2.0 * 3600000),
        produced_length: 2500, target_length: 2500, status: 'completed', duration: '4h 30m',
      },
    ];

    for (const order of orders) {
      await query(
        `INSERT INTO production_orders (
          id, name, product_name, customer, machine_id, start_time, end_time,
          produced_length, target_length, status, duration
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        ON CONFLICT (id) DO UPDATE SET
          name = EXCLUDED.name, product_name = EXCLUDED.product_name,
          customer = EXCLUDED.customer, machine_id = EXCLUDED.machine_id,
          start_time = EXCLUDED.start_time, end_time = EXCLUDED.end_time,
          produced_length = EXCLUDED.produced_length, target_length = EXCLUDED.target_length,
          status = EXCLUDED.status, duration = EXCLUDED.duration,
          updated_at = CURRENT_TIMESTAMP`,
        [
          order.id, order.name, order.product_name, order.customer,
          order.machine_id, order.start_time, order.end_time || null,
          order.produced_length, order.target_length, order.status, order.duration || null,
        ]
      );
    }
    console.log(`   ✅ Inserted ${orders.length} production orders`);

    // ============================================
    // 3. INSERT ALARMS
    // ============================================
    console.log('🚨 Inserting alarms...');

    const alarms = [
      {
        id: 'ALM-001', machine_id: 'D-08', severity: 'error',
        message: 'Motor overload detected', timestamp: new Date(now.getTime() - 5 * 60000),
      },
      {
        id: 'ALM-002', machine_id: 'SH-06', severity: 'error',
        message: 'Temperature sensor failure', timestamp: new Date(now.getTime() - 10 * 60000),
      },
      {
        id: 'ALM-003', machine_id: 'D-05', severity: 'warning',
        message: 'Temperature approaching limit', timestamp: new Date(now.getTime() - 15 * 60000),
      },
    ];

    for (const alarm of alarms) {
      await query(
        `INSERT INTO alarms (id, machine_id, severity, message, timestamp, acknowledged)
         VALUES ($1, $2, $3, $4, $5, FALSE)
         ON CONFLICT (id) DO UPDATE SET
           machine_id = EXCLUDED.machine_id, severity = EXCLUDED.severity,
           message = EXCLUDED.message, timestamp = EXCLUDED.timestamp`,
        [alarm.id, alarm.machine_id, alarm.severity, alarm.message, alarm.timestamp]
      );
    }
    console.log(`   ✅ Inserted ${alarms.length} alarms`);

    // ============================================
    // 4. INSERT TIME-SERIES METRICS
    // ============================================
    console.log('📊 Inserting time-series metrics...');

    let metricsCount = 0;

    // For each running machine, insert metrics
    for (const machine of machines.filter(m => m.status === 'running' && m.line_speed > 0)) {
      // Speed trend (last 30 minutes, 5-min intervals = 7 points)
      const speedData = generateTimeSeriesData(
        machine.line_speed * 0.95,
        machine.line_speed,
        7,
        30
      );
      for (const point of speedData) {
        await query(
          `INSERT INTO machine_metrics (machine_id, metric_type, value, target_value, timestamp)
           VALUES ($1, 'speed', $2, $3, $4)`,
          [machine.id, point.value, machine.target_speed, point.timestamp]
        );
        metricsCount++;
      }

      // Temperature trend
      if (machine.temperature) {
        const tempData = generateTimeSeriesData(
          machine.temperature - 5,
          machine.temperature,
          7,
          30
        );
        for (const point of tempData) {
          await query(
            `INSERT INTO machine_metrics (machine_id, metric_type, value, timestamp)
             VALUES ($1, 'temperature', $2, $3)`,
            [machine.id, point.value, point.timestamp]
          );
          metricsCount++;
        }
      }

      // Current trend
      if (machine.current) {
        const currentData = generateTimeSeriesData(
          machine.current - 3,
          machine.current,
          7,
          30
        );
        for (const point of currentData) {
          await query(
            `INSERT INTO machine_metrics (machine_id, metric_type, value, timestamp)
             VALUES ($1, 'current', $2, $3)`,
            [machine.id, point.value, point.timestamp]
          );
          metricsCount++;
        }
      }

      // Power trend (last 2 hours, 15-min intervals = 9 points)
      if (machine.power) {
        const powerData = generateTimeSeriesData(
          machine.power - 5,
          machine.power,
          9,
          120
        );
        for (const point of powerData) {
          await query(
            `INSERT INTO machine_metrics (machine_id, metric_type, value, timestamp)
             VALUES ($1, 'power', $2, $3)`,
            [machine.id, point.value, point.timestamp]
          );
          metricsCount++;
        }
      }

      // Multi-zone temperatures (for machines with multi-zone)
      if (machine.multi_zone_temperatures) {
        const zones = JSON.parse(machine.multi_zone_temperatures);
        const zoneData = generateTimeSeriesData(140, 170, 7, 35);
        for (let i = 0; i < zoneData.length; i++) {
          const point = zoneData[i];
          for (let zone = 1; zone <= 4; zone++) {
            const zoneKey = `zone${zone}`;
            if (zones[zoneKey]) {
              const zoneValue = zones[zoneKey] + (Math.random() - 0.5) * 5;
              await query(
                `INSERT INTO machine_metrics (machine_id, metric_type, value, zone_number, timestamp)
                 VALUES ($1, 'multi_zone_temp', $2, $3, $4)`,
                [machine.id, zoneValue, zone, point.timestamp]
              );
              metricsCount++;
            }
          }
        }
      }
    }
    console.log(`   ✅ Inserted ${metricsCount} metric data points`);

    // ============================================
    // 5. INSERT ENERGY CONSUMPTION
    // ============================================
    console.log('⚡ Inserting energy consumption data...');

    let energyCount = 0;
    for (const machine of machines.filter(m => m.power && m.power > 0)) {
      // Last 24 hours, hourly data (8 points for sample)
      for (let i = 7; i >= 0; i--) {
        const hour = new Date(now.getTime() - i * 3600000);
        const energy = (machine.power * 0.8) + Math.random() * 10; // kWh approximation
        await query(
          `INSERT INTO energy_consumption (machine_id, energy_kwh, hour)
           VALUES ($1, $2, $3)`,
          [machine.id, energy, hour]
        );
        energyCount++;
      }
    }
    console.log(`   ✅ Inserted ${energyCount} energy consumption records`);

    // ============================================
    // SUMMARY
    // ============================================
    console.log('\n✅ Sample data seeded successfully!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`   📦 Machines: ${machines.length}`);
    console.log(`   📋 Production Orders: ${orders.length}`);
    console.log(`   🚨 Alarms: ${alarms.length}`);
    console.log(`   📊 Metrics: ${metricsCount} data points`);
    console.log(`   ⚡ Energy Records: ${energyCount}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('\n🎉 Database is ready with complete sample data!');
    console.log('   You can now start the API server and connect the frontend.');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error seeding data:', error);
    process.exit(1);
  }
}

seedSampleData();

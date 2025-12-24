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
    // 1. INSERT ALL MACHINES (30 machines - synced from PostgreSQL)
    // ============================================
    console.log('📦 Inserting machines...');

    const machines = [
      {
        id: 'D-01', name: 'DA13', area: 'drawing', status: 'running',
        line_speed: 936, target_speed: 1000, produced_length: 3850, target_length: 5000,
        production_order_id: 'PO-2024-156', production_order_name: 'PO-2024-156',
        operator_name: 'Nguyễn Văn An', oee: 83.6, availability: 94.5, performance: 89.2, quality: 99.1,
        current: 50.22, power: 79.55, temperature: 73.18,
        multi_zone_temperatures: JSON.stringify({"zone1":148,"zone2":161,"zone3":169,"zone4":155}),
        health_score: 88, vibration_level: 'Normal', runtime_hours: 199.05,
      },
      {
        id: 'D-02', name: 'LHT-1', area: 'drawing', status: 'running',
        line_speed: 857, target_speed: 1000, produced_length: 4200, target_length: 5000,
        production_order_id: 'PO-2024-157', production_order_name: 'PO-2024-157',
        operator_name: 'Trần Thị Bình', oee: 81.2, availability: 92.3, performance: 87.5, quality: 98.8,
        current: 46.31, power: 78.12, temperature: 72.04,
        multi_zone_temperatures: null,
        health_score: 96, vibration_level: 'Normal', runtime_hours: 171.59,
      },
      {
        id: 'D-03', name: 'LHT-2', area: 'drawing', status: 'running',
        line_speed: 983, target_speed: 1000, produced_length: 3980, target_length: 5000,
        production_order_id: 'PO-2024-158', production_order_name: 'PO-2024-158',
        operator_name: 'Lê Văn Cường', oee: 82.5, availability: 93.1, performance: 88.5, quality: 99,
        current: 42.77, power: 73.85, temperature: 68.75,
        multi_zone_temperatures: null,
        health_score: 86, vibration_level: 'Normal', runtime_hours: 182.97,
      },
      {
        id: 'D-04', name: 'WG', area: 'drawing', status: 'idle',
        line_speed: 935, target_speed: 1000, produced_length: 0, target_length: null,
        production_order_id: null, production_order_name: null,
        operator_name: 'Phạm Thị Dung', oee: 0, availability: 0, performance: 0, quality: 0,
        current: 45.89, power: 76.39, temperature: 69.6,
        multi_zone_temperatures: null,
        health_score: 99, vibration_level: 'Normal', runtime_hours: 163.64,
      },
      {
        id: 'D-05', name: 'LSD', area: 'drawing', status: 'idle',
        line_speed: 964, target_speed: 1000, produced_length: 2100, target_length: 5000,
        production_order_id: 'PO-2024-159', production_order_name: 'PO-2024-159',
        operator_name: 'Hoàng Văn Em', oee: 75.3, availability: 88.2, performance: 81, quality: 97.5,
        current: 42.95, power: 62.31, temperature: 70.78,
        multi_zone_temperatures: null,
        health_score: 85, vibration_level: 'Normal', runtime_hours: 151.29,
      },
      {
        id: 'D-06', name: 'LHD450', area: 'drawing', status: 'error',
        line_speed: 875, target_speed: 1000, produced_length: 4450, target_length: 5000,
        production_order_id: 'PO-2024-160', production_order_name: 'PO-2024-160',
        operator_name: 'Vũ Thị Phương', oee: 84.2, availability: 95.1, performance: 89.5, quality: 99.2,
        current: 41.48, power: 78.65, temperature: 67.86,
        multi_zone_temperatures: null,
        health_score: 95, vibration_level: 'Normal', runtime_hours: 184.38,
      },
      {
        id: 'S-01', name: '1+1+3', area: 'stranding', status: 'idle',
        line_speed: 934, target_speed: 720, produced_length: 2800, target_length: 3500,
        production_order_id: 'PO-2024-162', production_order_name: 'PO-2024-162',
        operator_name: 'Nguyễn Văn Khoa', oee: 78.5, availability: 90.2, performance: 90.3, quality: 96.5,
        current: 51.79, power: 78.67, temperature: 73.88,
        multi_zone_temperatures: null,
        health_score: 86, vibration_level: 'Normal', runtime_hours: 185.33,
      },
      {
        id: 'S-02', name: '1250', area: 'stranding', status: 'running',
        line_speed: 811, target_speed: 720, produced_length: 2950, target_length: 3500,
        production_order_id: 'PO-2024-163', production_order_name: 'PO-2024-163',
        operator_name: 'Trần Thị Lan', oee: 81.2, availability: 92.5, performance: 94.4, quality: 97.8,
        current: 48.19, power: 71.8, temperature: 70.33,
        multi_zone_temperatures: null,
        health_score: 97, vibration_level: 'Normal', runtime_hours: 156.57,
      },
      {
        id: 'S-03', name: '54-1', area: 'stranding', status: 'idle',
        line_speed: 834, target_speed: 720, produced_length: 2650, target_length: 3500,
        production_order_id: 'PO-2024-164', production_order_name: 'PO-2024-164',
        operator_name: 'Lê Văn Minh', oee: 76.3, availability: 88.7, performance: 86.8, quality: 96.2,
        current: 46.15, power: 73.3, temperature: 73.69,
        multi_zone_temperatures: null,
        health_score: 92, vibration_level: 'Normal', runtime_hours: 193.71,
      },
      {
        id: 'S-04', name: '54-2', area: 'stranding', status: 'warning',
        line_speed: 847, target_speed: 720, produced_length: 0, target_length: null,
        production_order_id: null, production_order_name: null,
        operator_name: 'Phạm Thị Nga', oee: 0, availability: 0, performance: 0, quality: 0,
        current: 43.14, power: 77.28, temperature: 68.24,
        multi_zone_temperatures: null,
        health_score: 99, vibration_level: 'Normal', runtime_hours: 165,
      },
      {
        id: 'S-05', name: '3H2', area: 'stranding', status: 'idle',
        line_speed: 801, target_speed: 720, produced_length: 2880, target_length: 3500,
        production_order_id: 'PO-2024-165', production_order_name: 'PO-2024-165',
        operator_name: 'Hoàng Văn Oanh', oee: 79.8, availability: 91.3, performance: 92.4, quality: 97.1,
        current: 49.14, power: 73.01, temperature: 71.26,
        multi_zone_temperatures: null,
        health_score: 90, vibration_level: 'Normal', runtime_hours: 159.5,
      },
      {
        id: 'S-06', name: '7-600', area: 'stranding', status: 'idle',
        line_speed: 844, target_speed: 720, produced_length: 2880, target_length: 3500,
        production_order_id: 'PO-2024-165', production_order_name: 'PO-2024-165',
        operator_name: 'Hoàng Văn Oanh', oee: 79.8, availability: 91.3, performance: 92.4, quality: 97.1,
        current: 49.28, power: 64.92, temperature: 68.61,
        multi_zone_temperatures: null,
        health_score: 100, vibration_level: 'Normal', runtime_hours: 161.83,
      },
      {
        id: 'S-07', name: '7-630.1', area: 'stranding', status: 'error',
        line_speed: 905, target_speed: 720, produced_length: 2880, target_length: 3500,
        production_order_id: 'PO-2024-165', production_order_name: 'PO-2024-165',
        operator_name: 'Hoàng Văn Oanh', oee: 79.8, availability: 91.3, performance: 92.4, quality: 97.1,
        current: 47.04, power: 79.32, temperature: 73.16,
        multi_zone_temperatures: null,
        health_score: 98, vibration_level: 'Normal', runtime_hours: 154.14,
      },
      {
        id: 'S-08', name: '7-630.2', area: 'stranding', status: 'running',
        line_speed: 808, target_speed: 720, produced_length: 2880, target_length: 3500,
        production_order_id: 'PO-2024-165', production_order_name: 'PO-2024-165',
        operator_name: 'Hoàng Văn Oanh', oee: 79.8, availability: 91.3, performance: 92.4, quality: 97.1,
        current: 40.53, power: 74.2, temperature: 68.91,
        multi_zone_temperatures: null,
        health_score: 92, vibration_level: 'Normal', runtime_hours: 174.8,
      },
      {
        id: 'S-09', name: 'BOW', area: 'stranding', status: 'warning',
        line_speed: 970, target_speed: 720, produced_length: 2880, target_length: 3500,
        production_order_id: 'PO-2024-165', production_order_name: 'PO-2024-165',
        operator_name: 'Hoàng Văn Oanh', oee: 79.8, availability: 91.3, performance: 92.4, quality: 97.1,
        current: 47.45, power: 68.24, temperature: 70.91,
        multi_zone_temperatures: null,
        health_score: 97, vibration_level: 'Normal', runtime_hours: 150.22,
      },
      {
        id: 'S-10', name: 'SAM', area: 'stranding', status: 'running',
        line_speed: 858, target_speed: 720, produced_length: 2880, target_length: 3500,
        production_order_id: 'PO-2024-165', production_order_name: 'PO-2024-165',
        operator_name: 'Hoàng Văn Oanh', oee: 79.8, availability: 91.3, performance: 92.4, quality: 97.1,
        current: 49.87, power: 61.9, temperature: 65.58,
        multi_zone_temperatures: null,
        health_score: 94, vibration_level: 'Normal', runtime_hours: 198.45,
      },
      {
        id: 'A-01', name: '61', area: 'armoring', status: 'running',
        line_speed: 983, target_speed: 350, produced_length: 1850, target_length: 2500,
        production_order_id: 'PO-2024-166', production_order_name: 'PO-2024-166',
        operator_name: 'Vũ Thị Phượng', oee: 82.1, availability: 93.5, performance: 91.4, quality: 98.2,
        current: 51.24, power: 78.55, temperature: 71.32,
        multi_zone_temperatures: null,
        health_score: 89, vibration_level: 'Normal', runtime_hours: 188.66,
      },
      {
        id: 'A-02', name: 'DRUM', area: 'armoring', status: 'running',
        line_speed: 944, target_speed: 350, produced_length: 1750, target_length: 2500,
        production_order_id: 'PO-2024-167', production_order_name: 'PO-2024-167',
        operator_name: 'Đỗ Văn Quang', oee: 80.5, availability: 92.1, performance: 88.6, quality: 97.8,
        current: 47.71, power: 65.56, temperature: 68.33,
        multi_zone_temperatures: null,
        health_score: 98, vibration_level: 'Normal', runtime_hours: 176.11,
      },
      {
        id: 'A-03', name: 'GB-2', area: 'armoring', status: 'running',
        line_speed: 934, target_speed: 350, produced_length: 0, target_length: null,
        production_order_id: null, production_order_name: null,
        operator_name: 'Bùi Thị Rương', oee: 0, availability: 0, performance: 0, quality: 0,
        current: 43.05, power: 64.19, temperature: 69.48,
        multi_zone_temperatures: null,
        health_score: 98, vibration_level: 'Normal', runtime_hours: 174.92,
      },
      {
        id: 'A-04', name: 'GB-3', area: 'armoring', status: 'idle',
        line_speed: 814, target_speed: 350, produced_length: 0, target_length: null,
        production_order_id: null, production_order_name: null,
        operator_name: 'Bùi Thị Rương', oee: 0, availability: 0, performance: 0, quality: 0,
        current: 45.91, power: 60.08, temperature: 74.76,
        multi_zone_temperatures: null,
        health_score: 91, vibration_level: 'Normal', runtime_hours: 194.33,
      },
      {
        id: 'A-05', name: 'GB-4', area: 'armoring', status: 'idle',
        line_speed: 885, target_speed: 350, produced_length: 0, target_length: null,
        production_order_id: null, production_order_name: null,
        operator_name: 'Bùi Thị Rương', oee: 0, availability: 0, performance: 0, quality: 0,
        current: 42.99, power: 73.85, temperature: 68.29,
        multi_zone_temperatures: null,
        health_score: 96, vibration_level: 'Normal', runtime_hours: 156.8,
      },
      {
        id: 'SH-01', name: '65 LT', area: 'sheathing', status: 'idle',
        line_speed: 912, target_speed: 500, produced_length: 2200, target_length: 3000,
        production_order_id: 'PO-2024-168', production_order_name: 'PO-2024-168',
        operator_name: 'Nguyễn Văn Sơn', oee: 85.2, availability: 94.8, performance: 90, quality: 99.5,
        current: 51.99, power: 79.63, temperature: 73.72,
        multi_zone_temperatures: JSON.stringify({"zone1":145,"zone2":158,"zone3":165,"zone4":152}),
        health_score: 89, vibration_level: 'Normal', runtime_hours: 192.88,
      },
      {
        id: 'SH-02', name: '75-1', area: 'sheathing', status: 'running',
        line_speed: 922, target_speed: 500, produced_length: 2100, target_length: 3000,
        production_order_id: 'PO-2024-169', production_order_name: 'PO-2024-169',
        operator_name: 'Trần Thị Tuyết', oee: 83.7, availability: 93.2, performance: 85, quality: 99.2,
        current: 44.13, power: 67.22, temperature: 72.79,
        multi_zone_temperatures: JSON.stringify({"zone1":142,"zone2":155,"zone3":162,"zone4":149}),
        health_score: 86, vibration_level: 'Normal', runtime_hours: 159.56,
      },
      {
        id: 'SH-03', name: '75C', area: 'sheathing', status: 'error',
        line_speed: 817, target_speed: 500, produced_length: 0, target_length: null,
        production_order_id: null, production_order_name: null,
        operator_name: 'Lê Văn Uyên', oee: 0, availability: 0, performance: 0, quality: 0,
        current: 45.84, power: 69.46, temperature: 73.84,
        multi_zone_temperatures: null,
        health_score: 97, vibration_level: 'Normal', runtime_hours: 174.1,
      },
      {
        id: 'SH-04', name: '90-2', area: 'sheathing', status: 'running',
        line_speed: 984, target_speed: 500, produced_length: 2150, target_length: 3000,
        production_order_id: 'PO-2024-170', production_order_name: 'PO-2024-170',
        operator_name: 'Phạm Thị Vân', oee: 84.5, availability: 94.1, performance: 88, quality: 99.3,
        current: 40.04, power: 61.18, temperature: 70.45,
        multi_zone_temperatures: JSON.stringify({"zone1":144,"zone2":157,"zone3":164,"zone4":151}),
        health_score: 85, vibration_level: 'Normal', runtime_hours: 153.98,
      },
      {
        id: 'SH-05', name: '90-3', area: 'sheathing', status: 'idle',
        line_speed: 851, target_speed: 500, produced_length: 1950, target_length: 3000,
        production_order_id: 'PO-2024-171', production_order_name: 'PO-2024-171',
        operator_name: 'Hoàng Văn Xuyên', oee: 77.8, availability: 89.5, performance: 82, quality: 98.1,
        current: 47.31, power: 78.95, temperature: 72.51,
        multi_zone_temperatures: JSON.stringify({"zone1":150,"zone2":163,"zone3":170,"zone4":157}),
        health_score: 98, vibration_level: 'Normal', runtime_hours: 164.14,
      },
      {
        id: 'SH-06', name: '90-4', area: 'sheathing', status: 'idle',
        line_speed: 928, target_speed: 500, produced_length: 0, target_length: null,
        production_order_id: null, production_order_name: null,
        operator_name: 'Vũ Thị Yến', oee: 0, availability: 0, performance: 0, quality: 0,
        current: 40.87, power: 79.32, temperature: 66.74,
        multi_zone_temperatures: null,
        health_score: 100, vibration_level: 'Normal', runtime_hours: 179.12,
      },
      {
        id: 'SH-07', name: 'CCVL', area: 'sheathing', status: 'warning',
        line_speed: 901, target_speed: 500, produced_length: 0, target_length: null,
        production_order_id: null, production_order_name: null,
        operator_name: 'Vũ Thị Yến', oee: 0, availability: 0, performance: 0, quality: 0,
        current: 40.2, power: 62.65, temperature: 67.05,
        multi_zone_temperatures: null,
        health_score: 85, vibration_level: 'Normal', runtime_hours: 156.83,
      },
      {
        id: 'SH-08', name: '150-1', area: 'sheathing', status: 'error',
        line_speed: 968, target_speed: 500, produced_length: 0, target_length: null,
        production_order_id: null, production_order_name: null,
        operator_name: 'Vũ Thị Yến', oee: 0, availability: 0, performance: 0, quality: 0,
        current: 49.97, power: 77.67, temperature: 69.76,
        multi_zone_temperatures: null,
        health_score: 100, vibration_level: 'Normal', runtime_hours: 155.74,
      },
      {
        id: 'SH-09', name: '150-2', area: 'sheathing', status: 'warning',
        line_speed: 861, target_speed: 500, produced_length: 0, target_length: null,
        production_order_id: null, production_order_name: null,
        operator_name: 'Vũ Thị Yến', oee: 0, availability: 0, performance: 0, quality: 0,
        current: 41.22, power: 62.92, temperature: 66.5,
        multi_zone_temperatures: null,
        health_score: 100, vibration_level: 'Normal', runtime_hours: 159.77,
      },
    ];

    for (const machine of machines) {
      await query(
        `INSERT INTO machines (
          id, name, area, status, line_speed, target_speed, produced_length, target_length,
          production_order_id, production_order_name, operator_name, oee, availability,
          performance, quality, current, power, temperature, multi_zone_temperatures,
          health_score, vibration_level, runtime_hours, last_updated
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, CURRENT_TIMESTAMP)
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
          health_score = EXCLUDED.health_score, vibration_level = EXCLUDED.vibration_level,
          runtime_hours = EXCLUDED.runtime_hours, last_updated = CURRENT_TIMESTAMP`,
        [
          machine.id, machine.name, machine.area, machine.status,
          machine.line_speed, machine.target_speed, machine.produced_length, machine.target_length,
          machine.production_order_id, machine.production_order_name, machine.operator_name,
          machine.oee, machine.availability, machine.performance, machine.quality,
          machine.current, machine.power, machine.temperature, machine.multi_zone_temperatures,
          machine.health_score || null, machine.vibration_level || null, machine.runtime_hours || null,
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
      // Speed trend (last 5 minutes, 30-second intervals = 10 points for better visualization)
      const speedData = generateTimeSeriesData(
        machine.line_speed * 0.95,
        machine.line_speed,
        10,  // 10 points
        5    // 5 minutes window
      );
      for (const point of speedData) {
        await query(
          `INSERT INTO machine_metrics (machine_id, metric_type, value, target_value, timestamp)
           VALUES ($1, 'speed', $2, $3, $4)`,
          [machine.id, point.value, machine.target_speed, point.timestamp]
        );
        metricsCount++;
      }

      // Temperature trend (last 5 minutes, 30-second intervals = 10 points)
      if (machine.temperature) {
        const tempData = generateTimeSeriesData(
          machine.temperature - 5,
          machine.temperature,
          10,  // 10 points
          5    // 5 minutes window
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

      // Current trend (last 5 minutes, 30-second intervals = 10 points)
      if (machine.current) {
        const currentData = generateTimeSeriesData(
          machine.current - 3,
          machine.current,
          10,  // 10 points
          5    // 5 minutes window
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

      // Multi-zone temperatures (last 5 minutes, 30-second intervals = 10 points)
      if (machine.multi_zone_temperatures) {
        const zones = JSON.parse(machine.multi_zone_temperatures);
        const zoneData = generateTimeSeriesData(140, 170, 10, 5);
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

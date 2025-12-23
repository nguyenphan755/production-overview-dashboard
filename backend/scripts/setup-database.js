import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { query } from '../database/connection.js';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function setupDatabase() {
  try {
    console.log('📦 Setting up database schema...');
    
    // Read SQL schema file
    const schemaPath = path.join(__dirname, '../database/schema.sql');
    const schemaSQL = fs.readFileSync(schemaPath, 'utf8');
    
    // Execute schema
    await query(schemaSQL);
    
    console.log('✅ Database schema created successfully!');
    console.log('\n📝 Next steps:');
    console.log('1. Insert sample data using the seed script or your own data');
    console.log('2. Start the API server: npm start');
    console.log('3. Update frontend .env to use real API');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error setting up database:', error);
    process.exit(1);
  }
}

setupDatabase();


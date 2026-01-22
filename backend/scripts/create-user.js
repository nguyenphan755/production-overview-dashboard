import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import { query } from '../database/connection.js';

dotenv.config();

const [,, username, password, role = 'admin'] = process.argv;

if (!username || !password) {
  console.error('Usage: node scripts/create-user.js <username> <password> [role]');
  process.exit(1);
}

const allowedRoles = ['operator', 'engineer', 'supervisor', 'admin'];
if (!allowedRoles.includes(role)) {
  console.error(`Invalid role. Allowed roles: ${allowedRoles.join(', ')}`);
  process.exit(1);
}

const run = async () => {
  const passwordHash = await bcrypt.hash(password, 12);
  const normalizedUsername = username.trim().toLowerCase();
  const result = await query(
    `INSERT INTO mes_users (username, password_hash, role, is_active)
     VALUES ($1, $2, $3, true)
     ON CONFLICT (username)
     DO UPDATE SET password_hash = EXCLUDED.password_hash, role = EXCLUDED.role, is_active = true
     RETURNING id, username, role`,
    [normalizedUsername, passwordHash, role]
  );
  console.log('✅ User created/updated:', result.rows[0]);
  process.exit(0);
};

run().catch((error) => {
  console.error('Failed to create user:', error.message);
  process.exit(1);
});

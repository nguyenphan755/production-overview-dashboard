-- User accounts for MES authentication

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
    CREATE TYPE user_role AS ENUM ('operator', 'engineer', 'supervisor', 'admin');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS mes_users (
  id SERIAL PRIMARY KEY,
  username VARCHAR(150) UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role user_role NOT NULL DEFAULT 'operator',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  plant VARCHAR(100),
  area VARCHAR(100),
  line VARCHAR(100),
  last_login_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_mes_users_role ON mes_users(role);
CREATE INDEX IF NOT EXISTS idx_mes_users_active ON mes_users(is_active);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = 'update_mes_users_updated_at'
  ) THEN
    CREATE TRIGGER update_mes_users_updated_at
      BEFORE UPDATE ON mes_users
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

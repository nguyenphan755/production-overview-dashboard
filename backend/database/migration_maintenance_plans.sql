-- Migration: Maintenance Plans (Lịch bảo trì)
-- Đề xuất cho MES Tag Naming Standard - AVEVA Maintenance Operations
-- Chạy sau khi phê duyệt

-- Enum cho loại bảo trì
DO $$ BEGIN
    CREATE TYPE maintenance_type AS ENUM ('PM', 'CM');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Enum cho trạng thái bảo trì
DO $$ BEGIN
    CREATE TYPE maintenance_status AS ENUM ('scheduled', 'in_progress', 'completed', 'cancelled', 'overdue');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Bảng kế hoạch bảo trì
CREATE TABLE IF NOT EXISTS maintenance_plans (
    id SERIAL PRIMARY KEY,
    machine_id VARCHAR(50) NOT NULL REFERENCES machines(id) ON DELETE CASCADE,
    type maintenance_type NOT NULL,
    status maintenance_status NOT NULL DEFAULT 'scheduled',
    scheduled_at TIMESTAMP NOT NULL,
    completed_at TIMESTAMP,
    interval_hours DECIMAL(10, 2),
    description TEXT,
    requested_by VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Bảng yêu cầu bảo trì từ shopfloor
CREATE TABLE IF NOT EXISTS maintenance_requests (
    id SERIAL PRIMARY KEY,
    machine_id VARCHAR(50) NOT NULL REFERENCES machines(id) ON DELETE CASCADE,
    description TEXT NOT NULL,
    requested_by VARCHAR(255) NOT NULL,
    severity VARCHAR(50) DEFAULT 'normal',
    status VARCHAR(50) DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_maintenance_plans_machine ON maintenance_plans(machine_id);
CREATE INDEX IF NOT EXISTS idx_maintenance_plans_scheduled ON maintenance_plans(scheduled_at);
CREATE INDEX IF NOT EXISTS idx_maintenance_plans_status ON maintenance_plans(status);
CREATE INDEX IF NOT EXISTS idx_maintenance_requests_machine ON maintenance_requests(machine_id);

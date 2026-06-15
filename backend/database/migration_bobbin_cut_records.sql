-- Bobbin cut records — persisted when producedLengthOk resets on a production order

CREATE TABLE IF NOT EXISTS bobbin_cut_records (
    id VARCHAR(120) PRIMARY KEY,
    machine_id VARCHAR(50) NOT NULL REFERENCES machines(id) ON DELETE CASCADE,
    machine_name VARCHAR(100),
    area VARCHAR(50),
    order_id VARCHAR(100) NOT NULL,
    order_name VARCHAR(200),
    sequence INTEGER NOT NULL DEFAULT 1,
    qc_status VARCHAR(30) NOT NULL DEFAULT 'ok',
    trigger_type VARCHAR(30) NOT NULL DEFAULT 'reset',
    machine_status VARCHAR(30),
    cut_length_ok_m DECIMAL(12, 2) NOT NULL DEFAULT 0,
    produced_length_ok_at_cut DECIMAL(12, 2),
    produced_length_total_at_cut DECIMAL(12, 2),
    line_speed_at_cut DECIMAL(12, 4),
    target_length_order DECIMAL(12, 2),
    bobbin_count_planned INTEGER,
    metadata JSONB,
    recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bobbin_cut_records_machine_recorded
    ON bobbin_cut_records (machine_id, recorded_at DESC);

CREATE INDEX IF NOT EXISTS idx_bobbin_cut_records_order_recorded
    ON bobbin_cut_records (order_id, recorded_at DESC);

CREATE INDEX IF NOT EXISTS idx_bobbin_cut_records_machine_order
    ON bobbin_cut_records (machine_id, order_id, sequence);

SELECT 'Migration completed: bobbin_cut_records table ready' AS result;

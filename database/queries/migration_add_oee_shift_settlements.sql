-- Immutable settled OEE snapshots per machine per shift (official rollup after shift ends)

CREATE TABLE IF NOT EXISTS oee_shift_settlements (
    id SERIAL PRIMARY KEY,
    machine_id VARCHAR(50) NOT NULL REFERENCES machines(id) ON DELETE CASCADE,
    shift_id VARCHAR(100) NOT NULL,
    period_start TIMESTAMP NOT NULL,
    period_end TIMESTAMP NOT NULL,
    availability DECIMAL(5, 2) NOT NULL,
    performance DECIMAL(5, 2) NOT NULL,
    quality DECIMAL(5, 2) NOT NULL,
    oee DECIMAL(5, 2) NOT NULL,
    performance_data_quality VARCHAR(64),
    quality_data_quality VARCHAR(64),
    methodology_version VARCHAR(32) NOT NULL DEFAULT 'rollup_v1',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_oee_shift_settlement_machine_shift UNIQUE (machine_id, shift_id)
);

CREATE INDEX IF NOT EXISTS idx_oee_shift_settlements_shift_id ON oee_shift_settlements(shift_id);
CREATE INDEX IF NOT EXISTS idx_oee_shift_settlements_period ON oee_shift_settlements(period_start, period_end);

COMMENT ON TABLE oee_shift_settlements IS 'First insert wins (immutable); use POST /api/oee-settled/shift to settle a completed shift';

SELECT 'Migration completed: oee_shift_settlements table' AS result;

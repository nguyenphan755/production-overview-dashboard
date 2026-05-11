-- Energy telemetry model for 5-second sampling and product-aware EnPI.
-- - Raw samples: machine_energy_samples (5s cadence, all statuses)
-- - Hourly aggregates: energy_consumption (energy_kwh from meter delta, power_kw avg)

BEGIN;

CREATE TABLE IF NOT EXISTS machine_energy_samples (
    id BIGSERIAL PRIMARY KEY,
    machine_id VARCHAR(50) NOT NULL REFERENCES machines(id) ON DELETE CASCADE,
    sampled_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    machine_status machine_status NOT NULL DEFAULT 'idle',
    power_kw DECIMAL(10, 3),
    energy_meter_kwh DECIMAL(14, 3),
    material_code VARCHAR(50),
    product_name VARCHAR(255),
    produced_length_m DECIMAL(14, 3),
    produced_length_ok_m DECIMAL(14, 3),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_machine_energy_samples_machine_time
    ON machine_energy_samples(machine_id, sampled_at DESC);
CREATE INDEX IF NOT EXISTS idx_machine_energy_samples_status
    ON machine_energy_samples(machine_status);

ALTER TABLE energy_consumption
    ALTER COLUMN energy_kwh TYPE DECIMAL(14, 3);

ALTER TABLE energy_consumption
    ADD COLUMN IF NOT EXISTS power_kw DECIMAL(10, 3),
    ADD COLUMN IF NOT EXISTS material_code VARCHAR(50),
    ADD COLUMN IF NOT EXISTS product_name VARCHAR(255),
    ADD COLUMN IF NOT EXISTS machine_status machine_status,
    ADD COLUMN IF NOT EXISTS produced_length_m DECIMAL(14, 3),
    ADD COLUMN IF NOT EXISTS kwh_per_100m DECIMAL(14, 4),
    ADD COLUMN IF NOT EXISTS sample_count INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Backfill power from historical interpretation where energy_kwh previously carried kW.
UPDATE energy_consumption
SET power_kw = COALESCE(power_kw, energy_kwh)
WHERE power_kw IS NULL;

-- Keep one row per machine-hour for idempotent UPSERT from telemetry aggregation.
WITH ranked AS (
    SELECT
        id,
        ROW_NUMBER() OVER (PARTITION BY machine_id, hour ORDER BY id DESC) AS rn
    FROM energy_consumption
)
DELETE FROM energy_consumption
WHERE id IN (SELECT id FROM ranked WHERE rn > 1);

CREATE UNIQUE INDEX IF NOT EXISTS uq_energy_consumption_machine_hour
    ON energy_consumption(machine_id, hour);

COMMIT;

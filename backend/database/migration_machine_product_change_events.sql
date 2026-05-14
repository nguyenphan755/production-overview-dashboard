-- Append-only log when a line's product snapshot or material changes on `machines`.
-- Aligns with EquipmentStatus PRODUCT priority (machine.productName / machines.product_name first).
-- Apply once: psql -f migration_machine_product_change_events.sql (or your migration runner).

BEGIN;

CREATE TABLE IF NOT EXISTS machine_product_change_events (
    id BIGSERIAL PRIMARY KEY,
    machine_id VARCHAR(50) NOT NULL REFERENCES machines(id) ON DELETE CASCADE,
    machine_name VARCHAR(255) NOT NULL,
    material_code VARCHAR(50),
    product_name VARCHAR(255),
    changed_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE machine_product_change_events IS
  'One row per change to machines.product_name or machines.material_code (line product snapshot).';

CREATE INDEX IF NOT EXISTS idx_mpce_machine_changed_at
    ON machine_product_change_events (machine_id, changed_at DESC);

CREATE OR REPLACE FUNCTION log_machine_product_or_material_change()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF TG_OP <> 'UPDATE' THEN
        RETURN NEW;
    END IF;
    IF NEW.product_name IS DISTINCT FROM OLD.product_name
       OR NEW.material_code IS DISTINCT FROM OLD.material_code THEN
        INSERT INTO machine_product_change_events (
            machine_id,
            machine_name,
            material_code,
            product_name,
            changed_at
        ) VALUES (
            NEW.id,
            NEW.name,
            NEW.material_code,
            NEW.product_name,
            CURRENT_TIMESTAMP
        );
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_log_machine_product_change ON machines;
CREATE TRIGGER trigger_log_machine_product_change
    AFTER UPDATE OF product_name, material_code ON machines
    FOR EACH ROW
    WHEN (
        OLD.product_name IS DISTINCT FROM NEW.product_name
        OR OLD.material_code IS DISTINCT FROM NEW.material_code
    )
    EXECUTE FUNCTION log_machine_product_or_material_change();

COMMIT;

SELECT 'Migration completed: machine_product_change_events + trigger on machines' AS result;

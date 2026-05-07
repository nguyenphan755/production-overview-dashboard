-- Migration: Persist OEE component data-quality flags on machines (realtime snapshot)

ALTER TABLE machines
ADD COLUMN IF NOT EXISTS performance_data_quality VARCHAR(64);

ALTER TABLE machines
ADD COLUMN IF NOT EXISTS quality_data_quality VARCHAR(64);

COMMENT ON COLUMN machines.performance_data_quality IS 'OK | MISSING_TARGET_DEFAULT_100 — see backend/src/constants/oee-data-quality.js';
COMMENT ON COLUMN machines.quality_data_quality IS 'OK | ASSUMED_100_PENDING_NG_INTEGRATION | NO_PRODUCTION | ERROR_DEFAULT';

SELECT 'Migration completed: OEE data quality columns on machines' AS result;

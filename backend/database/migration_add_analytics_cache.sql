-- Migration: Add analytics cache for AI-assisted MES analytics

CREATE TABLE IF NOT EXISTS analytics_cache (
    id SERIAL PRIMARY KEY,
    scope_type VARCHAR(20) NOT NULL,
    scope_start TIMESTAMP NOT NULL,
    scope_end TIMESTAMP NOT NULL,
    scope_shift_id VARCHAR(50),
    scope_area VARCHAR(50),
    scope_machine_id VARCHAR(50),
    payload JSONB NOT NULL,
    computed_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_analytics_cache_scope ON analytics_cache(scope_type, scope_start, scope_end);
CREATE INDEX IF NOT EXISTS idx_analytics_cache_area ON analytics_cache(scope_area);
CREATE INDEX IF NOT EXISTS idx_analytics_cache_machine ON analytics_cache(scope_machine_id);
CREATE INDEX IF NOT EXISTS idx_analytics_cache_computed ON analytics_cache(computed_at DESC);

SELECT 'Migration completed: analytics_cache table added' AS result;

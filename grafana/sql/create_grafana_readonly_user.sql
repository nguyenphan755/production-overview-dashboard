-- Read-only user for Grafana POC (run as superuser / postgres)
-- Replace password before production use.

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'grafana_readonly') THEN
    CREATE USER grafana_readonly WITH PASSWORD 'grafana_readonly_change_me';
  END IF;
END
$$;

GRANT CONNECT ON DATABASE production_dashboard TO grafana_readonly;
GRANT USAGE ON SCHEMA public TO grafana_readonly;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO grafana_readonly;
GRANT SELECT ON ALL SEQUENCES IN SCHEMA public TO grafana_readonly;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT ON TABLES TO grafana_readonly;

-- Views used by POC dashboard
GRANT SELECT ON v_machine_telemetry_ai_hourly TO grafana_readonly;

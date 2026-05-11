-- Cumulative energy meter reading (kWh) on machine snapshot — same flow as `power` (PATCH + optional metrics).
-- API / JSON: energyMeterKwh  →  DB: energy_meter_kwh

ALTER TABLE machines
  ADD COLUMN IF NOT EXISTS energy_meter_kwh DECIMAL(14, 3);

COMMENT ON COLUMN machines.energy_meter_kwh IS 'Cumulative kWh register (plant meter); delta per shift = end - start';

import { query, withClient } from '../../database/connection.js';
import {
  recordEnergyTelemetryAndAggregate,
  hasMachineTelemetrySnapshotChanged,
  telemetrySamplerShouldSkipUnchanged,
} from './machineLineTelemetry.js';

const MIN_INTERVAL_MS = 250;

/**
 * Periodically snapshots every row from `machines` into `machine_line_telemetry`
 * (and refreshes the current hour in `energy_consumption`).
 *
 * Enable with e.g. TELEMETRY_AUTO_SAMPLE_INTERVAL_MS=15000 (every 15s per machine).
 * Off by default (unset or 0) to avoid surprise DB load.
 *
 * When TELEMETRY_SAMPLER_SKIP_UNCHANGED is true (default), a machine is skipped if its
 * `machines` row matches the last sampled snapshot (same logic as API dedupe).
 *
 * @returns { () => void } stop function
 */
export function startMachineLineTelemetrySampler() {
  const raw = process.env.TELEMETRY_AUTO_SAMPLE_INTERVAL_MS;
  const ms = raw === undefined || raw === '' ? 0 : parseInt(raw, 10);
  if (!Number.isFinite(ms) || ms <= 0) {
    return () => {};
  }
  if (ms < MIN_INTERVAL_MS) {
    console.warn(
      `[telemetry_sampler] TELEMETRY_AUTO_SAMPLE_INTERVAL_MS=${ms} is below minimum ${MIN_INTERVAL_MS}ms; sampler disabled.`
    );
    return () => {};
  }

  let tickBusy = false;
  let intervalId = null;
  const lastSampledByMachineId = new Map();
  const skipUnchangedSampler = telemetrySamplerShouldSkipUnchanged();

  const tick = async () => {
    if (tickBusy) {
      console.warn('[telemetry_sampler] previous tick still running; skipping this interval');
      return;
    }
    tickBusy = true;
    try {
      const { rows } = await query('SELECT * FROM machines ORDER BY id');
      const currentIds = new Set(rows.map((r) => r.id));
      for (const id of [...lastSampledByMachineId.keys()]) {
        if (!currentIds.has(id)) lastSampledByMachineId.delete(id);
      }

      const toWrite = skipUnchangedSampler
        ? rows.filter((row) =>
            hasMachineTelemetrySnapshotChanged(lastSampledByMachineId.get(row.id), row)
          )
        : rows;

      if (toWrite.length === 0) {
        return;
      }

      await withClient(async (client) => {
        await client.query('BEGIN');
        try {
          for (const row of toWrite) {
            await recordEnergyTelemetryAndAggregate(client, row.id, row, row, 'interval_sampler');
            lastSampledByMachineId.set(row.id, { ...row });
          }
          await client.query('COMMIT');
        } catch (err) {
          await client.query('ROLLBACK');
          throw err;
        }
      });
    } catch (err) {
      console.error('[telemetry_sampler] tick failed:', err.message || err);
    } finally {
      tickBusy = false;
    }
  };

  const dedupeNote = skipUnchangedSampler ? '; unchanged rows skipped until next change' : '';
  console.log(
    `📡 machine_line_telemetry: interval ${ms}ms (TELEMETRY_AUTO_SAMPLE_INTERVAL_MS)${dedupeNote}`
  );
  intervalId = setInterval(() => {
    tick().catch((e) => console.error('[telemetry_sampler] unhandled:', e));
  }, ms);

  return () => {
    if (intervalId) {
      clearInterval(intervalId);
      intervalId = null;
    }
  };
}

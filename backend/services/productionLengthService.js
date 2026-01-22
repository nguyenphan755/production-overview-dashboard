import { getCurrentShiftWindow, getShiftId } from '../utils/shiftCalculator.js';

const toNumber = (value) => {
  if (value === undefined || value === null || value === '') {
    return null;
  }
  const parsed = parseFloat(value);
  return Number.isNaN(parsed) ? null : parsed;
};

const normalizeStatus = (status) => {
  if (!status) return null;
  return String(status).toLowerCase();
};

export async function applyLengthCounterUpdate({
  client,
  machineRow,
  updates,
  eventTime = new Date()
}) {
  const incomingCounter =
    toNumber(updates.lengthCounter) ??
    toNumber(updates.length_counter) ??
    toNumber(updates.producedLength);

  if (incomingCounter === null) {
    return {
      applied: false,
      deltaLength: 0,
      shiftId: null,
      resetDetected: false,
    };
  }

  const effectiveStatus = normalizeStatus(updates.status) || normalizeStatus(machineRow.status);
  const effectiveOrderId =
    updates.productionOrderId ??
    updates.production_order_id ??
    machineRow.production_order_id ??
    null;
  const effectiveArea = machineRow.area;

  const shiftWindow = getCurrentShiftWindow(eventTime);
  const shiftId = getShiftId(shiftWindow.shift, eventTime);
  const shiftDate = shiftWindow.start.toISOString().slice(0, 10);

  const lastCounter = toNumber(machineRow.length_counter_last ?? machineRow.length_counter);
  let deltaRaw = 0;
  let resetDetected = false;

  if (lastCounter !== null) {
    deltaRaw = incomingCounter - lastCounter;
    if (deltaRaw < 0) {
      deltaRaw = incomingCounter;
      resetDetected = true;
    }
  }

  const isRunning = effectiveStatus === 'running';
  const deltaLength = isRunning ? Math.max(0, deltaRaw) : 0;

  const shiftChanged = !machineRow.current_shift_id || machineRow.current_shift_id !== shiftId;
  const baseLength = shiftChanged ? 0 : parseFloat(machineRow.produced_length || 0);
  const newProducedLength = baseLength + deltaLength;

  updates.lengthCounter = incomingCounter;
  updates.lengthCounterLast = incomingCounter;
  updates.lengthCounterLastAt = eventTime;
  updates.producedLength = newProducedLength;
  updates.currentShiftId = shiftId;
  updates.currentShiftStart = shiftWindow.start;
  updates.currentShiftEnd = shiftWindow.end;

  await client.query(
    `INSERT INTO production_length_events (
      machine_id,
      area,
      production_order_id,
      shift_id,
      shift_date,
      status,
      counter_value,
      last_counter_value,
      delta_length,
      is_running,
      reset_detected,
      event_time
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
    [
      machineRow.id,
      effectiveArea,
      effectiveOrderId,
      shiftId,
      shiftDate,
      effectiveStatus,
      incomingCounter,
      lastCounter,
      deltaLength,
      isRunning,
      resetDetected,
      eventTime,
    ]
  );

  if (effectiveOrderId && deltaLength > 0) {
    await client.query(
      `UPDATE production_orders
       SET produced_length = COALESCE(produced_length, 0) + $1,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $2`,
      [deltaLength, effectiveOrderId]
    );
  }

  return {
    applied: true,
    deltaLength,
    shiftId,
    resetDetected,
  };
}

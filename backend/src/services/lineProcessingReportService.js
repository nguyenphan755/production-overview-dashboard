/**
 * HTML report: processing time by shift/day, product sessions from machine_line_telemetry
 * (product_name + material_code, forward-filled), run/stop/setup from machine_status_history
 * (clipped to sessions). machine_product_change_events for DB snapshot change times.
 */
import { query } from '../../database/connection.js';
import { getShiftWindow } from '../utils/shiftCalculator.js';

const VALID_AREAS = new Set(['drawing', 'stranding', 'armoring', 'sheathing']);
/** Per-area export or explicit machineIds list */
const MAX_MACHINES = 80;
/** Whole-factory export (all machines in production_area enum) */
const MAX_FACTORY_MACHINES = 160;
const TELEMETRY_LOOKBACK_MS = 7 * 24 * 60 * 60 * 1000;
const DB_CHANGEOVER_MATCH_WINDOW_MS = 12 * 60 * 1000;

function parseLocalDateYmd(ymd) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(ymd).trim());
  if (!m) return null;
  const y = parseInt(m[1], 10);
  const mo = parseInt(m[2], 10) - 1;
  const d = parseInt(m[3], 10);
  const dt = new Date(y, mo, d, 12, 0, 0, 0);
  if (dt.getFullYear() !== y || dt.getMonth() !== mo || dt.getDate() !== d) return null;
  return dt;
}

/**
 * Nominal shift is [w0, w1). When export time falls inside that window, cap the report end to `nowMs`
 * so a "current" shift export matches real time instead of stretching to 06:00 next day.
 * When the shift has not started yet (nowMs <= w0), end stays w0 (empty window). When past w1, keep full w1.
 */
function effectiveShiftReportEnd(w0, w1, nowMs = Date.now()) {
  const w0t = w0.getTime();
  const w1t = w1.getTime();
  const capped = Math.min(w1t, Math.max(w0t, Math.min(nowMs, w1t)));
  return new Date(capped);
}

function normalizeProductName(name) {
  if (name == null) return 'UNKNOWN';
  const s = String(name).trim();
  return s === '' ? 'UNKNOWN' : s;
}

function normalizeMaterialCode(code) {
  if (code == null) return '';
  const s = String(code).trim();
  return s === '' ? '' : s;
}

function formatSessionLabel(product, materialCode) {
  const p = product != null ? String(product) : 'UNKNOWN';
  const m = normalizeMaterialCode(materialCode);
  if (m === '') return p;
  return `${p} [${m}]`;
}

/** Same idea as UI `machine.name` — never show blank when id is known. */
function machineDisplayName(row) {
  const n = row?.name != null ? String(row.name).trim() : '';
  const id = row?.id != null ? String(row.id).trim() : '';
  if (n !== '') return n;
  return id || 'UNKNOWN_MACHINE';
}

/**
 * Carry forward last non-empty telemetry product_name and material_code per machine so gaps
 * (null snapshots) do not wipe prior snapshot on session rows.
 */
function forwardFillTelemetryProducts(rawRows) {
  const byMachine = new Map();
  for (const row of rawRows) {
    const key = String(row.machineId);
    if (!byMachine.has(key)) byMachine.set(key, []);
    byMachine.get(key).push(row);
  }
  const combined = [];
  for (const [machineKey, list] of byMachine) {
    list.sort((a, b) => a.sampledAt.getTime() - b.sampledAt.getTime());
    let lastNonEmptyProduct = null;
    let lastNonEmptyMaterial = null;
    for (const r of list) {
      const rawP = r._rawProductName != null ? String(r._rawProductName).trim() : '';
      const rawM = r._rawMaterialCode != null ? String(r._rawMaterialCode).trim() : '';
      if (rawP !== '') lastNonEmptyProduct = rawP;
      if (rawM !== '') lastNonEmptyMaterial = rawM;
      const effectiveP = rawP !== '' ? rawP : lastNonEmptyProduct;
      const effectiveM = rawM !== '' ? rawM : lastNonEmptyMaterial;
      combined.push({
        machineId: machineKey,
        sampledAt: r.sampledAt,
        status: r.status,
        productName: normalizeProductName(effectiveP),
        materialCode: normalizeMaterialCode(effectiveM),
      });
    }
  }
  combined.sort((a, b) => {
    const c = String(a.machineId).localeCompare(String(b.machineId));
    if (c !== 0) return c;
    return a.sampledAt.getTime() - b.sampledAt.getTime();
  });
  return combined;
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatDurationSeconds(sec) {
  const n = Math.max(0, Math.round(Number(sec) || 0));
  const h = Math.floor(n / 3600);
  const mi = Math.floor((n % 3600) / 60);
  const s = n % 60;
  if (h > 0) return `${h}h ${mi}m ${s}s`;
  if (mi > 0) return `${mi}m ${s}s`;
  return `${s}s`;
}

/** Readable local date/time for HTML tables (not raw ISO). */
function formatReportDateTimeHtml(d) {
  if (!(d instanceof Date) || Number.isNaN(d.getTime())) return '—';
  const dateStr = d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
  const timeStr = d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
  return `<span class="dt-split"><span class="dt-d">${escapeHtml(dateStr)}</span><span class="dt-t">${escapeHtml(timeStr)}</span></span>`;
}

function clipIntervalSeconds(segStart, segEnd, w0, w1) {
  const s = Math.max(segStart.getTime(), w0.getTime());
  const e = Math.min(segEnd.getTime(), w1.getTime());
  if (s >= e) return 0;
  return (e - s) / 1000;
}

/** Open history row: same rule as EquipmentDetail ShiftGanttChart (end = now, then clip to window). */
function effectiveHistorySegmentEndMs(seg, hardCapMs, reportNowMs) {
  if (seg.end != null) {
    const t = seg.end.getTime();
    if (Number.isNaN(t)) return hardCapMs;
    return Math.min(t, hardCapMs);
  }
  return Math.min(reportNowMs, hardCapMs);
}

/**
 * Clip machine_status_history to [w0, w1) like ShiftGanttChart buildSegments.
 * @param {{ start: Date, end: Date|null, status: string }[]} segments
 */
function clipHistoryToShiftWindow(segments, windowStart, windowEnd, reportNowMs) {
  const w0 = windowStart.getTime();
  const w1 = windowEnd.getTime();
  if (w1 <= w0) return [];
  const out = [];
  for (const seg of segments) {
    const itemStart = seg.start.getTime();
    const itemEndOpen = effectiveHistorySegmentEndMs(seg, w1, reportNowMs);
    if (itemEndOpen <= w0 || itemStart >= w1) continue;
    const actualStart = Math.max(itemStart, w0);
    const actualEnd = Math.min(itemEndOpen, w1);
    if (actualEnd <= actualStart) continue;
    const st = String(seg.status ?? '')
      .trim()
      .toLowerCase();
    out.push({
      status: st,
      startMs: actualStart,
      endMs: actualEnd,
      seconds: (actualEnd - actualStart) / 1000,
    });
  }
  out.sort((a, b) => a.startMs - b.startMs);
  return out;
}

const STATUS_BAR_COLORS = {
  running: '#22C55E',
  idle: '#64748B',
  setup: '#FFB86C',
  warning: '#F59E0B',
  stopped: '#34E7F8',
  error: '#EF4444',
  alarm: '#EF4444',
};

function renderShiftStatusBarHtml(clipped, w0, w1) {
  if (!clipped.length) {
    return '<p class="warn">Không có đoạn machine_status_history nào giao với ca sau khi cắt (giống Gantt).</p>';
  }
  const w0t = w0.getTime();
  const w1t = w1.getTime();
  const span = Math.max(1, w1t - w0t);
  const totals = {};
  for (const c of clipped) {
    totals[c.status] = (totals[c.status] || 0) + c.seconds;
  }
  const order = ['running', 'idle', 'setup', 'warning', 'stopped', 'error', 'alarm'];
  let legend = '<div class="status-legend">';
  for (const st of order) {
    if (!totals[st]) continue;
    const col = STATUS_BAR_COLORS[st] || '#94a3b8';
    legend += `<span class="lgd"><span class="lgd-swatch" style="background:${col}"></span>${escapeHtml(st)} <span class="muted">(${escapeHtml(
      formatDurationSeconds(totals[st])
    )})</span></span>`;
  }
  legend += '</div>';

  let bar = '<div class="status-bar-wrap"><div class="status-bar">';
  for (const c of clipped) {
    const left = ((c.startMs - w0t) / span) * 100;
    const width = ((c.endMs - c.startMs) / span) * 100;
    const col = STATUS_BAR_COLORS[c.status] || '#94a3b8';
    bar += `<div class="status-seg" title="${escapeHtml(c.status)}" style="left:${left.toFixed(3)}%;width:${Math.max(
      width,
      0.12
    ).toFixed(3)}%;background:${col}"></div>`;
  }
  bar += '</div></div>';
  return `<div class="op-states"><h4>Trạng thái theo ca (cùng logic cắt với Operational States / Gantt)</h4>${legend}${bar}</div>`;
}

function statusHistoryLowerBound(rangeStart, rangeEnd) {
  const rangeSpanMs = rangeEnd.getTime() - rangeStart.getTime();
  const DAY_MS = 24 * 60 * 60 * 1000;
  const maxLookbackMs = 400 * DAY_MS;
  const minLookbackMs = 14 * DAY_MS;
  const lookbackMs = Math.min(maxLookbackMs, Math.max(minLookbackMs, rangeSpanMs * 3));
  return new Date(rangeStart.getTime() - lookbackMs);
}

/**
 * @param {string[]} machineIds
 * @param {Date} rangeStart
 * @param {Date} rangeEnd
 */
async function fetchStatusHistoryBatch(machineIds, rangeStart, rangeEnd) {
  if (!machineIds.length) return [];
  const lowerBoundStart = statusHistoryLowerBound(rangeStart, rangeEnd);
  const sql = `
    SELECT * FROM (
      SELECT
        id,
        machine_id,
        status,
        previous_status,
        status_start_time,
        status_end_time,
        duration_seconds,
        is_production_time
      FROM machine_status_history
      WHERE machine_id = ANY($1::varchar[])
        AND status_end_time IS NOT NULL
        AND status_start_time <= $3
        AND status_start_time >= $4
        AND status_end_time >= $2
      UNION ALL
      SELECT
        id,
        machine_id,
        status,
        previous_status,
        status_start_time,
        status_end_time,
        duration_seconds,
        is_production_time
      FROM machine_status_history
      WHERE machine_id = ANY($1::varchar[])
        AND status_end_time IS NULL
        AND status_start_time <= $3
    ) AS msh
    ORDER BY msh.machine_id ASC, msh.status_start_time ASC`;
  const result = await query(sql, [machineIds, rangeStart, rangeEnd, lowerBoundStart]);
  return result.rows.map((row) => ({
    id: row.id,
    machineId: row.machine_id,
    status: row.status,
    previousStatus: row.previous_status,
    start: new Date(row.status_start_time),
    end: row.status_end_time ? new Date(row.status_end_time) : null,
    durationSeconds: row.duration_seconds,
    isProductionTime: row.is_production_time,
  }));
}

/**
 * @param {string[]} machineIds
 * @param {Date} telFrom
 * @param {Date} telTo
 */
async function fetchTelemetryProductTimeline(machineIds, telFrom, telTo) {
  if (!machineIds.length) return [];
  const result = await query(
    `SELECT machine_id, sampled_at, product_name, material_code, status
     FROM machine_line_telemetry
     WHERE machine_id = ANY($1::varchar[])
       AND sampled_at >= $2
       AND sampled_at < $3
     ORDER BY machine_id ASC, sampled_at ASC
     LIMIT 500000`,
    [machineIds, telFrom, telTo]
  );
  const rawMapped = result.rows.map((row) => ({
    machineId: row.machine_id,
    sampledAt: new Date(row.sampled_at),
    _rawProductName: row.product_name,
    _rawMaterialCode: row.material_code,
    status: row.status,
  }));
  return forwardFillTelemetryProducts(rawMapped);
}

/**
 * @param {string[]} machineIds
 * @param {Date} rangeStart
 * @param {Date} rangeEnd
 */
async function fetchMachineProductChangeEvents(machineIds, rangeStart, rangeEnd) {
  if (!machineIds.length) return [];
  try {
    const result = await query(
      `SELECT machine_id, machine_name, material_code, product_name, changed_at
       FROM machine_product_change_events
       WHERE machine_id = ANY($1::varchar[])
         AND changed_at >= $2
         AND changed_at < $3
       ORDER BY machine_id ASC, changed_at ASC`,
      [machineIds, rangeStart, rangeEnd]
    );
    return result.rows.map((row) => ({
      machineId: String(row.machine_id),
      machineName: row.machine_name != null ? String(row.machine_name) : '',
      materialCode: row.material_code != null ? String(row.material_code) : null,
      productName: row.product_name != null ? String(row.product_name) : null,
      changedAt: new Date(row.changed_at),
    }));
  } catch (e) {
    if (e && e.code === '42P01') return [];
    throw e;
  }
}

function findDbChangeNearSessionBStart(dbEvents, toProductForDb, toMaterialForDb, sessionBStartMs) {
  const targetP = normalizeProductName(toProductForDb);
  const targetM = normalizeMaterialCode(toMaterialForDb);
  let best = null;
  let bestKey = null;
  for (const ev of dbEvents) {
    const t = ev.changedAt.getTime();
    const dt = Math.abs(t - sessionBStartMs);
    if (dt > DB_CHANGEOVER_MATCH_WINDOW_MS) continue;
    if (normalizeProductName(ev.productName) !== targetP) continue;
    const evM = normalizeMaterialCode(ev.materialCode);
    const matMismatch = targetM !== '' && evM !== targetM ? 1 : 0;
    const key = matMismatch * 1e15 + dt;
    if (bestKey === null || key < bestKey) {
      bestKey = key;
      best = ev;
    }
  }
  return best;
}

/**
 * Build product sessions for one machine within [w0, w1), using telemetry from telFrom to w1.
 */
function buildProductSessions(rows, machineId, w0, w1) {
  const mid = String(machineId);
  const machineRows = rows.filter((r) => String(r.machineId) === mid);
  if (machineRows.length === 0) {
    return {
      sessions: [],
      productChangesInWindow: 0,
      hasTelemetryInWindow: false,
    };
  }

  const w0t = w0.getTime();
  const w1t = w1.getTime();
  const inWindow = machineRows.filter((r) => {
    const t = r.sampledAt.getTime();
    return t >= w0t && t < w1t;
  });
  const hasTelemetryInWindow = inWindow.length > 0;

  let productAtWindowStart = 'UNKNOWN';
  let materialAtWindowStart = '';
  for (let i = machineRows.length - 1; i >= 0; i -= 1) {
    if (machineRows[i].sampledAt.getTime() < w0t) {
      productAtWindowStart = machineRows[i].productName;
      materialAtWindowStart = normalizeMaterialCode(machineRows[i].materialCode);
      break;
    }
  }
  if (productAtWindowStart === 'UNKNOWN') {
    const firstIn = machineRows.find((r) => {
      const t = r.sampledAt.getTime();
      return t >= w0t && t < w1t;
    });
    if (firstIn) {
      productAtWindowStart = firstIn.productName;
      materialAtWindowStart = normalizeMaterialCode(firstIn.materialCode);
    }
  }

  const sessions = [];
  let currentProduct = productAtWindowStart;
  let currentMaterial = materialAtWindowStart;
  let sessionStartMs = w0t;

  const emitSession = (endMs) => {
    if (endMs <= sessionStartMs) return;
    sessions.push({
      product: currentProduct,
      materialCode: currentMaterial,
      start: new Date(sessionStartMs),
      end: new Date(endMs),
    });
  };

  for (const r of machineRows) {
    const t = r.sampledAt.getTime();
    if (t < w0t) continue;
    if (t >= w1t) break;
    const rowMat = normalizeMaterialCode(r.materialCode);
    if (r.productName !== currentProduct || rowMat !== currentMaterial) {
      emitSession(t);
      currentProduct = r.productName;
      currentMaterial = rowMat;
      sessionStartMs = t;
    }
  }
  emitSession(w1t);

  // Count transitions from built sessions (same walk as the table), not pairwise
  // raw rows — after forward-fill consecutive rows often share productName.
  const productChangesInWindow = Math.max(0, sessions.length - 1);

  return { sessions, productChangesInWindow, hasTelemetryInWindow };
}

function aggregateStatusInSession(segments, sessionStart, sessionEnd, reportNowMs) {
  const sessionEndMs = sessionEnd.getTime();
  let runningSec = 0;
  let setupSec = 0;
  let otherStopSec = 0;

  for (const seg of segments) {
    const segEndMs = effectiveHistorySegmentEndMs(seg, sessionEndMs, reportNowMs);
    const sec = clipIntervalSeconds(seg.start, new Date(segEndMs), sessionStart, sessionEnd);
    if (sec <= 0) continue;
    const st = String(seg.status ?? '')
      .trim()
      .toLowerCase();
    if (st === 'running') runningSec += sec;
    else if (st === 'setup') setupSec += sec;
    else otherStopSec += sec;
  }

  return { runningSec, setupSec, otherStopSec };
}

/**
 * Clipped status rows: { status, startMs, endMs, seconds }.
 * Last non-running end strictly before product B (telemetry) starts.
 */
function lastNonRunningEndBefore(clipped, rangeStartMs, rangeEndMs) {
  let best = null;
  for (const seg of clipped) {
    if (seg.status === 'running') continue;
    if (seg.endMs <= rangeStartMs || seg.startMs >= rangeEndMs) continue;
    const endClip = Math.min(seg.endMs, rangeEndMs);
    const startClip = Math.max(seg.startMs, rangeStartMs);
    if (endClip <= startClip) continue;
    if (best === null || endClip > best) best = endClip;
  }
  return best;
}

/** First instant of running within [sessionStart, sessionEnd) from clipped history. */
function firstRunningStartInWindow(clipped, sessionStartMs, sessionEndMs) {
  let best = null;
  for (const seg of clipped) {
    if (seg.status !== 'running') continue;
    if (seg.endMs <= sessionStartMs || seg.startMs >= sessionEndMs) continue;
    const startClip = Math.max(seg.startMs, sessionStartMs);
    if (startClip >= sessionEndMs) continue;
    if (best === null || startClip < best) best = startClip;
  }
  return best;
}

/**
 * Changeover A→B: từ kết thúc đoạn không-chạy (≠ running) cuối trong khoảng [phiên A] trước mốc đổi SP,
 * đến thời điểm bắt đầu running đầu tiên trong phiên B. Nếu không có đoạn không-chạy trước đổi SP, neo vào
 * mốc kết thúc phiên A theo telemetry (prev.end). Nếu không có running trong phiên B, báo "—".
 */
function buildChangeoverRows(sessions, clippedShift) {
  const rows = [];
  const clipped = clippedShift || [];
  for (let i = 1; i < sessions.length; i += 1) {
    const prev = sessions[i - 1];
    const cur = sessions[i];
    if (
      prev.product === cur.product &&
      normalizeMaterialCode(prev.materialCode) === normalizeMaterialCode(cur.materialCode)
    ) {
      continue;
    }

    const prevStartMs = prev.start.getTime();
    const prevEndMs = prev.end.getTime();
    const curStartMs = cur.start.getTime();
    const curEndMs = cur.end.getTime();

    const lastNonRunEnd = lastNonRunningEndBefore(clipped, prevStartMs, curStartMs);
    const changeoverStartMs = lastNonRunEnd != null ? lastNonRunEnd : prevEndMs;
    const startCapped = Math.min(changeoverStartMs, curStartMs);

    const firstRunB = firstRunningStartInWindow(clipped, curStartMs, curEndMs);
    const wallGapSec = Math.max(0, (curStartMs - prevEndMs) / 1000);

    let gapSeconds = null;
    let gapLabel = '—';
    if (firstRunB != null && firstRunB > startCapped) {
      gapSeconds = (firstRunB - startCapped) / 1000;
      gapLabel = formatDurationSeconds(gapSeconds);
    } else if (firstRunB != null && firstRunB <= startCapped) {
      gapLabel = '0s';
      gapSeconds = 0;
    }

    rows.push({
      fromDisplay: formatSessionLabel(prev.product, prev.materialCode),
      toDisplay: formatSessionLabel(cur.product, cur.materialCode),
      toProductForDb: cur.product,
      toMaterialForDb: normalizeMaterialCode(cur.materialCode),
      gapSeconds,
      gapLabel,
      wallGapSeconds: wallGapSec,
      lastNonRunEndMs: lastNonRunEnd,
      changeoverStartMs: startCapped,
      firstRunBMs: firstRunB,
      sessionBStartMs: curStartMs,
    });
  }
  return rows;
}

function aggregateMachineShiftMetrics(sessions) {
  let runningSec = 0;
  let stoppedSec = 0;
  for (const s of sessions) {
    const m = s.metrics || {};
    runningSec += Number(m.runningSec) || 0;
    stoppedSec += (Number(m.setupSec) || 0) + (Number(m.otherStopSec) || 0);
  }
  return { runningSec, stoppedSec };
}

/**
 * Phiên telemetry cuối trong ca (theo thời gian) — mã vật tư + nhãn sản phẩm (thường là mô tả trên snapshot).
 */
function lastSessionMaterialSnapshot(sessions) {
  if (!sessions.length) return { materialCode: '', productLabel: '' };
  const last = sessions[sessions.length - 1];
  return {
    materialCode: normalizeMaterialCode(last.materialCode),
    productLabel: last.product != null ? String(last.product).trim() : '',
  };
}

function renderMachineSection(
  machineDisplayTitle,
  machineId,
  shiftLabel,
  w0,
  w1,
  reportSlice,
  liveProductFromMachine,
  liveMaterialFromMachine,
  machineHistorySegments,
  reportNowMs,
  nominalShiftEnd = null,
  dbEventsInShift = [],
  dbEventsForMachine = [],
  materialNameByCode = new Map()
) {
  const { sessions, productChangesInWindow, hasTelemetryInWindow } = reportSlice;

  const clippedShift = clipHistoryToShiftWindow(machineHistorySegments, w0, w1, reportNowMs);
  const changeovers = buildChangeoverRows(sessions, clippedShift);

  const idSuffix =
    machineId && machineDisplayTitle && machineId !== machineDisplayTitle
      ? ` <span class="muted">(mã: ${escapeHtml(machineId)})</span>`
      : '';

  const { runningSec: sumRun, stoppedSec: sumStop } = aggregateMachineShiftMetrics(sessions);
  const lastSnap = lastSessionMaterialSnapshot(sessions);
  const liveMat = liveMaterialFromMachine != null && String(liveMaterialFromMachine).trim() !== ''
    ? String(liveMaterialFromMachine).trim()
    : '';
  const liveProd =
    liveProductFromMachine != null && String(liveProductFromMachine).trim() !== ''
      ? String(liveProductFromMachine).trim()
      : '';

  const syntheticLast =
    sessions.length === 1 &&
    String(sessions[0].product || '').includes('Không có telemetry');

  let summaryMaterial = lastSnap.materialCode || '';
  if (syntheticLast || !summaryMaterial) summaryMaterial = liveMat;
  const summaryMaterialDisp = summaryMaterial ? escapeHtml(summaryMaterial) : '<span class="muted">—</span>';

  let materialDesc = '';
  if (summaryMaterial && materialNameByCode.has(summaryMaterial)) {
    materialDesc = String(materialNameByCode.get(summaryMaterial) || '').trim();
  }
  if (!materialDesc) {
    materialDesc = lastSnap.productLabel && !syntheticLast ? lastSnap.productLabel : liveProd;
  }
  const materialDescDisp =
    materialDesc && materialDesc.trim() !== ''
      ? escapeHtml(materialDesc.trim())
      : '<span class="muted">—</span>';

  let detail = '';

  if (!hasTelemetryInWindow) {
    detail += `<p class="warn">Không có snapshot telemetry trong cửa sổ; ranh giới sản phẩm suy từ dữ liệu trước ca hoặc chỉ hiển thị tổng trạng thái.</p>`;
  }

  detail += `<p><strong>Số lần đổi sản phẩm / mã vật tư (theo snapshot telemetry, sau khi lấp chỗ trống) trong cửa sổ:</strong> ${productChangesInWindow}</p>`;
  detail += `<p><strong>Số sự kiện đổi snapshot trên DB (<code>machine_product_change_events</code>) trong ca:</strong> ${dbEventsInShift.length}</p>`;

  detail += renderShiftStatusBarHtml(clippedShift, w0, w1);

  detail += '<table><thead><tr>';
  detail +=
    '<th>Sản phẩm (Production)</th><th>Mã vật tư (telemetry)</th><th>Bắt đầu</th><th>Kết thúc</th><th>Slot (wall)</th><th>Chạy (running)</th><th>Setup</th><th>Dừng khác</th>';
  detail += '</tr></thead><tbody>';

  for (const sess of sessions) {
    const wallSec = (sess.end.getTime() - sess.start.getTime()) / 1000;
    const { runningSec, setupSec, otherStopSec } = sess.metrics;
    const matCell =
      sess.materialCode != null && String(sess.materialCode).trim() !== ''
        ? escapeHtml(String(sess.materialCode).trim())
        : '<span class="muted">—</span>';
    detail += '<tr>';
    detail += `<td>${escapeHtml(sess.product)}</td><td>${matCell}</td>`;
    detail += `<td>${formatReportDateTimeHtml(sess.start)}</td>`;
    detail += `<td>${formatReportDateTimeHtml(sess.end)}</td>`;
    detail += `<td>${escapeHtml(formatDurationSeconds(wallSec))}</td>`;
    detail += `<td>${escapeHtml(formatDurationSeconds(runningSec))}</td>`;
    detail += `<td>${escapeHtml(formatDurationSeconds(setupSec))}</td>`;
    detail += `<td>${escapeHtml(formatDurationSeconds(otherStopSec))}</td>`;
    detail += '</tr>';
  }
  if (sessions.length === 0) {
    detail += '<tr><td colspan="8">Không có phiên sản phẩm trong cửa sổ.</td></tr>';
  }
  detail += '</tbody></table>';

  if (changeovers.length > 0) {
    detail +=
      '<h4>Chuyển đổi sản phẩm (theo lịch sử trạng thái: từ kết thúc không-chạy cuối trước đổi SP → chạy đầu tiên của SP sau)</h4>';
    detail +=
      '<table><thead><tr><th>Từ</th><th>Sang</th><th>Kết thúc không-chạy (A)<br/><span class="muted" style="font-weight:normal">trước đổi SP</span></th><th>Bắt đầu chạy (B)<br/><span class="muted" style="font-weight:normal">running đầu trong phiên B</span></th><th>Thời gian chuyển</th><th>Khe telemetry<br/><span class="muted" style="font-weight:normal">Bắt đầu B − Kết thúc A</span></th><th>Mốc DB<br/><span class="muted" style="font-weight:normal">machine_product_change_events</span></th></tr></thead><tbody>';
    for (const c of changeovers) {
      const endANode =
        c.lastNonRunEndMs != null
          ? formatReportDateTimeHtml(new Date(c.lastNonRunEndMs))
          : formatReportDateTimeHtml(new Date(c.changeoverStartMs));
      const startBNode =
        c.firstRunBMs != null ? formatReportDateTimeHtml(new Date(c.firstRunBMs)) : '<span class="muted">—</span>';
      const dbHit =
        dbEventsForMachine.length && c.sessionBStartMs != null
          ? findDbChangeNearSessionBStart(
              dbEventsForMachine,
              c.toProductForDb,
              c.toMaterialForDb,
              c.sessionBStartMs
            )
          : null;
      const dbCell = dbHit ? formatReportDateTimeHtml(dbHit.changedAt) : '<span class="muted">—</span>';
      detail += '<tr>';
      detail += `<td>${escapeHtml(c.fromDisplay)}</td>`;
      detail += `<td>${escapeHtml(c.toDisplay)}</td>`;
      detail += `<td>${endANode}</td>`;
      detail += `<td>${startBNode}</td>`;
      detail += `<td><strong>${escapeHtml(c.gapLabel)}</strong></td>`;
      detail += `<td class="muted">${escapeHtml(formatDurationSeconds(c.wallGapSeconds))}</td>`;
      detail += `<td>${dbCell}</td>`;
      detail += '</tr>';
    }
    detail += '</tbody></table>';
  }

  if (dbEventsInShift.length > 0) {
    detail +=
      '<h4>Đăng ký đổi snapshot (<code>machine_product_change_events</code>) trong ca</h4>';
    detail +=
      '<table><thead><tr><th>Thời điểm</th><th>Sản phẩm (sau đổi)</th><th>Mã vật tư</th><th>Tên máy (lúc ghi)</th></tr></thead><tbody>';
    for (const ev of dbEventsInShift) {
      detail += '<tr>';
      detail += `<td>${formatReportDateTimeHtml(ev.changedAt)}</td>`;
      detail += `<td>${escapeHtml(ev.productName != null && String(ev.productName).trim() !== '' ? String(ev.productName).trim() : '—')}</td>`;
      detail += `<td>${escapeHtml(ev.materialCode != null && String(ev.materialCode).trim() !== '' ? String(ev.materialCode).trim() : '—')}</td>`;
      detail += `<td>${escapeHtml(ev.machineName || '—')}</td>`;
      detail += '</tr>';
    }
    detail += '</tbody></table>';
  }

  const summaryInner = `
    <div class="machine-summary-inner">
      <div class="machine-summary-head">
        <strong class="machine-summary-title">${escapeHtml(machineDisplayTitle)}</strong>${idSuffix}
      </div>
      <div class="machine-summary-grid">
        <div class="sg"><span class="sg-k">Mã vật tư (cuối ca / máy)</span><span class="sg-v">${summaryMaterialDisp}</span></div>
        <div class="sg"><span class="sg-k">Mô tả vật tư</span><span class="sg-v">${materialDescDisp}</span></div>
        <div class="sg"><span class="sg-k">Tổng chạy (running)</span><span class="sg-v">${escapeHtml(formatDurationSeconds(sumRun))}</span></div>
        <div class="sg"><span class="sg-k">Tổng dừng (setup + dừng khác)</span><span class="sg-v">${escapeHtml(formatDurationSeconds(sumStop))}</span></div>
      </div>
    </div>
  `;

  return `
    <section class="machine">
      <details class="machine-details">
        <summary class="machine-summary">${summaryInner}</summary>
        <div class="machine-detail-panel">
          ${detail}
        </div>
      </details>
    </section>
  `;
}

function renderFooter() {
  return `
    <footer>
      <h3>Chú thích</h3>
      <ul>
        <li><strong>Tóm tắt / chi tiết</strong>: mỗi máy dùng <code>&lt;details&gt;</code> — tóm tắt gọn (tên máy, mã vật tư, mô tả, tổng chạy / tổng dừng). Phần mở rộng: cảnh báo telemetry (nếu có), số đổi SP, sự kiện DB, thanh trạng thái và các bảng chi tiết (không lặp lại tiêu đề ca / cửa sổ — đã nêu ở tiêu đề ca phía trên).</li>
        <li><strong>Tên máy</strong>: ưu tiên <code>machines.name</code>; nếu trống thì dùng <code>machines.id</code> (giống cách UI không để trống tiêu đề).</li>
        <li><strong>Sản phẩm hiện tại</strong>: dòng riêng lấy từ <code>machines.product_name</code> tại thời điểm xuất (cùng nguồn với ô Product trên EquipmentDetail).</li>
        <li><strong>Mã vật tư hiện tại (máy)</strong>: <code>machines.material_code</code> tại thời điểm xuất.</li>
        <li><strong>Phiên sản phẩm trong bảng</strong>: từ <code>product_name</code> và <code>material_code</code> trên <code>machine_line_telemetry</code>, có <strong>lấp forward</strong> snapshot trống (cả SP và mã vật tư). Ranh giới phiên khi đổi tên SP hoặc đổi mã vật tư; tần suất ghi telemetry vẫn ảnh hưởng độ mịn timeline.</li>
        <li><strong>Chạy / Setup / Dừng khác</strong>: cộng thời lượng các đoạn <code>machine_status_history</code> sau khi cắt (clip) giao với khoảng thời gian của phiên; <code>running</code> = chạy, <code>setup</code> = setup, còn lại = dừng khác. Với đoạn đang mở (<code>status_end_time</code> null), kết thúc hiệu lực = <code>min(thời điểm xuất báo cáo, cuối cửa sổ)</code> — cùng ý với Gantt trên EquipmentDetail (không kéo running đến hết ca nếu máy đang chạy liên tục).</li>
        <li><strong>Thanh màu theo ca</strong>: dựng từ cùng tập đoạn đã cắt như trên.</li>
        <li><strong>Số lần đổi sản phẩm / mã vật tư</strong>: số phiên trong cửa sổ trừ một (mỗi lần đổi tên SP hoặc mã vật tư trên telemetry sau forward-fill tạo thêm một phiên).</li>
        <li><strong>machine_product_change_events</strong>: một dòng mỗi lần đổi <code>machines.product_name</code> hoặc <code>machines.material_code</code> (trigger DB). Bảng riêng trong ca liệt kê các mốc trong cửa sổ. Cột <strong>Mốc DB</strong> ở bảng chuyển đổi: ghép với bắt đầu phiên B (telemetry) nếu có sự kiện trùng tên SP trong ±12 phút, ưu tiên trùng mã vật tư khi phiên B có mã.</li>
        <li><strong>Thời gian chuyển đổi A → B</strong>: từ <strong>kết thúc đoạn không-chạy</strong> (<code>status</code> khác <code>running</code>) cuối cùng trong khoảng phiên A trước mốc đổi sản phẩm theo telemetry, đến <strong>thời điểm bắt đầu <code>running</code> đầu tiên</strong> trong phiên B — cả hai mốc lấy từ <code>machine_status_history</code> đã cắt theo ca (cùng logic Gantt). Nếu không có đoạn không-chạy trước đổi SP, neo mốc đầu vào kết thúc phiên A theo telemetry; nếu không có <code>running</code> trong phiên B thì cột thời gian chuyển hiển thị "—". Cột <strong>Khe telemetry</strong> là khoảng giữa mốc bắt đầu phiên B và kết thúc phiên A trên timeline sản phẩm (để đối chiếu tần suất snapshot).</li>
        <li><strong>Ca đang chạy</strong>: nếu thời điểm xuất báo cáo nằm trong khoảng <code>[bắt đầu ca, kết thúc ca theo lịch)</code>, cửa sổ báo cáo được <strong>cắt đến thời điểm xuất</strong> (giống realtime trên màn hình), không kéo đến hết ca trên lịch (vd. ca 3 tới 06:00 hôm sau).</li>
        <li>Múi giờ: thời gian ca và <code>localDate</code> theo múi giờ của máy chủ Node.js.</li>
      </ul>
    </footer>
  `;
}

function parseFactoryFlag(raw) {
  if (raw === true || raw === 1) return true;
  const s = raw != null ? String(raw).trim().toLowerCase() : '';
  return s === '1' || s === 'true' || s === 'yes' || s === 'factory';
}

/**
 * @param {{ localDate: string, shift?: string|null, area?: string|null, machineIds?: string|null, factory?: string|number|boolean|null }} params
 * @returns {Promise<{ html: string, filename: string }|{ error: string, status: number }>}
 */
export async function buildLineProcessingHtmlReport(params) {
  const { localDate, shift: shiftRaw, area: areaRaw, machineIds: machineIdsRaw, factory: factoryRaw } = params;

  if (localDate == null || String(localDate).trim() === '') {
    return { error: 'localDate is required (YYYY-MM-DD)', status: 400 };
  }

  const anchor = parseLocalDateYmd(localDate);
  if (!anchor) {
    return { error: 'localDate must be YYYY-MM-DD', status: 400 };
  }

  const factory = parseFactoryFlag(factoryRaw);
  const area = areaRaw != null && String(areaRaw).trim() !== '' ? String(areaRaw).trim().toLowerCase() : null;
  const machineIdsCsv =
    machineIdsRaw != null && String(machineIdsRaw).trim() !== '' ? String(machineIdsRaw).trim() : null;

  const modeCount = [Boolean(area), Boolean(machineIdsCsv), factory].filter(Boolean).length;
  if (modeCount !== 1) {
    return {
      error:
        'Provide exactly one of: area (drawing|stranding|armoring|sheathing), machineIds (comma-separated), or factory=1 (all machines)',
      status: 400,
    };
  }

  if (area && !VALID_AREAS.has(area)) {
    return { error: 'Invalid area', status: 400 };
  }

  let shifts;
  if (shiftRaw == null || String(shiftRaw).trim() === '') {
    shifts = [1, 2, 3];
  } else {
    const n = parseInt(String(shiftRaw), 10);
    if (![1, 2, 3].includes(n)) {
      return { error: 'shift must be 1, 2, 3, or omitted for all shifts', status: 400 };
    }
    shifts = [n];
  }

  let machineRows;
  if (factory) {
    const r = await query(
      `SELECT id, name, area, product_name, material_code
       FROM machines
       WHERE area::text = ANY($1::text[])
       ORDER BY area::text ASC, id ASC`,
      [[...VALID_AREAS]]
    );
    machineRows = r.rows;
  } else if (area) {
    const r = await query(
      `SELECT id, name, area, product_name, material_code FROM machines WHERE area = $1::production_area ORDER BY id ASC`,
      [area]
    );
    machineRows = r.rows;
  } else {
    const ids = machineIdsCsv
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    if (!ids.length) {
      return { error: 'machineIds is empty', status: 400 };
    }
    if (ids.length > MAX_MACHINES) {
      return { error: `At most ${MAX_MACHINES} machines per export`, status: 400 };
    }
    const r = await query(
      `SELECT id, name, area, product_name, material_code FROM machines WHERE id = ANY($1::varchar[]) ORDER BY id ASC`,
      [ids]
    );
    machineRows = r.rows;
    if (machineRows.length !== ids.length) {
      return { error: 'One or more machineIds were not found', status: 404 };
    }
  }

  if (!machineRows.length) {
    return { error: 'No machines matched the filter', status: 404 };
  }

  const maxAllowed = factory ? MAX_FACTORY_MACHINES : MAX_MACHINES;
  if (machineRows.length > maxAllowed) {
    return {
      error: `At most ${maxAllowed} machines per ${factory ? 'factory-wide' : 'this'} export (got ${machineRows.length})`,
      status: 400,
    };
  }

  const machineIds = machineRows.map((m) => m.id);
  const scopeSlug = factory ? 'toan-nha-may' : area || `machines-${machineIds.length}`;
  const scopeDisplay = factory
    ? 'Toàn nhà máy (tất cả cụm)'
    : area
      ? String(area)
      : `${machineIds.length} máy (theo danh sách)`;

  let minW = null;
  let maxW = null;
  for (const sn of shifts) {
    const { start, end } = getShiftWindow(sn, anchor);
    if (minW == null || start < minW) minW = start;
    if (maxW == null || end > maxW) maxW = end;
  }
  const telFrom = new Date(minW.getTime() - TELEMETRY_LOOKBACK_MS);

  const telemetryRows = await fetchTelemetryProductTimeline(machineIds, telFrom, maxW);
  const statusRows = await fetchStatusHistoryBatch(machineIds, minW, maxW);
  const productChangeDbRows = await fetchMachineProductChangeEvents(machineIds, minW, maxW);

  const materialCodesForLookup = new Set();
  for (const m of machineRows) {
    if (m.material_code != null && String(m.material_code).trim() !== '') {
      materialCodesForLookup.add(String(m.material_code).trim());
    }
  }
  for (const t of telemetryRows) {
    const c = t.materialCode != null ? String(t.materialCode).trim() : '';
    if (c !== '') materialCodesForLookup.add(c);
  }
  const materialCodesList = [...materialCodesForLookup];
  let materialNameByCode = new Map();
  if (materialCodesList.length > 0) {
    const mmRes = await query(
      `SELECT material_code, material_name FROM material_master WHERE material_code = ANY($1::varchar[])`,
      [materialCodesList]
    );
    for (const r of mmRes.rows) {
      materialNameByCode.set(String(r.material_code).trim(), r.material_name != null ? String(r.material_name) : '');
    }
  }

  const statusByMachine = new Map();
  for (const mid of machineIds) statusByMachine.set(String(mid), []);
  for (const s of statusRows) {
    const key = String(s.machineId);
    if (!statusByMachine.has(key)) statusByMachine.set(key, []);
    statusByMachine.get(key).push(s);
  }

  const dbEventsByMachine = new Map();
  for (const mid of machineIds) dbEventsByMachine.set(String(mid), []);
  for (const ev of productChangeDbRows) {
    const key = String(ev.machineId);
    if (!dbEventsByMachine.has(key)) dbEventsByMachine.set(key, []);
    dbEventsByMachine.get(key).push(ev);
  }

  const shiftLabels = { 1: 'Ca 1 (06:00–14:00)', 2: 'Ca 2 (14:00–22:00)', 3: 'Ca 3 (22:00–06:00 hôm sau)' };

  const reportNowMs = Date.now();
  let content = '';
  for (const sn of shifts) {
    const { start: w0, end: w1Nominal } = getShiftWindow(sn, anchor);
    const w1 = effectiveShiftReportEnd(w0, w1Nominal, reportNowMs);
    const nominalShiftEnd = w1Nominal.getTime() !== w1.getTime() ? w1Nominal : null;
    const shiftLabel = shiftLabels[sn];
    content += `<article class="shift-block"><h2>${escapeHtml(shiftLabel)} — ${escapeHtml(localDate)}</h2>`;

    for (const m of machineRows) {
      const { sessions: rawSessions, productChangesInWindow, hasTelemetryInWindow } = buildProductSessions(
        telemetryRows,
        m.id,
        w0,
        w1
      );

      const segments = statusByMachine.get(String(m.id)) || [];
      let sessions;
      if (rawSessions.length === 0) {
        const metrics = aggregateStatusInSession(segments, w0, w1, reportNowMs);
        sessions = [
          {
            product: '(Không có telemetry — tổng theo trạng thái trong ca)',
            materialCode: '',
            start: w0,
            end: w1,
            metrics,
          },
        ];
      } else {
        sessions = rawSessions.map((sess) => {
          const metrics = aggregateStatusInSession(segments, sess.start, sess.end, reportNowMs);
          return { ...sess, metrics };
        });
      }
      const dbForM = dbEventsByMachine.get(String(m.id)) || [];
      const w0t = w0.getTime();
      const w1t = w1.getTime();
      const dbEventsInShift = dbForM.filter((e) => {
        const t = e.changedAt.getTime();
        return t >= w0t && t < w1t;
      });
      content += renderMachineSection(
        machineDisplayName(m),
        m.id,
        shiftLabel,
        w0,
        w1,
        {
          sessions,
          productChangesInWindow,
          hasTelemetryInWindow,
        },
        m.product_name,
        m.material_code,
        segments,
        reportNowMs,
        nominalShiftEnd,
        dbEventsInShift,
        dbForM,
        materialNameByCode
      );
    }
    content += '</article>';
  }

  const shiftPart =
    shifts.length === 3 ? 'all-shifts' : `shift${shifts[0]}`;
  const filename = `line-processing_${scopeSlug}_${localDate}_${shiftPart}.html`;

  const title = `Báo cáo Processing — ${scopeDisplay} — ${localDate}`;

  const html = `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(title)}</title>
  <style>
    body { font-family: system-ui, Segoe UI, Roboto, sans-serif; margin: 24px; color: #0f172a; background: #f8fafc; }
    h1 { font-size: 1.35rem; }
    h2 { font-size: 1.1rem; margin-top: 2rem; border-bottom: 2px solid #334155; padding-bottom: 4px; }
    h3 { font-size: 1rem; margin-top: 1.25rem; }
    h4 { font-size: 0.95rem; margin-top: 1rem; }
    .muted { color: #64748b; font-weight: normal; }
    .warn { color: #b45309; background: #fffbeb; padding: 8px 12px; border-radius: 8px; }
    table { border-collapse: collapse; width: 100%; margin: 12px 0; font-size: 0.875rem; background: #fff; box-shadow: 0 1px 3px rgb(0 0 0 / 0.08); }
    th, td { border: 1px solid #e2e8f0; padding: 8px 10px; text-align: left; }
    th { background: #e2e8f0; }
    .dt-split { display: inline-flex; flex-direction: column; vertical-align: middle; line-height: 1.25; }
    .dt-split .dt-d { font-weight: 600; color: #0f172a; }
    .dt-split .dt-t { font-size: 0.82em; color: #64748b; font-variant-numeric: tabular-nums; }
    footer { margin-top: 3rem; padding-top: 1rem; border-top: 1px solid #cbd5e1; font-size: 0.85rem; color: #475569; }
    footer ul { padding-left: 1.25rem; }
    .machine { margin-bottom: 0.75rem; }
    details.machine-details { border: 1px solid #e2e8f0; border-radius: 12px; background: #fff; box-shadow: 0 1px 3px rgb(0 0 0 / 0.06); overflow: hidden; }
    summary.machine-summary { cursor: pointer; list-style: none; padding: 12px 14px; }
    summary.machine-summary::-webkit-details-marker { display: none; }
    summary.machine-summary::marker { content: ''; }
    .machine-summary-inner { max-width: 100%; }
    .machine-summary-head { display: flex; flex-wrap: wrap; align-items: baseline; gap: 6px 12px; margin-bottom: 6px; }
    .machine-summary-title { font-size: 1.05rem; color: #0f172a; }
    .machine-summary-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 10px 14px; margin-top: 4px; }
    .sg { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
    .sg-k { font-size: 0.68rem; text-transform: uppercase; letter-spacing: 0.05em; color: #64748b; font-weight: 600; }
    .sg-v { font-size: 0.9rem; font-weight: 600; color: #0f172a; word-break: break-word; line-height: 1.35; }
    .machine-detail-panel { padding: 12px 14px 16px; border-top: 1px solid #f1f5f9; background: #fafafa; }
    code { background: #e2e8f0; padding: 1px 4px; border-radius: 4px; font-size: 0.85em; }
    .op-states { margin: 12px 0 16px; padding: 12px; background: #fff; border: 1px solid #e2e8f0; border-radius: 10px; box-shadow: 0 1px 2px rgb(0 0 0 / 0.05); }
    .op-states h4 { margin: 0 0 8px; font-size: 0.9rem; color: #334155; }
    .status-legend { display: flex; flex-wrap: wrap; gap: 8px 14px; margin-bottom: 10px; font-size: 0.8rem; align-items: center; }
    .lgd-swatch { display: inline-block; width: 10px; height: 10px; border-radius: 2px; margin-right: 4px; vertical-align: middle; }
    .status-bar-wrap { margin-top: 4px; }
    .status-bar { position: relative; height: 28px; background: #e2e8f0; border-radius: 8px; overflow: hidden; border: 1px solid #cbd5e1; }
    .status-seg { position: absolute; top: 0; bottom: 0; min-width: 2px; box-sizing: border-box; border-right: 1px solid rgb(15 23 42 / 0.12); }
  </style>
</head>
<body>
  <h1>${escapeHtml(title)}</h1>
  <p class="muted">Xuất: ${formatReportDateTimeHtml(new Date())} — Phạm vi: ${escapeHtml(scopeDisplay)} — Số máy: ${machineIds.length}</p>
  ${content}
  ${renderFooter()}
</body>
</html>`;

  return { html, filename };
}

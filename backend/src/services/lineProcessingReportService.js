/**
 * HTML report: processing time by shift/day, product sessions from machine_line_telemetry,
 * run/stop/setup from machine_status_history (clipped to sessions).
 */
import { query } from '../../database/connection.js';
import { getShiftWindow } from '../utils/shiftCalculator.js';

const VALID_AREAS = new Set(['drawing', 'stranding', 'armoring', 'sheathing']);
const MAX_MACHINES = 80;
const TELEMETRY_LOOKBACK_MS = 7 * 24 * 60 * 60 * 1000;

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

function normalizeProductName(name) {
  if (name == null) return 'UNKNOWN';
  const s = String(name).trim();
  return s === '' ? 'UNKNOWN' : s;
}

/** Same idea as UI `machine.name` — never show blank when id is known. */
function machineDisplayName(row) {
  const n = row?.name != null ? String(row.name).trim() : '';
  const id = row?.id != null ? String(row.id).trim() : '';
  if (n !== '') return n;
  return id || 'UNKNOWN_MACHINE';
}

/**
 * Carry forward last non-empty telemetry product_name per machine so gaps
 * (null snapshots) do not wipe "Cm 3.00" from session rows.
 */
function forwardFillTelemetryProducts(rawRows) {
  const byMachine = new Map();
  for (const row of rawRows) {
    if (!byMachine.has(row.machineId)) byMachine.set(row.machineId, []);
    byMachine.get(row.machineId).push(row);
  }
  const combined = [];
  for (const [, list] of byMachine) {
    list.sort((a, b) => a.sampledAt.getTime() - b.sampledAt.getTime());
    let lastNonEmpty = null;
    for (const r of list) {
      const raw = r._rawProductName != null ? String(r._rawProductName).trim() : '';
      if (raw !== '') lastNonEmpty = raw;
      const effective = raw !== '' ? raw : lastNonEmpty;
      combined.push({
        machineId: r.machineId,
        sampledAt: r.sampledAt,
        status: r.status,
        productName: normalizeProductName(effective),
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
    `SELECT machine_id, sampled_at, product_name, status
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
    status: row.status,
  }));
  return forwardFillTelemetryProducts(rawMapped);
}

/**
 * Build product sessions for one machine within [w0, w1), using telemetry from telFrom to w1.
 */
function buildProductSessions(rows, machineId, w0, w1) {
  const machineRows = rows.filter((r) => r.machineId === machineId);
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
  for (let i = machineRows.length - 1; i >= 0; i -= 1) {
    if (machineRows[i].sampledAt.getTime() < w0t) {
      productAtWindowStart = machineRows[i].productName;
      break;
    }
  }
  if (productAtWindowStart === 'UNKNOWN') {
    const firstIn = machineRows.find((r) => {
      const t = r.sampledAt.getTime();
      return t >= w0t && t < w1t;
    });
    if (firstIn) productAtWindowStart = firstIn.productName;
  }

  const sessions = [];
  let currentProduct = productAtWindowStart;
  let sessionStartMs = w0t;

  const emitSession = (endMs) => {
    if (endMs <= sessionStartMs) return;
    sessions.push({
      product: currentProduct,
      start: new Date(sessionStartMs),
      end: new Date(endMs),
    });
  };

  for (const r of machineRows) {
    const t = r.sampledAt.getTime();
    if (t < w0t) continue;
    if (t >= w1t) break;
    if (r.productName !== currentProduct) {
      emitSession(t);
      currentProduct = r.productName;
      sessionStartMs = t;
    }
  }
  emitSession(w1t);

  let productChangesInWindow = 0;
  for (let i = 1; i < machineRows.length; i += 1) {
    const prev = machineRows[i - 1];
    const cur = machineRows[i];
    const ct = cur.sampledAt.getTime();
    if (ct < w0t || ct >= w1t) continue;
    if (prev.productName !== cur.productName) productChangesInWindow += 1;
  }

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

function buildChangeoverRows(sessions) {
  const rows = [];
  for (let i = 1; i < sessions.length; i += 1) {
    const prev = sessions[i - 1];
    const cur = sessions[i];
    const gapSec = (cur.start.getTime() - prev.end.getTime()) / 1000;
    if (prev.product === cur.product) continue;
    rows.push({
      fromProduct: prev.product,
      toProduct: cur.product,
      gapSeconds: Math.max(0, gapSec),
    });
  }
  return rows;
}

function renderMachineSection(
  machineDisplayTitle,
  machineId,
  shiftLabel,
  w0,
  w1,
  reportSlice,
  liveProductFromMachine,
  machineHistorySegments,
  reportNowMs
) {
  const { sessions, productChangesInWindow, hasTelemetryInWindow, changeovers } = reportSlice;

  const idSuffix =
    machineId && machineDisplayTitle && machineId !== machineDisplayTitle
      ? ` <span class="muted">(mã: ${escapeHtml(machineId)})</span>`
      : '';

  let body = '';
  body += `<p><strong>Tên máy:</strong> ${escapeHtml(machineDisplayTitle)}${idSuffix}</p>`;
  body += `<p><strong>Sản phẩm hiện tại (máy — như màn hình chi tiết / bảng machines):</strong> ${escapeHtml(
    liveProductFromMachine && String(liveProductFromMachine).trim() !== ''
      ? String(liveProductFromMachine).trim()
      : '—'
  )}</p>`;

  if (!hasTelemetryInWindow) {
    body += `<p class="warn">Không có snapshot telemetry trong cửa sổ; ranh giới sản phẩm suy từ dữ liệu trước ca hoặc chỉ hiển thị tổng trạng thái.</p>`;
  }

  body += `<p><strong>Số lần đổi sản phẩm (theo snapshot telemetry, sau khi lấp chỗ trống product) trong cửa sổ:</strong> ${productChangesInWindow}</p>`;

  const clippedShift = clipHistoryToShiftWindow(machineHistorySegments, w0, w1, reportNowMs);
  body += renderShiftStatusBarHtml(clippedShift, w0, w1);

  body += '<table><thead><tr>';
  body +=
    '<th>Sản phẩm (Production)</th><th>Bắt đầu</th><th>Kết thúc</th><th>Slot (wall)</th><th>Chạy (running)</th><th>Setup</th><th>Dừng khác</th>';
  body += '</tr></thead><tbody>';

  for (const sess of sessions) {
    const wallSec = (sess.end.getTime() - sess.start.getTime()) / 1000;
    const { runningSec, setupSec, otherStopSec } = sess.metrics;
    body += '<tr>';
    body += `<td>${escapeHtml(sess.product)}</td>`;
    body += `<td>${escapeHtml(sess.start.toISOString())}</td>`;
    body += `<td>${escapeHtml(sess.end.toISOString())}</td>`;
    body += `<td>${escapeHtml(formatDurationSeconds(wallSec))}</td>`;
    body += `<td>${escapeHtml(formatDurationSeconds(runningSec))}</td>`;
    body += `<td>${escapeHtml(formatDurationSeconds(setupSec))}</td>`;
    body += `<td>${escapeHtml(formatDurationSeconds(otherStopSec))}</td>`;
    body += '</tr>';
  }
  if (sessions.length === 0) {
    body += '<tr><td colspan="7">Không có phiên sản phẩm trong cửa sổ.</td></tr>';
  }
  body += '</tbody></table>';

  if (changeovers.length > 0) {
    body += '<h4>Chuyển đổi sản phẩm (khoảng wall giữa hai phiên liên tiếp)</h4>';
    body += '<table><thead><tr><th>Từ</th><th>Sang</th><th>Thời gian chuyển (ước lượng)</th></tr></thead><tbody>';
    for (const c of changeovers) {
      body += `<tr><td>${escapeHtml(c.fromProduct)}</td><td>${escapeHtml(c.toProduct)}</td><td>${escapeHtml(formatDurationSeconds(c.gapSeconds))}</td></tr>`;
    }
    body += '</tbody></table>';
  }

  return `
    <section class="machine">
      <h3>${escapeHtml(machineDisplayTitle)} — ${escapeHtml(shiftLabel)}</h3>
      <p class="muted">Cửa sổ: ${escapeHtml(w0.toISOString())} → ${escapeHtml(w1.toISOString())} (server local)</p>
      ${body}
    </section>
  `;
}

function renderFooter() {
  return `
    <footer>
      <h3>Chú thích</h3>
      <ul>
        <li><strong>Tên máy</strong>: ưu tiên <code>machines.name</code>; nếu trống thì dùng <code>machines.id</code> (giống cách UI không để trống tiêu đề).</li>
        <li><strong>Sản phẩm hiện tại</strong>: dòng riêng lấy từ <code>machines.product_name</code> tại thời điểm xuất (cùng nguồn với ô Product trên EquipmentDetail).</li>
        <li><strong>Phiên sản phẩm trong bảng</strong>: từ <code>product_name</code> trên <code>machine_line_telemetry</code>, có <strong>lấp forward</strong> snapshot trống bằng sản phẩm snapshot gần nhất trước đó trên cùng máy (không dùng Order ID). Ranh giới vẫn phụ thuộc tần suất ghi telemetry.</li>
        <li><strong>Chạy / Setup / Dừng khác</strong>: cộng thời lượng các đoạn <code>machine_status_history</code> sau khi cắt (clip) giao với khoảng thời gian của phiên; <code>running</code> = chạy, <code>setup</code> = setup, còn lại = dừng khác. Với đoạn đang mở (<code>status_end_time</code> null), kết thúc hiệu lực = <code>min(thời điểm xuất báo cáo, cuối cửa sổ)</code> — cùng ý với Gantt trên EquipmentDetail (không kéo running đến hết ca nếu máy đang chạy liên tục).</li>
        <li><strong>Thanh màu theo ca</strong>: dựng từ cùng tập đoạn đã cắt như trên.</li>
        <li><strong>Số lần đổi sản phẩm</strong>: số lần <code>product_name</code> (chuẩn hóa) đổi giữa hai snapshot telemetry liên tiếp có mốc thời gian nằm trong cửa sổ báo cáo.</li>
        <li><strong>Thời gian chuyển đổi A → B</strong>: khoảng wall-time giữa kết thúc phiên A và bắt đầu phiên B (liền kề trên timeline).</li>
        <li>Múi giờ: thời gian ca và <code>localDate</code> theo múi giờ của máy chủ Node.js.</li>
      </ul>
    </footer>
  `;
}

/**
 * @param {{ localDate: string, shift?: string|null, area?: string|null, machineIds?: string|null }} params
 * @returns {Promise<{ html: string, filename: string }|{ error: string, status: number }>}
 */
export async function buildLineProcessingHtmlReport(params) {
  const { localDate, shift: shiftRaw, area: areaRaw, machineIds: machineIdsRaw } = params;

  if (localDate == null || String(localDate).trim() === '') {
    return { error: 'localDate is required (YYYY-MM-DD)', status: 400 };
  }

  const anchor = parseLocalDateYmd(localDate);
  if (!anchor) {
    return { error: 'localDate must be YYYY-MM-DD', status: 400 };
  }

  const area = areaRaw != null && String(areaRaw).trim() !== '' ? String(areaRaw).trim().toLowerCase() : null;
  const machineIdsCsv =
    machineIdsRaw != null && String(machineIdsRaw).trim() !== '' ? String(machineIdsRaw).trim() : null;

  if ((area && machineIdsCsv) || (!area && !machineIdsCsv)) {
    return { error: 'Provide exactly one of: area (drawing|stranding|armoring|sheathing) or machineIds (comma-separated)', status: 400 };
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
  if (area) {
    const r = await query(
      `SELECT id, name, area, product_name FROM machines WHERE area = $1::production_area ORDER BY id ASC`,
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
      `SELECT id, name, area, product_name FROM machines WHERE id = ANY($1::varchar[]) ORDER BY id ASC`,
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

  if (machineRows.length > MAX_MACHINES) {
    return { error: `At most ${MAX_MACHINES} machines per export`, status: 400 };
  }

  const machineIds = machineRows.map((m) => m.id);
  const scopeLabel = area || `machines-${machineIds.length}`;

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

  const statusByMachine = new Map();
  for (const mid of machineIds) statusByMachine.set(String(mid), []);
  for (const s of statusRows) {
    const key = String(s.machineId);
    if (!statusByMachine.has(key)) statusByMachine.set(key, []);
    statusByMachine.get(key).push(s);
  }

  const shiftLabels = { 1: 'Ca 1 (06:00–14:00)', 2: 'Ca 2 (14:00–22:00)', 3: 'Ca 3 (22:00–06:00 hôm sau)' };

  const reportNowMs = Date.now();
  let content = '';
  for (const sn of shifts) {
    const { start: w0, end: w1 } = getShiftWindow(sn, anchor);
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
      const changeovers = buildChangeoverRows(sessions);

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
          changeovers,
        },
        m.product_name,
        segments,
        reportNowMs
      );
    }
    content += '</article>';
  }

  const shiftPart =
    shifts.length === 3 ? 'all-shifts' : `shift${shifts[0]}`;
  const filename = `line-processing_${scopeLabel}_${localDate}_${shiftPart}.html`;

  const title = `Báo cáo Processing — ${scopeLabel} — ${localDate}`;

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
    footer { margin-top: 3rem; padding-top: 1rem; border-top: 1px solid #cbd5e1; font-size: 0.85rem; color: #475569; }
    footer ul { padding-left: 1.25rem; }
    .machine { margin-bottom: 2rem; }
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
  <p class="muted">Xuất: ${escapeHtml(new Date().toISOString())} (ISO) — Phạm vi: ${escapeHtml(scopeLabel)} — Máy: ${machineIds.length}</p>
  ${content}
  ${renderFooter()}
</body>
</html>`;

  return { html, filename };
}

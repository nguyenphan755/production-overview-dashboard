/**
 * CSV parser for oee_calculations export — mirrors scripts/sh04-speed-compare.html
 */
import { FACTORY_TIME_ZONE } from './shiftCalculator';

export type CsvOeeRow = {
  machineId: string;
  ts: Date;
  running: number;
  planned: number;
  actual: number;
  target: number;
};

export type CsvSpeedBucket = {
  x: number;
  actual: number;
  target: number;
  running: number;
};

const OEE_LINE_RE =
  /^(\d+),"([^"]+)","([^"]+)","([^"]+)",([^,]+),([^,]+),([^,]+),([^,]+),"([^"]+)","([^"]+)",(\d+),(\d+),([^,]+),([^,]+),([^,]+),([^,]+),"([^"]+)"$/;

export function parseOeeCsvLine(line: string): CsvOeeRow | null {
  const m = line.match(OEE_LINE_RE);
  if (!m) return null;
  return {
    machineId: m[2],
    ts: new Date(m[4].replace(' ', 'T') + '+07:00'),
    running: Number(m[11]),
    planned: Number(m[12]),
    actual: Number(m[13]),
    target: Number(m[14]),
  };
}

export function parseOeeCsvText(text: string): CsvOeeRow[] {
  const lines = text.trim().split(/\r?\n/);
  return lines.slice(1).map(parseOeeCsvLine).filter((r): r is CsvOeeRow => r != null);
}

export function filterCsvRowsInWindow(rows: CsvOeeRow[], startMs: number, endMs: number): CsvOeeRow[] {
  return rows.filter((r) => {
    const t = r.ts.getTime();
    return t >= startMs && t <= endMs;
  });
}

/** Epoch bucket — same as HTML bucketRows() */
export function bucketCsvRows(rows: CsvOeeRow[], bucketSec: number): CsvSpeedBucket[] {
  const map = new Map<
    number,
    { sumA: number; sumT: number; maxR: number; n: number; ts: number }
  >();
  for (const r of rows) {
    const sec = Math.floor(r.ts.getTime() / 1000);
    const b = Math.floor(sec / bucketSec) * bucketSec;
    if (!map.has(b)) map.set(b, { sumA: 0, sumT: 0, maxR: 0, n: 0, ts: b * 1000 });
    const o = map.get(b)!;
    o.sumA += r.actual;
    o.sumT += r.target;
    o.maxR = Math.max(o.maxR, r.running);
    o.n += 1;
  }
  return [...map.values()]
    .map((o) => ({
      x: o.ts,
      actual: o.sumA / o.n,
      target: o.sumT / o.n,
      running: o.maxR,
    }))
    .sort((a, b) => a.x - b.x);
}

export function csvSummary(rows: CsvOeeRow[]) {
  if (!rows.length) {
    return { rowCount: 0, peak: 0, zeroPct: 0, finalRunning: 0, planned: 0 };
  }
  const peak = rows.reduce((m, r) => Math.max(m, r.actual), 0);
  const zeroPct = (rows.filter((r) => r.actual === 0).length / rows.length) * 100;
  const last = rows[rows.length - 1];
  return {
    rowCount: rows.length,
    peak,
    zeroPct,
    finalRunning: last.running,
    planned: last.planned,
  };
}

export function formatIctMs(ms: number): string {
  return new Date(ms).toLocaleString('vi-VN', {
    timeZone: FACTORY_TIME_ZONE,
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
}

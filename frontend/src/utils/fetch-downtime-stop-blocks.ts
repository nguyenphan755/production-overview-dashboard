import { apiClient } from '../services/api';
import { computeSpeedLabRawLimit } from '../hooks/useSpeedLabQuery';
import type { SpeedLabStopBlock } from '../types/oee-analytics-lab';
import { buildStopBlocksFromPoints } from './speed-lab-stop-blocks';
import {
  addDaysToYmd,
  getProductionDayLabelDate,
  getProductionDayWindow,
} from './shiftCalculator';

const MAX_RANGE_MS = 31 * 24 * 60 * 60 * 1000;
const MAX_PRODUCTION_DAYS = 31;
/** Match backend raw fetch ceiling (~25h) for a single API call. */
const SINGLE_FETCH_RAW_MAX_MS = 26 * 3_600_000;

function pickBucketSec(spanMs: number): number {
  const days = spanMs / 86_400_000;
  if (days <= 3) return 30;
  if (days <= 14) return 60;
  return 120;
}

function pointsFromResponse(
  data: NonNullable<Awaited<ReturnType<typeof apiClient.getSpeedLabQuery>>['data']>
) {
  if (data.rawRows?.length) {
    return data.rawRows.map((row) => ({
      timestamp: row.timestamp,
      actualSpeed: row.actualSpeed,
    }));
  }
  return data.buckets.map((bucket) => ({
    timestamp: bucket.timestamp,
    actualSpeed: bucket.actualSpeed,
  }));
}

function enumerateProductionDays(fromYmd: string, toYmd: string): string[] {
  const days: string[] = [];
  for (let ymd = fromYmd; ymd <= toYmd; ymd = addDaysToYmd(ymd, 1)) {
    days.push(ymd);
  }
  return days;
}

/** Production-day labels covered by [rangeStart, rangeEnd) (06:00 ICT boundaries). */
function productionDaysInRange(rangeStart: Date, rangeEnd: Date): string[] {
  const fromYmd = getProductionDayLabelDate(rangeStart);
  const lastInstant = new Date(Math.max(rangeStart.getTime(), rangeEnd.getTime() - 1));
  const toYmd = getProductionDayLabelDate(lastInstant);
  return enumerateProductionDays(fromYmd, toYmd);
}

function clipStopBlocksToRange(
  stopBlocks: SpeedLabStopBlock[],
  rangeStartMs: number,
  rangeEndMs: number
): SpeedLabStopBlock[] {
  return stopBlocks
    .filter((block) => block.endMs > rangeStartMs && block.startMs < rangeEndMs)
    .map((block) => {
      const startMs = Math.max(block.startMs, rangeStartMs);
      const endMs = Math.min(block.endMs, rangeEndMs);
      return {
        ...block,
        startMs,
        endMs,
        durationSec: Math.max(0, Math.round((endMs - startMs) / 1000)),
      };
    })
    .filter((block) => block.durationSec >= 120)
    .sort((a, b) => a.startMs - b.startMs || a.endMs - b.endMs);
}

async function fetchRawStopBlocksForWindow(
  machineId: string,
  windowStart: Date,
  windowEnd: Date,
  signal?: AbortSignal
): Promise<SpeedLabStopBlock[]> {
  const spanMs = windowEnd.getTime() - windowStart.getTime();
  const bucketSec = pickBucketSec(spanMs);

  const res = await apiClient.getSpeedLabQuery(
    {
      machineId,
      start: windowStart.toISOString(),
      end: windowEnd.toISOString(),
      bucketSec,
      includeRaw: true,
      rawLimit: computeSpeedLabRawLimit(windowStart, windowEnd),
    },
    { signal }
  );

  if (!res.success || !res.data) {
    throw new Error(res.message ?? 'Không tải được dữ liệu downtime.');
  }

  return buildStopBlocksFromPoints(pointsFromResponse(res.data));
}

async function fetchStopBlocksPerProductionDay(
  machineId: string,
  dayLabels: string[],
  rangeStartMs: number,
  rangeEndMs: number,
  signal?: AbortSignal
): Promise<SpeedLabStopBlock[]> {
  const merged: SpeedLabStopBlock[] = [];

  for (const ymd of dayLabels) {
    const { start, end } = getProductionDayWindow(ymd);
    const dayStartMs = Math.max(start.getTime(), rangeStartMs);
    const dayEndMs = Math.min(end.getTime(), rangeEndMs);
    if (dayEndMs <= dayStartMs) continue;

    const dayBlocks = await fetchRawStopBlocksForWindow(
      machineId,
      new Date(dayStartMs),
      new Date(dayEndMs),
      signal
    );
    merged.push(...dayBlocks);
  }

  const seen = new Set<string>();
  const unique = merged.filter((block) => {
    const key = `${block.startMs}|${block.endMs}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return clipStopBlocksToRange(unique, rangeStartMs, rangeEndMs);
}

export type DowntimeFetchResult = {
  rangeStart: Date;
  rangeEnd: Date;
  stopBlocks: SpeedLabStopBlock[];
  bucketSec: number;
};

export async function fetchDowntimeStopBlocksByDates(
  machineId: string,
  fromYmd: string,
  toYmd: string,
  signal?: AbortSignal
): Promise<DowntimeFetchResult> {
  if (fromYmd > toYmd) {
    throw new Error('Ngày bắt đầu phải trước hoặc bằng ngày kết thúc.');
  }

  const dayLabels = enumerateProductionDays(fromYmd, toYmd);
  if (dayLabels.length > MAX_PRODUCTION_DAYS) {
    throw new Error('Chỉ xuất được tối đa 31 ngày sản xuất (06:00 ICT).');
  }

  const { start: rangeStart } = getProductionDayWindow(fromYmd);
  const { end: rangeEnd } = getProductionDayWindow(toYmd);

  const stopBlocks = await fetchStopBlocksPerProductionDay(
    machineId,
    dayLabels,
    rangeStart.getTime(),
    rangeEnd.getTime(),
    signal
  );

  return {
    rangeStart,
    rangeEnd,
    stopBlocks,
    bucketSec: 1,
  };
}

export async function fetchDowntimeStopBlocksByRange(
  machineId: string,
  rangeStart: Date,
  rangeEnd: Date,
  signal?: AbortSignal
): Promise<DowntimeFetchResult> {
  const rangeStartMs = rangeStart.getTime();
  const rangeEndMs = rangeEnd.getTime();
  const spanMs = rangeEndMs - rangeStartMs;

  if (spanMs <= 0) {
    throw new Error('Khoảng thời gian không hợp lệ.');
  }
  if (spanMs > MAX_RANGE_MS) {
    throw new Error('Chỉ xuất được tối đa 31 ngày sản xuất (06:00 ICT).');
  }

  const dayLabels = productionDaysInRange(rangeStart, rangeEnd);
  if (dayLabels.length > MAX_PRODUCTION_DAYS) {
    throw new Error('Chỉ xuất được tối đa 31 ngày sản xuất (06:00 ICT).');
  }

  let stopBlocks: SpeedLabStopBlock[];

  if (dayLabels.length === 1 && spanMs <= SINGLE_FETCH_RAW_MAX_MS) {
    stopBlocks = clipStopBlocksToRange(
      await fetchRawStopBlocksForWindow(machineId, rangeStart, rangeEnd, signal),
      rangeStartMs,
      rangeEndMs
    );
  } else {
    stopBlocks = await fetchStopBlocksPerProductionDay(
      machineId,
      dayLabels,
      rangeStartMs,
      rangeEndMs,
      signal
    );
  }

  return {
    rangeStart,
    rangeEnd,
    stopBlocks,
    bucketSec: dayLabels.length === 1 && spanMs <= SINGLE_FETCH_RAW_MAX_MS ? pickBucketSec(spanMs) : 1,
  };
}

import { apiClient } from '../services/api';
import { computeSpeedLabRawLimit } from '../hooks/useSpeedLabQuery';
import type { SpeedLabStopBlock } from '../types/oee-analytics-lab';
import { buildStopBlocksFromPoints } from './speed-lab-stop-blocks';
import { MIN_DOWNTIME_STOP_SEC } from '../constants/downtime-threshold';
import {
  addDaysToYmd,
  getProductionDayLabelDate,
  getProductionDayWindow,
} from './shiftCalculator';

const MAX_RANGE_MS = 31 * 24 * 60 * 60 * 1000;
const MAX_PRODUCTION_DAYS = 31;
/** Match backend raw fetch ceiling (~25h) for a single API call. */
const SINGLE_FETCH_RAW_MAX_MS = 26 * 3_600_000;
/** Per production-day API call — factory DB can be slow on raw ~90k rows. */
const PER_DAY_TIMEOUT_MS = 120_000;
const FETCH_CONCURRENCY = 3;

export type DowntimeExportProgress =
  | { phase: 'fetch'; dayIndex: number; dayTotal: number; dayYmd: string }
  | { phase: 'excel' };

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
    .filter((block) => block.durationSec >= MIN_DOWNTIME_STOP_SEC)
    .sort((a, b) => a.startMs - b.startMs || a.endMs - b.endMs);
}

function mergeAbortSignals(...signals: (AbortSignal | undefined)[]): AbortSignal | undefined {
  const active = signals.filter((s): s is AbortSignal => Boolean(s));
  if (!active.length) return undefined;
  if (active.length === 1) return active[0];
  const controller = new AbortController();
  const onAbort = () => controller.abort();
  for (const signal of active) {
    if (signal.aborted) {
      controller.abort();
      break;
    }
    signal.addEventListener('abort', onAbort, { once: true });
  }
  return controller.signal;
}

async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  timeoutMessage: string,
  parentSignal?: AbortSignal
): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const onParentAbort = () => controller.abort();
  parentSignal?.addEventListener('abort', onParentAbort, { once: true });

  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        controller.signal.addEventListener(
          'abort',
          () => {
            if (parentSignal?.aborted) {
              reject(new DOMException('Aborted', 'AbortError'));
              return;
            }
            reject(new Error(timeoutMessage));
          },
          { once: true }
        );
      }),
    ]);
  } finally {
    clearTimeout(timer);
    parentSignal?.removeEventListener('abort', onParentAbort);
  }
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

async function runWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  worker: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  if (!items.length) return [];
  const results = new Array<R>(items.length);
  let nextIndex = 0;

  const runners = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (nextIndex < items.length) {
      const index = nextIndex;
      nextIndex += 1;
      results[index] = await worker(items[index], index);
    }
  });

  await Promise.all(runners);
  return results;
}

async function fetchStopBlocksPerProductionDay(
  machineId: string,
  dayLabels: string[],
  rangeStartMs: number,
  rangeEndMs: number,
  signal?: AbortSignal,
  onProgress?: (progress: DowntimeExportProgress) => void
): Promise<SpeedLabStopBlock[]> {
  const dayWindows = dayLabels
    .map((ymd) => {
      const { start, end } = getProductionDayWindow(ymd);
      const dayStartMs = Math.max(start.getTime(), rangeStartMs);
      const dayEndMs = Math.min(end.getTime(), rangeEndMs);
      return { ymd, dayStartMs, dayEndMs };
    })
    .filter((day) => day.dayEndMs > day.dayStartMs);

  const dayResults = await runWithConcurrency(
    dayWindows,
    FETCH_CONCURRENCY,
    async (day, index) => {
      onProgress?.({
        phase: 'fetch',
        dayIndex: index + 1,
        dayTotal: dayWindows.length,
        dayYmd: day.ymd,
      });

      const daySignal = mergeAbortSignals(signal);
      return withTimeout(
        fetchRawStopBlocksForWindow(
          machineId,
          new Date(day.dayStartMs),
          new Date(day.dayEndMs),
          daySignal
        ),
        PER_DAY_TIMEOUT_MS,
        `Quá thời gian chờ dữ liệu ngày ${day.ymd} (>${PER_DAY_TIMEOUT_MS / 1000}s). Thu hẹp khoảng ngày hoặc thử lại.`,
        signal
      );
    }
  );

  const merged = dayResults.flat();

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

export type DowntimeFetchOptions = {
  signal?: AbortSignal;
  onProgress?: (progress: DowntimeExportProgress) => void;
};

export async function fetchDowntimeStopBlocksByDates(
  machineId: string,
  fromYmd: string,
  toYmd: string,
  options?: DowntimeFetchOptions
): Promise<DowntimeFetchResult> {
  const { signal, onProgress } = options ?? {};

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
    signal,
    onProgress
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
  options?: DowntimeFetchOptions
): Promise<DowntimeFetchResult> {
  const { signal, onProgress } = options ?? {};
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
    onProgress?.({ phase: 'fetch', dayIndex: 1, dayTotal: 1, dayYmd: dayLabels[0] });
    stopBlocks = clipStopBlocksToRange(
      await withTimeout(
        fetchRawStopBlocksForWindow(machineId, rangeStart, rangeEnd, signal),
        PER_DAY_TIMEOUT_MS,
        `Quá thời gian chờ dữ liệu (>${PER_DAY_TIMEOUT_MS / 1000}s). Thu hẹp khoảng ngày hoặc thử lại.`,
        signal
      ),
      rangeStartMs,
      rangeEndMs
    );
  } else {
    stopBlocks = await fetchStopBlocksPerProductionDay(
      machineId,
      dayLabels,
      rangeStartMs,
      rangeEndMs,
      signal,
      onProgress
    );
  }

  return {
    rangeStart,
    rangeEnd,
    stopBlocks,
    bucketSec: dayLabels.length === 1 && spanMs <= SINGLE_FETCH_RAW_MAX_MS ? pickBucketSec(spanMs) : 1,
  };
}

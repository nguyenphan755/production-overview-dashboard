import { useCallback, useEffect, useRef, useState } from 'react';
import { apiClient } from '../services/api';
import type { SpeedHistoryResponse } from '../utils/equipment-speed-analysis-chart';

type UseEquipmentSpeedHistoryArgs = {
  machineId: string | null | undefined;
  queryStart: Date;
  queryEnd: Date;
  /** Cap live poll requests — full OEE chart window end */
  chartWindowEnd?: Date;
  pollMs: number | null;
  bucketSec?: number;
  rangeKey: string;
};

export type SpeedHistoryPayload = {
  response: SpeedHistoryResponse;
  rangeKey: string;
};

type UseEquipmentSpeedHistoryResult = {
  data: SpeedHistoryPayload | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
};

export function useEquipmentSpeedHistory({
  machineId,
  queryStart,
  queryEnd,
  chartWindowEnd,
  pollMs,
  bucketSec = 60,
  rangeKey,
}: UseEquipmentSpeedHistoryArgs): UseEquipmentSpeedHistoryResult {
  const [data, setData] = useState<SpeedHistoryPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestSeqRef = useRef(0);
  const inFlightRef = useRef(false);
  const [tick, setTick] = useState(0);
  const queryRef = useRef({ queryStart, queryEnd, chartWindowEnd, bucketSec, rangeKey, pollMs });
  queryRef.current = { queryStart, queryEnd, chartWindowEnd, bucketSec, rangeKey, pollMs };

  const refetch = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    if (!machineId) {
      setData(null);
      setError(null);
      return;
    }

    setError(null);
    setLoading(true);
    setData(null);

    const seq = ++requestSeqRef.current;
    const ac = new AbortController();

    const fetchSpeedHistory = async (isPoll = false) => {
      if (inFlightRef.current) return;
      inFlightRef.current = true;

      const q = queryRef.current;
      if (!isPoll) setLoading(true);

      let endForRequest = isPoll && q.pollMs != null ? new Date() : q.queryEnd;
      if (q.chartWindowEnd && endForRequest.getTime() > q.chartWindowEnd.getTime()) {
        endForRequest = q.chartWindowEnd;
      }
      if (endForRequest.getTime() <= q.queryStart.getTime()) {
        endForRequest = new Date(q.queryStart.getTime() + 60_000);
      }

      try {
        const response = await apiClient.getMachineSpeedHistory(
          machineId,
          {
            start: q.queryStart.toISOString(),
            end: endForRequest.toISOString(),
            bucketSec: q.bucketSec,
          },
          { signal: ac.signal }
        );
        if (ac.signal.aborted || seq !== requestSeqRef.current) return;
        if (response.success && response.data) {
          setData({ response: response.data, rangeKey: q.rangeKey });
          setError(null);
        } else {
          setError(response.message ?? 'Không tải được lịch sử tốc độ');
        }
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') return;
        if (seq !== requestSeqRef.current) return;
        console.error('Error fetching speed history:', err);
        setError(err instanceof Error ? err.message : 'Lỗi mạng');
      } finally {
        inFlightRef.current = false;
        if (!ac.signal.aborted && seq === requestSeqRef.current) {
          setLoading(false);
        }
      }
    };

    fetchSpeedHistory(false);

    if (pollMs == null) {
      return () => {
        ac.abort();
      };
    }

    const interval = setInterval(() => fetchSpeedHistory(true), pollMs);
    return () => {
      clearInterval(interval);
      ac.abort();
    };
  }, [machineId, rangeKey, pollMs, tick]);

  return { data, loading, error, refetch };
}

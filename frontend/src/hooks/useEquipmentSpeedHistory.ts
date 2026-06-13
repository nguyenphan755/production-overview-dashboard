import { useEffect, useRef, useState } from 'react';
import { apiClient } from '../services/api';
import type { SpeedHistoryResponse } from '../utils/equipment-speed-analysis-chart';

type UseEquipmentSpeedHistoryArgs = {
  machineId: string | null | undefined;
  queryStart: Date;
  queryEnd: Date;
  pollMs: number | null;
  bucketSec?: number;
  /** Realtime: fetch N most recent buckets (backend limit). */
  pointLimit?: number | null;
};

type UseEquipmentSpeedHistoryResult = {
  data: SpeedHistoryResponse | null;
  loading: boolean;
  error: string | null;
};

export function useEquipmentSpeedHistory({
  machineId,
  queryStart,
  queryEnd,
  pollMs,
  bucketSec = 60,
  pointLimit = null,
}: UseEquipmentSpeedHistoryArgs): UseEquipmentSpeedHistoryResult {
  const [data, setData] = useState<SpeedHistoryResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const hasDataRef = useRef(false);
  const requestSeqRef = useRef(0);

  const rangeKey = `${machineId ?? ''}|${queryStart.toISOString()}|${queryEnd.toISOString()}|${bucketSec}|${pointLimit ?? ''}`;

  useEffect(() => {
    if (!machineId) {
      setData(null);
      setError(null);
      hasDataRef.current = false;
      return;
    }

    const seq = ++requestSeqRef.current;
    const ac = new AbortController();

    const fetchSpeedHistory = async (isPoll = false) => {
      const blockingLoader = !hasDataRef.current && !isPoll;
      if (blockingLoader) setLoading(true);

      try {
        const response = await apiClient.getMachineSpeedHistory(
          machineId,
          {
            start: queryStart.toISOString(),
            end: queryEnd.toISOString(),
            bucketSec,
            limit: pointLimit ?? undefined,
          },
          { signal: ac.signal }
        );
        if (ac.signal.aborted || seq !== requestSeqRef.current) return;
        if (response.success && response.data) {
          setData(response.data);
          setError(null);
          if (response.data.points.length > 0) {
            hasDataRef.current = true;
          }
        } else {
          setError(response.message ?? 'Không tải được lịch sử tốc độ');
        }
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') return;
        if (seq !== requestSeqRef.current) return;
        console.error('Error fetching speed history:', err);
        setError(err instanceof Error ? err.message : 'Lỗi mạng');
      } finally {
        if (!ac.signal.aborted && seq === requestSeqRef.current && blockingLoader) {
          setLoading(false);
        }
      }
    };

    hasDataRef.current = false;
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
  }, [machineId, rangeKey, pollMs, queryStart, queryEnd, bucketSec, pointLimit]);

  return { data, loading, error };
}

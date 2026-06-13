import { useEffect, useRef, useState } from 'react';
import { apiClient } from '../services/api';
import type { SpeedHistoryResponse } from '../utils/equipment-speed-analysis-chart';

type UseEquipmentSpeedHistoryArgs = {
  machineId: string | null | undefined;
  queryStart: Date;
  queryEnd: Date;
  pollMs: number | null;
  bucketSec?: number;
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
}: UseEquipmentSpeedHistoryArgs): UseEquipmentSpeedHistoryResult {
  const [data, setData] = useState<SpeedHistoryResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const hasDataRef = useRef(false);

  const rangeKey = `${machineId ?? ''}|${queryStart.toISOString()}|${queryEnd.toISOString()}|${bucketSec}`;

  useEffect(() => {
    if (!machineId) {
      setData(null);
      setError(null);
      hasDataRef.current = false;
      return;
    }

    const ac = new AbortController();

    const fetchSpeedHistory = async () => {
      const blockingLoader = !hasDataRef.current;
      if (blockingLoader) setLoading(true);

      try {
        const response = await apiClient.getMachineSpeedHistory(
          machineId,
          {
            start: queryStart.toISOString(),
            end: queryEnd.toISOString(),
            bucketSec,
          },
          { signal: ac.signal }
        );
        if (ac.signal.aborted) return;
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
        console.error('Error fetching speed history:', err);
        setError(err instanceof Error ? err.message : 'Lỗi mạng');
      } finally {
        if (!ac.signal.aborted && blockingLoader) {
          setLoading(false);
        }
      }
    };

    fetchSpeedHistory();

    if (pollMs == null) {
      return () => ac.abort();
    }

    const interval = setInterval(fetchSpeedHistory, pollMs);
    return () => {
      clearInterval(interval);
      ac.abort();
    };
  }, [machineId, rangeKey, pollMs, queryStart, queryEnd, bucketSec]);

  return { data, loading, error };
}

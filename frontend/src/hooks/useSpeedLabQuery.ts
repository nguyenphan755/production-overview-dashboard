import { useEffect, useRef, useState } from 'react';
import { apiClient } from '../services/api';
import type { SpeedLabQueryResponse } from '../types/oee-analytics-lab';

type UseSpeedLabQueryArgs = {
  machineId: string | null;
  queryStart: Date;
  queryEnd: Date;
  bucketSec: number;
  rangeKey: string;
  enabled: boolean;
};

type UseSpeedLabQueryResult = {
  data: SpeedLabQueryResponse | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
};

export function useSpeedLabQuery({
  machineId,
  queryStart,
  queryEnd,
  bucketSec,
  rangeKey,
  enabled,
}: UseSpeedLabQueryArgs): UseSpeedLabQueryResult {
  const [data, setData] = useState<SpeedLabQueryResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const seqRef = useRef(0);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!enabled || !machineId) {
      setData(null);
      setError(null);
      return;
    }

    const ac = new AbortController();
    const seq = ++seqRef.current;
    setLoading(true);
    setError(null);

    (async () => {
      try {
        const res = await apiClient.getSpeedLabQuery(
          {
            machineId,
            start: queryStart.toISOString(),
            end: queryEnd.toISOString(),
            bucketSec,
            includeRaw: true,
            rawLimit: 30000,
          },
          { signal: ac.signal }
        );
        if (ac.signal.aborted || seq !== seqRef.current) return;
        if (res.success && res.data) {
          setData(res.data);
          setError(res.data.buckets.length === 0 ? (res.message ?? 'Không có dữ liệu oee_calculations') : null);
        } else {
          setData(null);
          setError(res.message ?? 'Không tải được dữ liệu Speed Lab');
        }
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') return;
        if (seq !== seqRef.current) return;
        setData(null);
        setError(err instanceof Error ? err.message : 'Lỗi mạng');
      } finally {
        if (!ac.signal.aborted && seq === seqRef.current) {
          setLoading(false);
        }
      }
    })();

    return () => ac.abort();
  }, [machineId, queryStart, queryEnd, bucketSec, rangeKey, enabled, tick]);

  return {
    data,
    loading,
    error,
    refetch: () => setTick((t) => t + 1),
  };
}

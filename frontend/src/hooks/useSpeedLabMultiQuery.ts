import { useEffect, useRef, useState } from 'react';
import { apiClient } from '../services/api';
import type { SpeedLabMultiQueryResponse } from '../types/oee-analytics-lab';

type UseSpeedLabMultiQueryArgs = {
  queryStart: Date;
  queryEnd: Date;
  bucketSec: number;
  rangeKey: string;
  enabled: boolean;
};

type UseSpeedLabMultiQueryResult = {
  data: SpeedLabMultiQueryResponse | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
};

export function useSpeedLabMultiQuery({
  queryStart,
  queryEnd,
  bucketSec,
  rangeKey,
  enabled,
}: UseSpeedLabMultiQueryArgs): UseSpeedLabMultiQueryResult {
  const [data, setData] = useState<SpeedLabMultiQueryResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const seqRef = useRef(0);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!enabled) {
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
        const res = await apiClient.getSpeedLabMultiQuery(
          {
            start: queryStart.toISOString(),
            end: queryEnd.toISOString(),
            bucketSec,
          },
          { signal: ac.signal }
        );
        if (ac.signal.aborted || seq !== seqRef.current) return;
        if (res.success && res.data) {
          setData(res.data);
          setError(
            res.data.meta.machinesWithData === 0
              ? 'Không có dữ liệu oee_calculations trong khung ca đã chọn'
              : null
          );
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
  }, [queryStart, queryEnd, bucketSec, rangeKey, enabled, tick]);

  return {
    data,
    loading,
    error,
    refetch: () => setTick((t) => t + 1),
  };
}

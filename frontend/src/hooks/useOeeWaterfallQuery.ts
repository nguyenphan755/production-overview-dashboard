import { useEffect, useRef, useState } from 'react';
import { apiClient } from '../services/api';
import type { OeeWaterfallQueryResponse } from '../types/oee-analytics-lab';

type UseOeeWaterfallQueryArgs = {
  machineId: string | null;
  queryStart: Date;
  queryEnd: Date;
  rangeKey: string;
  enabled: boolean;
};

type UseOeeWaterfallQueryResult = {
  data: OeeWaterfallQueryResponse | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
};

export function useOeeWaterfallQuery({
  machineId,
  queryStart,
  queryEnd,
  rangeKey,
  enabled,
}: UseOeeWaterfallQueryArgs): UseOeeWaterfallQueryResult {
  const [data, setData] = useState<OeeWaterfallQueryResponse | null>(null);
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
        const res = await apiClient.getSpeedLabWaterfall(
          {
            machineId,
            start: queryStart.toISOString(),
            end: queryEnd.toISOString(),
          },
          { signal: ac.signal }
        );
        if (ac.signal.aborted || seq !== seqRef.current) return;
        if (res.success && res.data) {
          setData(res.data);
          setError(null);
        } else {
          setData(null);
          setError(res.message ?? 'Không tải được OEE waterfall');
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
  }, [machineId, queryStart, queryEnd, rangeKey, enabled, tick]);

  return {
    data,
    loading,
    error,
    refetch: () => setTick((t) => t + 1),
  };
}

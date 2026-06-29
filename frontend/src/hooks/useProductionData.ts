// React hooks for fetching production data from API

import { useState, useEffect, useMemo } from 'react';
import { apiClient } from '../services/api';
import { effectiveProducedLengthOkM } from '../utils/effectiveProducedLength';
import { getFleetPollIntervalMs, parseMachineDetailPollBaseMs } from '../utils/poll-config';
import type {
  GlobalKPI,
  ProductionAreaSummary,
  Machine,
  MachineDetail,
  ProductionOrder,
  ProductionArea,
} from '../types';
import { machineDetailCoreChanged } from '../utils/machine-detail-snapshot';

/** Meaningful row diff for fleet cards (order-independent compare uses this). */
function machineFleetRowChanged(a: Machine, b: Machine): boolean {
  return (
    a.status !== b.status ||
    (a.productName || '') !== (b.productName || '') ||
    (a.productionOrderProductName || '') !== (b.productionOrderProductName || '') ||
    Math.abs((a.lineSpeed || 0) - (b.lineSpeed || 0)) > 0.1 ||
    Math.abs(effectiveProducedLengthOkM(a) - effectiveProducedLengthOkM(b)) > 0.1 ||
    Math.abs((a.current || 0) - (b.current || 0)) > 0.1 ||
    Math.abs((a.power || 0) - (b.power || 0)) > 0.1 ||
    Math.abs((a.energyMeterKwh ?? 0) - (b.energyMeterKwh ?? 0)) > 0.01 ||
    Math.abs((a.temperature || 0) - (b.temperature || 0)) > 0.1 ||
    Math.abs((a.oee || 0) - (b.oee || 0)) > 0.1
  );
}

function isMachineFleetDataChanged(prev: Machine[], next: Machine[]): boolean {
  if (prev.length !== next.length) return true;
  const nextById = new Map(next.map((m) => [m.id, m]));
  if (nextById.size !== next.length) return true;
  for (const p of prev) {
    const n = nextById.get(p.id);
    if (!n) return true;
    if (machineFleetRowChanged(p, n)) return true;
  }
  for (const n of next) {
    if (!prev.some((p) => p.id === n.id)) return true;
  }
  return false;
}

function productionAreaSummaryChanged(a: ProductionAreaSummary, b: ProductionAreaSummary): boolean {
  return (
    a.running !== b.running ||
    a.total !== b.total ||
    a.output !== b.output ||
    Math.abs((a.speedAvg || 0) - (b.speedAvg || 0)) > 0.1 ||
    a.alarms !== b.alarms
  );
}

function isProductionAreasDataChanged(
  prev: ProductionAreaSummary[],
  next: ProductionAreaSummary[]
): boolean {
  if (prev.length !== next.length) return true;
  const nextById = new Map(next.map((a) => [a.id, a]));
  for (const p of prev) {
    const n = nextById.get(p.id);
    if (!n) return true;
    if (productionAreaSummaryChanged(p, n)) return true;
  }
  for (const n of next) {
    if (!prev.some((p) => p.id === n.id)) return true;
  }
  return false;
}

// Hook for global KPIs
export function useGlobalKPIs() {
  const [kpis, setKpis] = useState<GlobalKPI | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    let isInitialLoad = true;
    
    const fetchKPIs = async () => {
      try {
        // Only show loading on initial load, not on polling
        if (isInitialLoad) {
          setLoading(true);
          isInitialLoad = false;
        }
        const response = await apiClient.getGlobalKPIs();
        if (mounted) {
          if (response.success && response.data) {
            // Only update if data actually changed (deep comparison)
            setKpis((prevKpis) => {
              if (!prevKpis) {
                return response.data; // First load
              }
              
              // Deep comparison of key fields
              const changed = 
                prevKpis.running !== response.data.running ||
                prevKpis.total !== response.data.total ||
                prevKpis.output !== response.data.output ||
                prevKpis.orders !== response.data.orders ||
                prevKpis.alarms !== response.data.alarms ||
                Math.abs((prevKpis.energy || 0) - (response.data.energy || 0)) > 0.01;
              
              if (changed) {
                console.log('🔄 KPIs changed:', response.data);
                return response.data;
              }
              return prevKpis; // No change, return previous state (prevents re-render)
            });
            setError(null);
          } else {
            setError(response.message || 'Failed to fetch KPIs');
          }
        }
      } catch (err) {
        if (mounted) {
          setError(err instanceof Error ? err.message : 'Unknown error');
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    // Initial fetch
    fetchKPIs();

    const pollInterval = setInterval(() => {
      if (mounted && typeof document !== 'undefined' && !document.hidden) {
        fetchKPIs();
      }
    }, 1000);

    // Subscribe to real-time updates (if available)
    const unsubscribe = apiClient.subscribeToGlobalUpdates((data) => {
      if (mounted) {
        setKpis(data.kpis);
      }
    });

    return () => {
      mounted = false;
      clearInterval(pollInterval);
      unsubscribe();
    };
  }, []);

  return { kpis, loading, error };
}

// Hook for production areas
export function useProductionAreas() {
  const [areas, setAreas] = useState<ProductionAreaSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    let isInitialLoad = true;
    
    const fetchAreas = async () => {
      try {
        // Only show loading on initial load, not on polling
        if (isInitialLoad) {
          setLoading(true);
          isInitialLoad = false;
        }
        const response = await apiClient.getProductionAreas();
        if (mounted) {
          if (response.success && response.data) {
            // Only update if data actually changed
            setAreas((prevAreas) => {
              if (!prevAreas || prevAreas.length === 0) {
                return response.data; // First load
              }

              if (isProductionAreasDataChanged(prevAreas, response.data)) {
                if (import.meta.env.DEV) {
                  console.log('🔄 Areas changed');
                }
                return response.data;
              }
              return prevAreas; // No change, return previous state (prevents re-render)
            });
            setError(null);
          } else {
            setError(response.message || 'Failed to fetch areas');
          }
        }
      } catch (err) {
        if (mounted) {
          setError(err instanceof Error ? err.message : 'Unknown error');
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    // Initial fetch
    fetchAreas();

    const pollInterval = setInterval(() => {
      if (mounted && typeof document !== 'undefined' && !document.hidden) {
        fetchAreas();
      }
    }, 1000);

    // Subscribe to real-time updates (if available)
    const unsubscribe = apiClient.subscribeToGlobalUpdates((data) => {
      if (mounted) {
        setAreas(data.areas);
      }
    });

    return () => {
      mounted = false;
      clearInterval(pollInterval);
      unsubscribe();
    };
  }, []);

  return { areas, loading, error };
}

// Hook for all machines
export function useMachines(
  areaId?: string,
  options?: { activeTab?: string; machineDetailOpen?: boolean }
) {
  const [machines, setMachines] = useState<Machine[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const pollMs = getFleetPollIntervalMs(options?.activeTab, {
    machineDetailOpen: options?.machineDetailOpen,
  });

  const machineIdsKey = useMemo(
    () =>
      [...machines.map((m) => m.id).filter(Boolean)].sort().join('|'),
    [machines]
  );

  useEffect(() => {
    let mounted = true;
    let isInitialLoad = true;

    const fetchMachines = async () => {
      if (typeof document !== 'undefined' && document.hidden) return;
      try {
        if (isInitialLoad) {
          setLoading(true);
          isInitialLoad = false;
        }
        const response = areaId
          ? await apiClient.getMachinesByArea(areaId as ProductionArea)
          : await apiClient.getAllMachines();

        if (import.meta.env.DEV) {
          console.log(`🔍 useMachines response:`, {
            success: response.success,
            hasData: !!response.data,
            dataLength: Array.isArray(response.data) ? response.data.length : 'N/A',
          });
        }

        if (mounted) {
          if (response.success && response.data) {
            const machinesData = Array.isArray(response.data) ? response.data : [];
            setMachines((prevMachines) => {
              if (!prevMachines || prevMachines.length === 0) {
                return machinesData;
              }

              if (isMachineFleetDataChanged(prevMachines, machinesData)) {
                return machinesData;
              }
              return prevMachines;
            });
            setError(null);
          } else {
            setMachines([]);
            setError(response.message || 'Failed to fetch machines');
          }
        }
      } catch (err) {
        if (mounted) {
          setError(err instanceof Error ? err.message : 'Unknown error');
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    fetchMachines();

    const pollInterval = setInterval(() => {
      if (!mounted) return;
      if (typeof document !== 'undefined' && document.hidden) return;
      fetchMachines();
    }, pollMs);

    return () => {
      mounted = false;
      clearInterval(pollInterval);
    };
  }, [areaId, pollMs]);

  useEffect(() => {
    const ids = machines.map((m) => m.id).filter(Boolean);
    if (ids.length === 0) return;

    const unsubs = ids.map((id) =>
      apiClient.subscribeToMachineUpdates(id, (updated) => {
        setMachines((prev) => {
          const prevRow = prev.find((m) => m.id === updated.id);
          if (!prevRow) return prev;
          const merged = { ...prevRow, ...updated };
          if (!machineFleetRowChanged(prevRow, merged)) return prev;
          return prev.map((m) => (m.id === updated.id ? merged : m));
        });
      })
    );
    return () => {
      unsubs.forEach((u) => u());
    };
  }, [machineIdsKey]);

  return { machines, loading, error };
}

// Hook for machine detail
export function useMachineDetail(machineId: string | null) {
  const [machine, setMachine] = useState<MachineDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!machineId) {
      setMachine(null);
      setLoading(false);
      return;
    }

    let mounted = true;
    let isInitialLoad = true;
    let inFlight = false;

    const fetchMachine = async () => {
      if (inFlight) return;
      inFlight = true;
      try {
        // Only show loading on initial load, not on polling
        if (isInitialLoad) {
          setLoading(true);
          isInitialLoad = false;
        }
        const response = await apiClient.getMachineDetail(machineId);
        if (mounted) {
          if (response.success && response.data) {
            const data = response.data;
            if (data.id !== machineId) {
              if (import.meta.env.DEV) {
                console.warn('[useMachineDetail] Ignoring response: machine id mismatch', {
                  requested: machineId,
                  received: data.id,
                });
              }
              return;
            }
            // Only update if data actually changed
            setMachine((prevMachine) => {
              if (!prevMachine) {
                return data; // First load
              }
              if (machineDetailCoreChanged(prevMachine, data)) {
                return data;
              }
              return prevMachine;
            });
            setError(null);
          } else {
            setError(response.message || 'Failed to fetch machine details');
          }
        }
      } catch (err) {
        if (mounted) {
          setError(err instanceof Error ? err.message : 'Unknown error');
        }
      } finally {
        inFlight = false;
        if (mounted) {
          setLoading(false);
        }
      }
    };

    // Initial fetch
    fetchMachine();

    const detailPollMs = parseMachineDetailPollBaseMs();
    const pollInterval = setInterval(() => {
      if (!mounted) return;
      if (typeof document !== 'undefined' && document.hidden) return;
      fetchMachine();
    }, detailPollMs);

    const unsubscribe = apiClient.subscribeToMachineUpdates(machineId, (updated) => {
      if (!mounted) return;
      if (updated.id !== machineId) return;
      setMachine((prev) => {
        if (!prev || prev.id !== machineId) return prev;
        const merged = { ...prev, ...updated };
        if (!machineDetailCoreChanged(prev, merged)) return prev;
        return merged;
      });
    });

    return () => {
      mounted = false;
      clearInterval(pollInterval);
      unsubscribe();
    };
  }, [machineId]);

  return { machine, loading, error };
}

// Hook for production orders
export function useProductionOrders(machineId?: string) {
  const [orders, setOrders] = useState<ProductionOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    const fetchOrders = async () => {
      try {
        setLoading(true);
        const response = machineId
          ? await apiClient.getMachineOrders(machineId)
          : await apiClient.getProductionOrders();
        if (mounted) {
          if (response.success && response.data) {
            setOrders(response.data);
            setError(null);
          } else {
            setError(response.message || 'Failed to fetch orders');
          }
        }
      } catch (err) {
        if (mounted) {
          setError(err instanceof Error ? err.message : 'Unknown error');
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    fetchOrders();

    return () => {
      mounted = false;
    };
  }, [machineId]);

  return { orders, loading, error };
}


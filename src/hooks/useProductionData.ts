// React hooks for fetching production data from API

import { useState, useEffect } from 'react';
import { apiClient } from '../services/api';
import type {
  GlobalKPI,
  ProductionAreaSummary,
  Machine,
  MachineDetail,
  ProductionOrder,
} from '../types';

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

    // Poll for updates every 1 second
    const pollInterval = setInterval(() => {
      if (mounted) {
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
              
              if (prevAreas.length !== response.data.length) {
                return response.data; // Length changed
              }
              
              // Compare each area's key metrics
              const changed = prevAreas.some((prevArea, index) => {
                const newArea = response.data[index];
                if (!newArea || prevArea.id !== newArea.id) return true;
                
                return (
                  prevArea.running !== newArea.running ||
                  prevArea.total !== newArea.total ||
                  prevArea.output !== newArea.output ||
                  Math.abs((prevArea.avgSpeed || 0) - (newArea.avgSpeed || 0)) > 0.1 ||
                  prevArea.alarms !== newArea.alarms
                );
              });
              
              if (changed) {
                console.log('🔄 Areas changed');
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

    // Poll for updates every 1 second
    const pollInterval = setInterval(() => {
      if (mounted) {
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
export function useMachines(areaId?: string) {
  const [machines, setMachines] = useState<Machine[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    let isInitialLoad = true;
    
    const fetchMachines = async () => {
      try {
        // Only show loading on initial load, not on polling
        if (isInitialLoad) {
          setLoading(true);
          isInitialLoad = false;
        }
        const response = areaId
          ? await apiClient.getMachinesByArea(areaId as any)
          : await apiClient.getAllMachines();
        if (mounted) {
          if (response.success && response.data) {
            // Ensure data is an array
            const machinesData = Array.isArray(response.data) ? response.data : [];
            
            // Only update if data actually changed (efficient comparison)
            setMachines((prevMachines) => {
              if (!prevMachines || prevMachines.length === 0) {
                return machinesData; // First load
              }
              
              if (prevMachines.length !== machinesData.length) {
                console.log('🔄 Machines count changed:', machinesData.length);
                return machinesData;
              }
              
              // Compare each machine's key fields (more efficient than JSON.stringify)
              const changed = prevMachines.some((prevMachine, index) => {
                const newMachine = machinesData[index];
                if (!newMachine || prevMachine.id !== newMachine.id) return true;
                
                // Only check fields that matter for display
                return (
                  prevMachine.status !== newMachine.status ||
                  Math.abs((prevMachine.lineSpeed || 0) - (newMachine.lineSpeed || 0)) > 0.1 ||
                  Math.abs((prevMachine.producedLength || 0) - (newMachine.producedLength || 0)) > 0.1 ||
                  Math.abs((prevMachine.current || 0) - (newMachine.current || 0)) > 0.1 ||
                  Math.abs((prevMachine.power || 0) - (newMachine.power || 0)) > 0.1 ||
                  Math.abs((prevMachine.temperature || 0) - (newMachine.temperature || 0)) > 0.1 ||
                  Math.abs((prevMachine.oee || 0) - (newMachine.oee || 0)) > 0.1
                );
              });
              
              if (changed) {
                console.log('🔄 Machines changed:', new Date().toLocaleTimeString(), machinesData.length, 'machines');
                return machinesData;
              }
              // No change, return previous state (prevents re-render)
              return prevMachines;
            });
            setError(null);
          } else {
            console.error('❌ Failed to fetch machines:', response.message);
            setMachines([]); // Set empty array instead of undefined
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

    // Initial fetch
    fetchMachines();

    // Poll for updates every 1 second with change detection
    const pollInterval = setInterval(() => {
      if (mounted) {
        fetchMachines();
      }
    }, 1000);

    // Subscribe to real-time updates for each machine
    const unsubscribes: (() => void)[] = [];
    
    // Re-subscribe when machines change
    const subscribeToUpdates = () => {
      // Clean up existing subscriptions
      unsubscribes.forEach((unsub) => unsub());
      unsubscribes.length = 0;
      
      // Subscribe to each machine
      machines.forEach((machine) => {
        const unsubscribe = apiClient.subscribeToMachineUpdates(machine.id, (updated) => {
          if (mounted) {
            setMachines((prev) =>
              prev.map((m) => (m.id === updated.id ? updated : m))
            );
          }
        });
        unsubscribes.push(unsubscribe);
      });
    };

    // Initial subscription after first load
    if (machines.length > 0) {
      subscribeToUpdates();
    }

    return () => {
      mounted = false;
      clearInterval(pollInterval);
      unsubscribes.forEach((unsub) => unsub());
    };
  }, [areaId]);

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
    
    const fetchMachine = async () => {
      try {
        // Only show loading on initial load, not on polling
        if (isInitialLoad) {
          setLoading(true);
          isInitialLoad = false;
        }
        const response = await apiClient.getMachineDetail(machineId);
        if (mounted) {
          if (response.success && response.data) {
            // Only update if data actually changed
            setMachine((prevMachine) => {
              if (!prevMachine) {
                return response.data; // First load
              }
              
              // Compare key fields that matter
              const changed = 
                prevMachine.status !== response.data.status ||
                Math.abs((prevMachine.lineSpeed || 0) - (response.data.lineSpeed || 0)) > 0.1 ||
                Math.abs((prevMachine.producedLength || 0) - (response.data.producedLength || 0)) > 0.1 ||
                Math.abs((prevMachine.current || 0) - (response.data.current || 0)) > 0.1 ||
                Math.abs((prevMachine.power || 0) - (response.data.power || 0)) > 0.1 ||
                Math.abs((prevMachine.temperature || 0) - (response.data.temperature || 0)) > 0.1 ||
                Math.abs((prevMachine.oee || 0) - (response.data.oee || 0)) > 0.1;
              
              if (changed) {
                return response.data;
              }
              return prevMachine; // No change, return previous state (prevents re-render)
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
        if (mounted) {
          setLoading(false);
        }
      }
    };

    // Initial fetch
    fetchMachine();

    // Poll for updates every 1 second with change detection
    const pollInterval = setInterval(() => {
      if (mounted) {
        fetchMachine();
      }
    }, 1000);

    // Subscribe to real-time updates
    const unsubscribe = apiClient.subscribeToMachineUpdates(machineId, (updated) => {
      if (mounted && machine) {
        setMachine((prev) => (prev ? { ...prev, ...updated } : null));
      }
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


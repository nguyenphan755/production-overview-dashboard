// Hook to track real-time trends for machines
import { useState, useEffect, useRef } from 'react';
import type { Machine } from '../types';

interface TrendData {
  temperature: number[];
  speed: number[];
  current: number[];
  power: number[];
  multiZoneTemp: {
    zone1: number[];
    zone2: number[];
    zone3: number[];
    zone4: number[];
  };
}

interface MachineTrends {
  [machineId: string]: TrendData;
}

const MAX_TREND_POINTS = 20; // Keep last 20 data points

export function useMachineTrends(machines: Machine[]) {
  const [trends, setTrends] = useState<MachineTrends>({});
  const prevMachinesRef = useRef<Machine[]>([]);

  useEffect(() => {
    machines.forEach((machine) => {
      const prevMachine = prevMachinesRef.current.find((m) => m.id === machine.id);

      // Initialize trend data for new machines
      setTrends((prev) => {
        if (prev[machine.id]) {
          // Machine exists, check if we need to update
          if (prevMachine) {
            const hasChanged =
              Math.abs((prevMachine.temperature || 0) - (machine.temperature || 0)) > 0.1 ||
              Math.abs((prevMachine.lineSpeed || 0) - (machine.lineSpeed || 0)) > 0.1 ||
              Math.abs((prevMachine.current || 0) - (machine.current || 0)) > 0.1 ||
              Math.abs((prevMachine.power || 0) - (machine.power || 0)) > 0.1 ||
              Math.abs((prevMachine.multiZoneTemperatures?.zone1 || 0) - (machine.multiZoneTemperatures?.zone1 || 0)) > 0.1 ||
              Math.abs((prevMachine.multiZoneTemperatures?.zone2 || 0) - (machine.multiZoneTemperatures?.zone2 || 0)) > 0.1 ||
              Math.abs((prevMachine.multiZoneTemperatures?.zone3 || 0) - (machine.multiZoneTemperatures?.zone3 || 0)) > 0.1 ||
              Math.abs((prevMachine.multiZoneTemperatures?.zone4 || 0) - (machine.multiZoneTemperatures?.zone4 || 0)) > 0.1;

            if (!hasChanged) {
              return prev; // No change, return previous state
            }

            // Update trends with new values
            const currentTrends = prev[machine.id];
            const updateTrend = (arr: number[], newValue: number | undefined) => {
              if (newValue === undefined) return arr;
              const updated = [...arr, newValue];
              return updated.slice(-MAX_TREND_POINTS); // Keep last N points
            };

            return {
              ...prev,
              [machine.id]: {
                temperature: updateTrend(currentTrends.temperature, machine.temperature),
                speed: updateTrend(currentTrends.speed, machine.lineSpeed),
                current: updateTrend(currentTrends.current, machine.current),
                power: updateTrend(currentTrends.power, machine.power),
                multiZoneTemp: {
                  zone1: updateTrend(currentTrends.multiZoneTemp.zone1, machine.multiZoneTemperatures?.zone1),
                  zone2: updateTrend(currentTrends.multiZoneTemp.zone2, machine.multiZoneTemperatures?.zone2),
                  zone3: updateTrend(currentTrends.multiZoneTemp.zone3, machine.multiZoneTemperatures?.zone3),
                  zone4: updateTrend(currentTrends.multiZoneTemp.zone4, machine.multiZoneTemperatures?.zone4),
                },
              },
            };
          }
          return prev; // No previous machine, keep current
        }

        // New machine - initialize
        return {
          ...prev,
          [machine.id]: {
            temperature: machine.temperature ? [machine.temperature] : [],
            speed: machine.lineSpeed ? [machine.lineSpeed] : [],
            current: machine.current ? [machine.current] : [],
            power: machine.power ? [machine.power] : [],
            multiZoneTemp: {
              zone1: machine.multiZoneTemperatures?.zone1 ? [machine.multiZoneTemperatures.zone1] : [],
              zone2: machine.multiZoneTemperatures?.zone2 ? [machine.multiZoneTemperatures.zone2] : [],
              zone3: machine.multiZoneTemperatures?.zone3 ? [machine.multiZoneTemperatures.zone3] : [],
              zone4: machine.multiZoneTemperatures?.zone4 ? [machine.multiZoneTemperatures.zone4] : [],
            },
          },
        };
      });
    });

    prevMachinesRef.current = machines;
  }, [machines]);

  return trends;
}


// Hook to track and update real-time trends for machine detail view
import { useState, useEffect, useRef } from 'react';
import type { MachineDetail } from '../types';

interface TrendPoint {
  time: string;
  [key: string]: string | number;
}

interface MachineDetailTrends {
  temperature: TrendPoint[];
  speed: TrendPoint[];
  current: TrendPoint[];
  power: TrendPoint[];
  multiZoneTemp: TrendPoint[];
  energy: TrendPoint[];
}

const MAX_TREND_POINTS = 20; // Keep last 20 data points

export function useMachineDetailTrends(machine: MachineDetail | null) {
  const [trends, setTrends] = useState<MachineDetailTrends>({
    temperature: [],
    speed: [],
    current: [],
    power: [],
    multiZoneTemp: [],
    energy: [],
  });
  const prevMachineRef = useRef<MachineDetail | null>(null);

  useEffect(() => {
    if (!machine) {
      // Reset trends when machine is null
      setTrends({
        temperature: [],
        speed: [],
        current: [],
        power: [],
        multiZoneTemp: [],
        energy: [],
      });
      prevMachineRef.current = null;
      return;
    }

    const prevMachine = prevMachineRef.current;

    // Initialize trends from backend data if available
    if (!prevMachine) {
      setTrends({
        temperature: machine.temperatureTrend || [],
        speed: machine.speedTrend || [],
        current: machine.currentTrend || [],
        power: machine.powerTrend || [],
        multiZoneTemp: machine.multiZoneTemperatureTrend || [],
        energy: machine.energyConsumption || [],
      });
      prevMachineRef.current = machine;
      return;
    }

    // Check if machine data has changed
    const hasChanged =
      Math.abs((prevMachine.temperature || 0) - (machine.temperature || 0)) > 0.1 ||
      Math.abs((prevMachine.lineSpeed || 0) - (machine.lineSpeed || 0)) > 0.1 ||
      Math.abs((prevMachine.current || 0) - (machine.current || 0)) > 0.1 ||
      Math.abs((prevMachine.power || 0) - (machine.power || 0)) > 0.1 ||
      Math.abs((prevMachine.multiZoneTemperatures?.zone1 || 0) - (machine.multiZoneTemperatures?.zone1 || 0)) > 0.1 ||
      Math.abs((prevMachine.multiZoneTemperatures?.zone2 || 0) - (machine.multiZoneTemperatures?.zone2 || 0)) > 0.1 ||
      Math.abs((prevMachine.multiZoneTemperatures?.zone3 || 0) - (machine.multiZoneTemperatures?.zone3 || 0)) > 0.1 ||
      Math.abs((prevMachine.multiZoneTemperatures?.zone4 || 0) - (machine.multiZoneTemperatures?.zone4 || 0)) > 0.1;

    if (hasChanged) {
      const now = new Date();
      const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

      setTrends((prev) => {
        const updateTrend = (
          arr: TrendPoint[],
          newValue: number | undefined,
          valueKey: string,
          targetValue?: number
        ): TrendPoint[] => {
          if (newValue === undefined) return arr;
          
          const newPoint: TrendPoint = {
            time: timeStr,
            [valueKey]: newValue,
          };
          
          if (targetValue !== undefined) {
            newPoint.target = targetValue;
          }
          
          const updated = [...arr, newPoint];
          return updated.slice(-MAX_TREND_POINTS); // Keep last N points
        };

        // Update temperature trend
        const tempTrend = updateTrend(
          prev.temperature,
          machine.temperature,
          'temp'
        );

        // Update speed trend
        const speedTrend = updateTrend(
          prev.speed,
          machine.lineSpeed,
          'speed',
          machine.targetSpeed
        );

        // Update current trend
        const currentTrend = updateTrend(
          prev.current,
          machine.current,
          'current'
        );

        // Update power trend (with avgPower for reference line)
        const avgPower = machine.power || 68;
        const powerTrendPoints = updateTrend(
          prev.power,
          machine.power,
          'power'
        );
        const powerTrend = powerTrendPoints.map((point) => ({
          ...point,
          avgPower,
          minRange: avgPower - 8,
          maxRange: avgPower + 7,
        }));

        // Update multi-zone temperature trend
        let multiZoneTrend = prev.multiZoneTemp;
        if (
          machine.multiZoneTemperatures?.zone1 !== undefined ||
          machine.multiZoneTemperatures?.zone2 !== undefined ||
          machine.multiZoneTemperatures?.zone3 !== undefined ||
          machine.multiZoneTemperatures?.zone4 !== undefined
        ) {
          const newMultiZonePoint: TrendPoint = {
            time: timeStr,
            zone1: machine.multiZoneTemperatures?.zone1 || 0,
            zone2: machine.multiZoneTemperatures?.zone2 || 0,
            zone3: machine.multiZoneTemperatures?.zone3 || 0,
            zone4: machine.multiZoneTemperatures?.zone4 || 0,
          };
          multiZoneTrend = [...prev.multiZoneTemp, newMultiZonePoint].slice(-MAX_TREND_POINTS);
        }

        // Energy consumption updates less frequently (hourly), so keep existing data
        // but update if backend provides new data
        const energyTrend = machine.energyConsumption && machine.energyConsumption.length > 0
          ? machine.energyConsumption
          : prev.energy;

        return {
          temperature: tempTrend,
          speed: speedTrend,
          current: currentTrend,
          power: powerTrend,
          multiZoneTemp: multiZoneTrend,
          energy: energyTrend,
        };
      });
    }

    // If backend provides new trend data (from database), merge it with real-time data
    if (machine.temperatureTrend && machine.temperatureTrend.length > 0) {
      setTrends((prev) => {
        // Merge backend trends with real-time trends, avoiding duplicates
        const backendTimes = new Set(prev.temperature.map((p) => p.time));
        const newBackendPoints = machine.temperatureTrend!.filter(
          (p) => !backendTimes.has(p.time)
        );
        
        if (newBackendPoints.length > 0) {
          return {
            ...prev,
            temperature: [...prev.temperature, ...newBackendPoints].slice(-MAX_TREND_POINTS),
          };
        }
        return prev;
      });
    }

    prevMachineRef.current = machine;
  }, [machine]);

  return trends;
}


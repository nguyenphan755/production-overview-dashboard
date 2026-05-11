// Hook to track and update real-time trends for machine detail view
import { useState, useEffect, useRef } from 'react';
import type { MachineDetail } from '../types';
import { machineDetailCoreSnapshot } from '../utils/machine-detail-snapshot';

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
  const machineRef = useRef(machine);
  machineRef.current = machine;

  const coreKey = machine ? machineDetailCoreSnapshot(machine) : '';

  useEffect(() => {
    const m = machineRef.current;
    if (!m) {
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
    if (!prevMachine || prevMachine.id !== m.id) {
      setTrends({
        temperature: m.temperatureTrend || [],
        speed: m.speedTrend || [],
        current: m.currentTrend || [],
        power: m.powerTrend || [],
        multiZoneTemp: m.multiZoneTemperatureTrend || [],
        energy: m.energyConsumption || [],
      });
      prevMachineRef.current = m;
      return;
    }

    // Check if machine data has changed (same thresholds as before; effect only runs when coreKey changes)
    const isExtrusionMachine = m.area === 'sheathing';
    const hasChanged =
      Math.abs((prevMachine.temperature || 0) - (m.temperature || 0)) > 0.1 ||
      Math.abs((prevMachine.lineSpeed || 0) - (m.lineSpeed || 0)) > 0.1 ||
      Math.abs((prevMachine.current || 0) - (m.current || 0)) > 0.1 ||
      Math.abs((prevMachine.power || 0) - (m.power || 0)) > 0.1 ||
      Math.abs((prevMachine.multiZoneTemperatures?.zone1 || 0) - (m.multiZoneTemperatures?.zone1 || 0)) > 0.1 ||
      Math.abs((prevMachine.multiZoneTemperatures?.zone2 || 0) - (m.multiZoneTemperatures?.zone2 || 0)) > 0.1 ||
      Math.abs((prevMachine.multiZoneTemperatures?.zone3 || 0) - (m.multiZoneTemperatures?.zone3 || 0)) > 0.1 ||
      Math.abs((prevMachine.multiZoneTemperatures?.zone4 || 0) - (m.multiZoneTemperatures?.zone4 || 0)) > 0.1 ||
      (isExtrusionMachine && (
        Math.abs((prevMachine.multiZoneTemperatures?.zone5 || 0) - (m.multiZoneTemperatures?.zone5 || 0)) > 0.1 ||
        Math.abs((prevMachine.multiZoneTemperatures?.zone6 || 0) - (m.multiZoneTemperatures?.zone6 || 0)) > 0.1 ||
        Math.abs((prevMachine.multiZoneTemperatures?.zone7 || 0) - (m.multiZoneTemperatures?.zone7 || 0)) > 0.1 ||
        Math.abs((prevMachine.multiZoneTemperatures?.zone8 || 0) - (m.multiZoneTemperatures?.zone8 || 0)) > 0.1 ||
        Math.abs((prevMachine.multiZoneTemperatures?.zone9 || 0) - (m.multiZoneTemperatures?.zone9 || 0)) > 0.1 ||
        Math.abs((prevMachine.multiZoneTemperatures?.zone10 || 0) - (m.multiZoneTemperatures?.zone10 || 0)) > 0.1
      ));

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
          m.temperature,
          'temp'
        );

        // Update speed trend
        const speedTrend = updateTrend(
          prev.speed,
          m.lineSpeed,
          'speed',
          m.targetSpeed
        );

        // Update current trend
        const currentTrend = updateTrend(
          prev.current,
          m.current,
          'current'
        );

        // Update power trend (with avgPower for reference line)
        const avgPower = m.power || 68;
        const powerTrendPoints = updateTrend(
          prev.power,
          m.power,
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
        const isExtrusionForZones = m.area === 'sheathing';
        const hasAnyZoneData =
          m.multiZoneTemperatures?.zone1 !== undefined ||
          m.multiZoneTemperatures?.zone2 !== undefined ||
          m.multiZoneTemperatures?.zone3 !== undefined ||
          m.multiZoneTemperatures?.zone4 !== undefined ||
          (isExtrusionForZones && (
            m.multiZoneTemperatures?.zone5 !== undefined ||
            m.multiZoneTemperatures?.zone6 !== undefined ||
            m.multiZoneTemperatures?.zone7 !== undefined ||
            m.multiZoneTemperatures?.zone8 !== undefined ||
            m.multiZoneTemperatures?.zone9 !== undefined ||
            m.multiZoneTemperatures?.zone10 !== undefined
          ));

        if (hasAnyZoneData) {
          const newMultiZonePoint: TrendPoint = {
            time: timeStr,
            zone1: m.multiZoneTemperatures?.zone1 || 0,
            zone2: m.multiZoneTemperatures?.zone2 || 0,
            zone3: m.multiZoneTemperatures?.zone3 || 0,
            zone4: m.multiZoneTemperatures?.zone4 || 0,
          };

          // Add zones 5-10 for extrusion machines
          if (isExtrusionForZones) {
            newMultiZonePoint.zone5 = m.multiZoneTemperatures?.zone5 || 0;
            newMultiZonePoint.zone6 = m.multiZoneTemperatures?.zone6 || 0;
            newMultiZonePoint.zone7 = m.multiZoneTemperatures?.zone7 || 0;
            newMultiZonePoint.zone8 = m.multiZoneTemperatures?.zone8 || 0;
            newMultiZonePoint.zone9 = m.multiZoneTemperatures?.zone9 || 0;
            newMultiZonePoint.zone10 = m.multiZoneTemperatures?.zone10 || 0;
          }
          
          multiZoneTrend = [...prev.multiZoneTemp, newMultiZonePoint].slice(-MAX_TREND_POINTS);
        }

        // Energy consumption updates less frequently (hourly), so keep existing data
        // but update if backend provides new data
        const energyTrend =
          m.energyConsumption && m.energyConsumption.length > 0
            ? m.energyConsumption
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
    if (m.temperatureTrend && m.temperatureTrend.length > 0) {
      setTrends((prev) => {
        // Merge backend trends with real-time trends, avoiding duplicates
        const backendTimes = new Set(prev.temperature.map((p) => p.time));
        const newBackendPoints = m.temperatureTrend!.filter(
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

    prevMachineRef.current = m;
  }, [coreKey, machine?.id]);

  return trends;
}


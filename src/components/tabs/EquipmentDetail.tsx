import { useMemo, useState, useEffect, useRef } from 'react';
import { ArrowLeft, User, Package, Activity, Target, TrendingUp, Gauge, Zap, Thermometer, Circle, Flame, Battery, History, Clock, CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, Tooltip, Area, AreaChart, Legend, ComposedChart, Bar, BarChart, ReferenceLine } from 'recharts';
import { useMachineDetail } from '../../hooks/useProductionData';
import { useMachineDetailTrends } from '../../hooks/useMachineDetailTrends';
import { apiClient } from '../../services/api';

interface EquipmentDetailProps {
  machineId: string;
  onBack: () => void;
}

export function EquipmentDetail({ machineId, onBack }: EquipmentDetailProps) {
  const { machine, loading } = useMachineDetail(machineId);
  const realTimeTrends = useMachineDetailTrends(machine);
  const [statusHistory, setStatusHistory] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const isInitialLoadRef = useRef(true);
  const hasDataRef = useRef(false);

  // Fetch status history for Gantt chart (8-hour shift)
  useEffect(() => {
    if (!machineId) return;
    
    const fetchStatusHistory = async () => {
      // Only show loading state on initial load, not on subsequent updates
      if (isInitialLoadRef.current) {
        setLoadingHistory(true);
      }
      
      try {
        const response = await apiClient.getMachineStatusHistory(machineId, 8);
        if (response.success && response.data) {
          setStatusHistory(response.data);
          hasDataRef.current = true;
        }
      } catch (error) {
        console.error('Error fetching status history:', error);
      } finally {
        if (isInitialLoadRef.current) {
          setLoadingHistory(false);
          isInitialLoadRef.current = false;
        }
      }
    };

    fetchStatusHistory();
    // Refresh every 30 seconds - updates data without showing loading state
    const interval = setInterval(fetchStatusHistory, 30000);
    return () => clearInterval(interval);
  }, [machineId]);

  // ALL HOOKS MUST BE CALLED BEFORE ANY EARLY RETURNS
  // Memoize chart data to prevent unnecessary re-renders
  // Only update when the actual data changes, not on every render
  const tempData = useMemo(() => {
    if (!machine) return [];
    return realTimeTrends.temperature.length > 0 
      ? realTimeTrends.temperature 
      : (machine.temperatureTrend || []);
  }, [realTimeTrends.temperature, machine?.temperatureTrend]);

  const speedData = useMemo(() => {
    if (!machine) return [];
    return realTimeTrends.speed.length > 0 
      ? realTimeTrends.speed 
      : (machine.speedTrend || []);
  }, [realTimeTrends.speed, machine?.speedTrend]);

  const currentData = useMemo(() => {
    if (!machine) return [];
    return realTimeTrends.current.length > 0 
      ? realTimeTrends.current 
      : (machine.currentTrend || []);
  }, [realTimeTrends.current, machine?.currentTrend]);

  const multiZoneTempData = useMemo(() => {
    if (!machine) return [];
    return realTimeTrends.multiZoneTemp.length > 0 
      ? realTimeTrends.multiZoneTemp 
      : (machine.multiZoneTemperatureTrend || []);
  }, [realTimeTrends.multiZoneTemp, machine?.multiZoneTemperatureTrend]);

  const powerData = useMemo(() => {
    if (!machine) return [];
    return realTimeTrends.power.length > 0 
      ? realTimeTrends.power 
      : (machine.powerTrend || []);
  }, [realTimeTrends.power, machine?.powerTrend]);

  const energyData = useMemo(() => {
    if (!machine) return [];
    
    // Get raw energy data
    const rawData = realTimeTrends.energy.length > 0 
      ? realTimeTrends.energy 
      : (machine.energyConsumption || []);
    
    // Transform data to ensure it has hour and energy keys, and limit to 8 hours
    const now = new Date();
    const eightHoursAgo = new Date(now.getTime() - 8 * 60 * 60 * 1000);
    
    // If we have data, process it
    if (rawData && rawData.length > 0) {
      // Transform to hourly format if needed
      const processedData = rawData.map((item: any, index: number) => {
        if (typeof item === 'object' && item !== null) {
          // If it already has hour and energy, use it
          if (item.hour !== undefined && item.energy !== undefined) {
            return item;
          }
          // Otherwise, try to extract energy value
          const energy = item.energy || item.value || item || 0;
          const hour = item.hour || item.time || index;
          return { hour, energy: typeof energy === 'number' ? energy : parseFloat(energy) || 0 };
        } else {
          // If it's a number, use it as energy value
          return { hour: index, energy: typeof item === 'number' ? item : parseFloat(item) || 0 };
        }
      });
      
      // Take last 8 hours
      return processedData.slice(-8).map((item: any, index: number) => {
        const hourTime = new Date(eightHoursAgo.getTime() + index * 60 * 60 * 1000);
        return {
          hour: hourTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
          energy: item.energy || 0
        };
      });
    }
    
    // If no data, generate 8 hours of zero/placeholder data
    return Array.from({ length: 8 }, (_, index) => {
      const hourTime = new Date(eightHoursAgo.getTime() + index * 60 * 60 * 1000);
      return {
        hour: hourTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
        energy: 0
      };
    });
  }, [realTimeTrends.energy, machine?.energyConsumption]);

  // Helper function to calculate dynamic Y-axis domain with ±30% margin
  const calculateDomain = (currentValue: number, minValue?: number, maxValue?: number): [number, number] => {
    if (!currentValue || currentValue <= 0) {
      // Fallback to default ranges if no current value
      return minValue !== undefined && maxValue !== undefined 
        ? [minValue, maxValue]
        : [0, 100];
    }
    
    // Calculate ±30% margin
    const margin = currentValue * 0.3;
    const min = Math.max(0, currentValue - margin);
    const max = currentValue + margin;
    
    // Apply optional min/max constraints
    const finalMin = minValue !== undefined ? Math.max(min, minValue) : min;
    const finalMax = maxValue !== undefined ? Math.min(max, maxValue) : max;
    
    return [finalMin, finalMax];
  };

  // Calculate dynamic domains for each chart (must be before early return)
  const temperatureDomain = useMemo(() => {
    if (!machine) return [0, 100];
    const currentTemp = machine.temperature || 0;
    return calculateDomain(currentTemp, 0, 200); // Max 200°C for safety
  }, [machine?.temperature]);

  const speedDomain = useMemo(() => {
    if (!machine) return [0, 100];
    const isDrawing = machine.area === 'drawing';
    const currentSpeed = machine.lineSpeed || 0;
    // For drawing machines (m/s), use different base range
    if (isDrawing) {
      return calculateDomain(currentSpeed, 0, 50); // Max 50 m/s for drawing
    } else {
      return calculateDomain(currentSpeed, 0, 2000); // Max 2000 m/min for others
    }
  }, [machine?.lineSpeed, machine?.area]);

  const currentDomain = useMemo(() => {
    if (!machine) return [0, 100];
    const currentCurrent = machine.current || 0;
    return calculateDomain(currentCurrent, 0, 100); // Max 100A for safety
  }, [machine?.current]);

  const multiZoneTempDomain = useMemo(() => {
    if (!machine) return [0, 300];
    // Use the highest zone temperature for domain calculation
    const zones = machine.multiZoneTemperatures;
    const isExtrusionMachine = machine.area === 'sheathing';
    
    let maxZoneTemp = 0;
    if (zones) {
      const zoneValues = [
        zones.zone1 || 0,
        zones.zone2 || 0,
        zones.zone3 || 0,
        zones.zone4 || 0,
      ];
      
      // Add zones 5-10 for extrusion machines
      if (isExtrusionMachine) {
        zoneValues.push(
          zones.zone5 || 0,
          zones.zone6 || 0,
          zones.zone7 || 0,
          zones.zone8 || 0,
          zones.zone9 || 0,
          zones.zone10 || 0
        );
      }
      
      maxZoneTemp = Math.max(...zoneValues);
    }
    
    return calculateDomain(maxZoneTemp || 150, 0, 300); // Max 300°C for safety
  }, [machine?.multiZoneTemperatures, machine?.area]);

  // Early return AFTER all hooks
  if (loading || !machine) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-white/60">Loading machine details...</div>
      </div>
    );
  }

  // Extract data from machine
  const machineInfo = {
    id: machine.id,
    name: machine.name,
    status: machine.status,
    operator: machine.operatorName || 'N/A',
    currentOrder: machine.productionOrderId || 'N/A',
    productName: machine.productionOrder?.productName || 'N/A',
    customer: machine.productionOrder?.customer || 'N/A'
  };

  // Check if this is a Drawing machine (uses m/s instead of m/min)
  const isDrawingMachine = machine.area === 'drawing';
  
  // Production metrics
  const currentLength = machine.producedLength || 0;
  const targetLength = machine.targetLength || 0;
  
  // Backend sends m/s for Drawing machines, m/min for others
  const currentSpeedRaw = machine.lineSpeed || 0;
  const targetSpeedRaw = machine.targetSpeed || 0;
  
  // Convert to consistent units (m/s) for calculations
  // For drawing: speed is already in m/s from backend
  // For others: speed is in m/min, convert to m/s for calculations
  const currentSpeedMps = isDrawingMachine 
    ? currentSpeedRaw  // Already in m/s from backend
    : currentSpeedRaw / 60;  // Convert m/min to m/s
  
  const targetSpeedMps = isDrawingMachine
    ? targetSpeedRaw  // Already in m/s from backend
    : targetSpeedRaw / 60;  // Convert m/min to m/s
  
  // For display: show in original units (backend already converted drawing to m/s)
  const currentSpeedDisplay = currentSpeedRaw;
  const targetSpeedDisplay = targetSpeedRaw;
  const speedUnit = isDrawingMachine ? 'm/s' : 'm/min';
  
  // Calculate runtime (hours since order started)
  const runtime = machine.productionOrder?.startTime 
    ? (Date.now() - new Date(machine.productionOrder.startTime).getTime()) / 3600000 
    : 0;
  
  // Calculate average speed based on actual production
  // Average speed = total length produced / runtime
  // For drawing: result in m/s (runtime in hours, so divide by 3600)
  // For others: result in m/min (runtime in hours, so divide by 60)
  const avgSpeed = runtime > 0 && currentLength > 0
    ? isDrawingMachine
      ? (currentLength / (runtime * 3600))  // m/s: divide by seconds
      : (currentLength / (runtime * 60))    // m/min: divide by minutes
    : currentSpeedDisplay; // Fallback to current speed if no runtime data
  
  // Calculate remaining length
  const remainingLength = Math.max(0, targetLength - currentLength);
  
  // Calculate remaining production time based on current speed
  // Remaining time = remaining length / current speed
  // Speed is in m/s, so result is in seconds
  const remainingTimeSeconds = currentSpeedMps > 0 && remainingLength > 0
    ? remainingLength / currentSpeedMps
    : 0;
  
  // Convert remaining time to hours and minutes
  const remainingTimeMinutes = remainingTimeSeconds / 60;
  const remainingTimeHours = Math.floor(remainingTimeMinutes / 60);
  const remainingTimeMins = Math.floor(remainingTimeMinutes % 60);
  const remainingTimeFormatted = remainingTimeHours > 0
    ? `${remainingTimeHours}h ${remainingTimeMins}m`
    : remainingTimeMins > 0
    ? `${remainingTimeMins}m`
    : '0m';
  
  // Calculate estimated completion time
  const estimatedCompletionTime = remainingTimeSeconds > 0
    ? new Date(Date.now() + remainingTimeSeconds * 1000)
    : null;
  const estimatedCompletionFormatted = estimatedCompletionTime
    ? estimatedCompletionTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
    : 'N/A';

  const productionData = {
    currentLength,
    targetLength,
    speed: currentSpeedDisplay,
    targetSpeed: targetSpeedDisplay,
    speedUnit,
    runtime,
    avgSpeed,
    remainingLength,
    remainingTime: remainingTimeFormatted,
    remainingTimeMinutes,
    estimatedCompletion: estimatedCompletionFormatted
  };

  // OEE metrics
  const oeeMetrics = {
    availability: machine.availability || 0,
    performance: machine.performance || 0,
    quality: machine.quality || 0,
    oee: machine.oee || 0
  };

  const getOEEColor = (value: number) => {
    if (value >= 85) return '#22C55E';
    if (value >= 75) return '#F59E0B';
    return '#EF4444';
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'running': return '#22C55E';
      case 'idle': return '#64748B';
      case 'warning': return '#F59E0B';
      case 'error': return '#EF4444';
      case 'stopped': return '#34E7F8';
      case 'setup': return '#FFB86C';
      default: return '#64748B';
    }
  };

  const statusColor = getStatusColor(machine.status);
  const progressPercentage = productionData.targetLength > 0 
    ? (productionData.currentLength / productionData.targetLength) * 100 
    : 0;
  const speedPercentage = productionData.targetSpeed > 0 
    ? (productionData.speed / productionData.targetSpeed) * 100 
    : 0;

  // Production order history
  const orderHistory = machine.orderHistory || [];

  const getOrderStatusColor = (status: string) => {
    switch (status) {
      case 'running': return '#22C55E';
      case 'completed': return '#4FFFBC';
      case 'interrupted': return '#F59E0B';
      default: return '#64748B';
    }
  };

  const getOrderStatusIcon = (status: string) => {
    switch (status) {
      case 'running': return Activity;
      case 'completed': return CheckCircle;
      case 'interrupted': return AlertCircle;
      default: return Circle;
    }
  };

  return (
    <div>
      {/* Combined Top Section: Machine Name, Operator, and Current Production Order */}
      <div className="mb-4 rounded-xl bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-xl border border-white/20 shadow-2xl p-4">
        <div className="flex items-start gap-6 flex-wrap">
          {/* Left Section: Machine Name and Operator */}
          <div className="flex items-start gap-6 flex-1 min-w-0">
            {/* Machine Name */}
            <div className="flex items-center gap-3 flex-shrink-0">
              <button
                onClick={onBack}
                className="p-2 rounded-lg bg-white/10 hover:bg-white/20 border border-white/20 transition-all group flex-shrink-0"
              >
                <ArrowLeft className="w-5 h-5 text-white group-hover:text-[#34E7F8]" strokeWidth={2.5} />
              </button>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl lg:text-3xl text-white font-bold tracking-tight">{machineInfo.name}</h1>
                <span className="text-base lg:text-lg text-white/60">({machineInfo.id})</span>
                <div 
                  className="px-3 py-1 rounded-md tracking-wider border text-sm whitespace-nowrap"
                  style={{
                    backgroundColor: `${statusColor}20`,
                    borderColor: `${statusColor}40`,
                    color: statusColor
                  }}
                >
                  {machine.status.toUpperCase()}
                </div>
              </div>
            </div>

            {/* Operator */}
            <div className="flex items-start gap-2 flex-shrink-0">
              <User className="w-5 h-5 text-[#34E7F8] mt-1" />
              <div className="flex flex-col">
                <div className="text-white/60 text-xs">Operator:</div>
                <span className="text-lg lg:text-xl text-white font-semibold">{machineInfo.operator}</span>
              </div>
            </div>
          </div>

          {/* Middle Divider */}
          <div className="h-12 w-px bg-white/20 flex-shrink-0"></div>

          {/* Right Section: Current Production Order */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2">
              <Package className="w-4 h-4 text-[#34E7F8]" strokeWidth={2.5} />
              <h2 className="text-sm lg:text-base text-white font-medium">Current Production Order</h2>
            </div>
            <div className="grid grid-cols-3 gap-2 lg:gap-4">
              <div className="min-w-0">
                <div className="text-white/60 text-xs mb-0.5">ORDER ID</div>
                <div className="text-sm lg:text-base text-white tracking-tight truncate">{machineInfo.currentOrder || 'N/A'}</div>
              </div>
              <div className="min-w-0">
                <div className="text-white/60 text-xs mb-0.5">PRODUCT</div>
                <div className="text-sm lg:text-base text-white tracking-tight truncate">{machineInfo.productName || 'N/A'}</div>
              </div>
              <div className="min-w-0">
                <div className="text-white/60 text-xs mb-0.5">EST. COMPLETION</div>
                <div className="text-sm lg:text-base text-[#4FFFBC] tracking-tight truncate">{productionData.estimatedCompletion}</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Gantt Chart: Operational States */}
      <div className="mb-4 rounded-xl bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-xl border border-white/20 shadow-2xl p-4">
        <div className="flex items-center gap-2 mb-4">
          <Activity className="w-5 h-5 text-[#34E7F8]" strokeWidth={2.5} />
          <h2 className="text-xl text-white">Operational States - Last 8 Hours (Shift)</h2>
        </div>
        
        {/* Keep Gantt chart mounted to prevent flicker - only show loading on initial load */}
        {loadingHistory && !hasDataRef.current ? (
          <div className="flex items-center justify-center h-32 text-white/60">
            Loading status history...
          </div>
        ) : statusHistory.length === 0 && !hasDataRef.current ? (
          <div className="flex items-center justify-center h-32 text-white/60">
            No status history available
          </div>
        ) : (
          <GanttChart data={statusHistory.length > 0 ? statusHistory : []} />
        )}
      </div>

      {/* Production Metrics */}
      <div className="mb-4 grid grid-cols-2 gap-3">
        {/* Production Length */}
        <div className="rounded-xl bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-xl border border-white/20 shadow-2xl p-3">
          <div className="flex items-center gap-2 mb-2">
            <Activity className="w-4 h-4 text-[#34E7F8]" strokeWidth={2.5} />
            <h3 className="text-base text-white">Production Length</h3>
          </div>
          <div className="flex items-baseline gap-2 mb-2">
            <span className="text-2xl text-[#34E7F8] tracking-tight">{productionData.currentLength.toLocaleString()}</span>
            <span className="text-base text-white/40">/ {productionData.targetLength.toLocaleString()}</span>
            <span className="text-sm text-white/60">meters</span>
          </div>
          <div className="mb-2">
            <div className="flex justify-between items-center mb-1">
              <span className="text-white/60 text-xs">Progress</span>
              <span className="text-base text-white">{progressPercentage.toFixed(1)}%</span>
            </div>
            <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
              <div 
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${progressPercentage}%`,
                  backgroundColor: '#34E7F8'
                }}
              />
            </div>
          </div>
          <div className="pt-2 border-t border-white/10 grid grid-cols-2 gap-2">
            <div>
              <div className="text-white/60 text-xs mb-0.5">RUNTIME</div>
              <div className="text-base text-white">{productionData.runtime.toFixed(2)}h</div>
            </div>
            <div>
              <div className="text-white/60 text-xs mb-0.5">REMAINING TIME</div>
              <div className="text-base text-[#FFB86C]">{productionData.remainingTime}</div>
            </div>
          </div>
        </div>

        {/* Machine Speed */}
        <div className="rounded-xl bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-xl border border-white/20 shadow-2xl p-3">
          <div className="flex items-center gap-2 mb-2">
            <Gauge className="w-4 h-4 text-[#4FFFBC]" strokeWidth={2.5} />
            <h3 className="text-base text-white">Machine Speed</h3>
          </div>
          <div className="flex items-baseline gap-2 mb-2">
            <span className="text-2xl text-[#4FFFBC] tracking-tight">{productionData.speed.toFixed(2)}</span>
            <span className="text-base text-white/40">/ {productionData.targetSpeed.toFixed(2)}</span>
            <span className="text-sm text-white/60">{productionData.speedUnit}</span>
          </div>
          <div className="mb-2">
            <div className="flex justify-between items-center mb-1">
              <span className="text-white/60 text-xs">Performance</span>
              <span className="text-base text-white">{speedPercentage.toFixed(1)}%</span>
            </div>
            <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
              <div 
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${speedPercentage}%`,
                  backgroundColor: '#4FFFBC'
                }}
              />
            </div>
          </div>
          <div className="pt-2 border-t border-white/10 grid grid-cols-2 gap-2">
            <div>
              <div className="text-white/60 text-xs mb-0.5">AVG SPEED</div>
              <div className="text-base text-white">{productionData.avgSpeed.toFixed(2)} {productionData.speedUnit}</div>
            </div>
            <div>
              <div className="text-white/60 text-xs mb-0.5">EFFICIENCY</div>
              <div className="text-base text-[#4FFFBC]">{speedPercentage.toFixed(1)}%</div>
            </div>
          </div>
        </div>
      </div>

      {/* OEE Metrics */}
      <div className="mb-4 rounded-xl bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-xl border border-white/20 shadow-2xl p-3">
        <div className="flex items-center gap-2 mb-3">
          <Target className="w-4 h-4 text-[#34E7F8]" strokeWidth={2.5} />
          <h3 className="text-base text-white">Overall Equipment Effectiveness (OEE)</h3>
        </div>
        <div className="grid grid-cols-4 gap-3">
          {/* OEE */}
          <div className="p-3 rounded-lg bg-gradient-to-br from-white/8 to-white/3 border border-white/10">
            <div className="text-white/60 text-xs mb-1.5 tracking-wider">OEE</div>
            <div 
              className="text-3xl tracking-tight mb-2"
              style={{ color: getOEEColor(oeeMetrics.oee) }}
            >
              {oeeMetrics.oee}%
            </div>
            <div className="h-1 bg-white/10 rounded-full overflow-hidden">
              <div 
                className="h-full rounded-full"
                style={{
                  width: `${oeeMetrics.oee}%`,
                  backgroundColor: getOEEColor(oeeMetrics.oee)
                }}
              />
            </div>
          </div>

          {/* Availability */}
          <div className="p-3 rounded-lg bg-gradient-to-br from-white/8 to-white/3 border border-white/10">
            <div className="text-white/60 text-xs mb-1.5 tracking-wider">AVAILABILITY</div>
            <div className="text-3xl text-[#4FFFBC] tracking-tight mb-2">{oeeMetrics.availability}%</div>
            <div className="h-1 bg-white/10 rounded-full overflow-hidden">
              <div 
                className="h-full rounded-full bg-[#4FFFBC]"
                style={{ width: `${oeeMetrics.availability}%` }}
              />
            </div>
          </div>

          {/* Performance */}
          <div className="p-3 rounded-lg bg-gradient-to-br from-white/8 to-white/3 border border-white/10">
            <div className="text-white/60 text-xs mb-1.5 tracking-wider">PERFORMANCE</div>
            <div className="text-3xl text-[#FFB86C] tracking-tight mb-2">{oeeMetrics.performance}%</div>
            <div className="h-1 bg-white/10 rounded-full overflow-hidden">
              <div 
                className="h-full rounded-full bg-[#FFB86C]"
                style={{ width: `${oeeMetrics.performance}%` }}
              />
            </div>
          </div>

          {/* Quality */}
          <div className="p-3 rounded-lg bg-gradient-to-br from-white/8 to-white/3 border border-white/10">
            <div className="text-white/60 text-xs mb-1.5 tracking-wider">QUALITY</div>
            <div className="text-3xl text-[#34E7F8] tracking-tight mb-2">{oeeMetrics.quality}%</div>
            <div className="h-1 bg-white/10 rounded-full overflow-hidden">
              <div 
                className="h-full rounded-full bg-[#34E7F8]"
                style={{ width: `${oeeMetrics.quality}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Real-time Charts */}
      <div className="grid grid-cols-3 gap-4">
        {/* Temperature Trend */}
        <div className="rounded-xl bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-xl border border-white/20 shadow-2xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <Thermometer className="w-4 h-4 text-[#FF6B6B]" strokeWidth={2.5} />
            <h3 className="text-base text-white">Temperature Trend</h3>
          </div>
          <div className="mb-3">
            <div className="text-3xl text-[#FF6B6B] tracking-tight">
              {machine.temperature ? `${Math.round(machine.temperature)}°C` : 'N/A'}
            </div>
            <div className="text-white/60 text-xs">Current</div>
          </div>
          <div className="h-40">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart 
                data={tempData}
                isAnimationActive={false}
              >
                <defs>
                  <linearGradient id="tempGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#FF6B6B" stopOpacity={0.4}/>
                    <stop offset="100%" stopColor="#FF6B6B" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <XAxis 
                  dataKey="time" 
                  stroke="#ffffff40" 
                  tick={{ fill: '#ffffff60', fontSize: 11 }}
                />
                <YAxis 
                  stroke="#ffffff40" 
                  tick={{ fill: '#ffffff60', fontSize: 11 }}
                  domain={temperatureDomain}
                  tickFormatter={(value) => value.toFixed(2)}
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: '#0E2F4F', 
                    border: '1px solid rgba(255,255,255,0.2)',
                    borderRadius: '8px',
                    fontSize: '12px'
                  }}
                />
                <Area 
                  type="monotone" 
                  dataKey="temp" 
                  stroke="#FF6B6B" 
                  strokeWidth={3}
                  fill="url(#tempGradient)"
                  isAnimationActive={false}
                  dot={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Speed Trend */}
        <div className="rounded-xl bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-xl border border-white/20 shadow-2xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp className="w-4 h-4 text-[#4FFFBC]" strokeWidth={2.5} />
            <h3 className="text-base text-white">Speed Trend</h3>
          </div>
          <div className="mb-3">
            <div className="text-3xl text-[#4FFFBC] tracking-tight">{productionData.speed.toFixed(2)}</div>
            <div className="text-white/60 text-xs">{productionData.speedUnit}</div>
          </div>
          <div className="h-40">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart 
                data={speedData}
                isAnimationActive={false}
              >
                <XAxis 
                  dataKey="time" 
                  stroke="#ffffff40" 
                  tick={{ fill: '#ffffff60', fontSize: 11 }}
                />
                <YAxis 
                  stroke="#ffffff40" 
                  tick={{ fill: '#ffffff60', fontSize: 11 }}
                  domain={speedDomain}
                  tickFormatter={(value) => value.toFixed(2)}
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: '#0E2F4F', 
                    border: '1px solid rgba(255,255,255,0.2)',
                    borderRadius: '8px',
                    fontSize: '12px'
                  }}
                />
                <Line 
                  type="monotone" 
                  dataKey="target" 
                  stroke="#ffffff40" 
                  strokeWidth={2}
                  strokeDasharray="5 5"
                  dot={false}
                  isAnimationActive={false}
                />
                <Line 
                  type="monotone" 
                  dataKey="speed" 
                  stroke="#4FFFBC" 
                  strokeWidth={3}
                  dot={false}
                  isAnimationActive={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Motor Current Trend */}
        <div className="rounded-xl bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-xl border border-white/20 shadow-2xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <Zap className="w-4 h-4 text-[#FFB86C]" strokeWidth={2.5} />
            <h3 className="text-base text-white">Motor Current</h3>
          </div>
          <div className="mb-3">
            <div className="text-3xl text-[#FFB86C] tracking-tight">
              {machine.current ? `${machine.current.toFixed(1)}A` : 'N/A'}
            </div>
            <div className="text-white/60 text-xs">Current</div>
          </div>
          <div className="h-40">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart 
                data={currentData}
                isAnimationActive={false}
              >
                <defs>
                  <linearGradient id="currentGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#FFB86C" stopOpacity={0.4}/>
                    <stop offset="100%" stopColor="#FFB86C" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <XAxis 
                  dataKey="time" 
                  stroke="#ffffff40" 
                  tick={{ fill: '#ffffff60', fontSize: 11 }}
                />
                <YAxis 
                  stroke="#ffffff40" 
                  tick={{ fill: '#ffffff60', fontSize: 11 }}
                  domain={currentDomain}
                  tickFormatter={(value) => value.toFixed(2)}
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: '#0E2F4F', 
                    border: '1px solid rgba(255,255,255,0.2)',
                    borderRadius: '8px',
                    fontSize: 12
                  }}
                />
                <Area 
                  type="monotone" 
                  dataKey="current" 
                  stroke="#FFB86C" 
                  strokeWidth={3}
                  fill="url(#currentGradient)"
                  isAnimationActive={false}
                  dot={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Advanced Analytics Section */}
      
      {/* Multi-zone Temperature Monitoring */}
      <div className="mt-4 rounded-xl bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-xl border border-white/20 shadow-2xl p-4">
        <div className="flex items-center gap-2 mb-4">
          <Flame className="w-5 h-5 text-[#FF6B6B]" strokeWidth={2.5} />
          <h2 className="text-xl text-white">Multi-Zone Temperature Monitoring</h2>
        </div>
        
        {/* Current Zone Temperatures */}
        {machine.area === 'sheathing' ? (
          // Extrusion machines: 10 zones in single horizontal row
          <div className="grid grid-cols-10 gap-2 mb-4">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((zoneNum) => {
              const zoneKey = `zone${zoneNum}` as keyof typeof machine.multiZoneTemperatures;
              const zoneColors = [
                '#FF6B6B', '#FFB86C', '#F59E0B', '#34E7F8', '#4FFFBC',
                '#9580FF', '#FF4C4C', '#22C55E', '#FBBF24', '#A78BFA'
              ];
              const zoneColor = zoneColors[zoneNum - 1];
              const zoneValue = machine.multiZoneTemperatures?.[zoneKey];
              
              return (
                <div key={zoneNum} className="p-2 rounded-lg bg-white/5 border border-white/10">
                  <div className="flex items-center gap-1 mb-1">
                    <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: zoneColor }} />
                    <div className="text-white/60 text-[10px] truncate">Z{zoneNum}</div>
                  </div>
                  <div className="text-base tracking-tight" style={{ color: zoneColor }}>
                    {zoneValue ? `${Math.round(zoneValue as number)}°C` : 'N/A'}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          // Other machines: 4 zones in 4-column grid
          <div className="grid grid-cols-4 gap-3 mb-4">
            <div className="p-3 rounded-lg bg-white/5 border border-white/10">
              <div className="flex items-center gap-1.5 mb-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-[#FF6B6B]" />
                <div className="text-white/60 text-xs">ZONE 1</div>
              </div>
              <div className="text-2xl text-[#FF6B6B] tracking-tight">
                {machine.multiZoneTemperatures?.zone1 ? `${Math.round(machine.multiZoneTemperatures.zone1)}°C` : 'N/A'}
              </div>
            </div>
            <div className="p-3 rounded-lg bg-white/5 border border-white/10">
              <div className="flex items-center gap-1.5 mb-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-[#FFB86C]" />
                <div className="text-white/60 text-xs">ZONE 2</div>
              </div>
              <div className="text-2xl text-[#FFB86C] tracking-tight">
                {machine.multiZoneTemperatures?.zone2 ? `${Math.round(machine.multiZoneTemperatures.zone2)}°C` : 'N/A'}
              </div>
            </div>
            <div className="p-3 rounded-lg bg-white/5 border border-white/10">
              <div className="flex items-center gap-1.5 mb-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-[#F59E0B]" />
                <div className="text-white/60 text-xs">ZONE 3</div>
              </div>
              <div className="text-2xl text-[#F59E0B] tracking-tight">
                {machine.multiZoneTemperatures?.zone3 ? `${Math.round(machine.multiZoneTemperatures.zone3)}°C` : 'N/A'}
              </div>
            </div>
            <div className="p-3 rounded-lg bg-white/5 border border-white/10">
              <div className="flex items-center gap-1.5 mb-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-[#34E7F8]" />
                <div className="text-white/60 text-xs">ZONE 4</div>
              </div>
              <div className="text-2xl text-[#34E7F8] tracking-tight">
                {machine.multiZoneTemperatures?.zone4 ? `${Math.round(machine.multiZoneTemperatures.zone4)}°C` : 'N/A'}
              </div>
            </div>
          </div>
        )}

        {/* Multi-zone Chart */}
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart 
              data={multiZoneTempData}
              isAnimationActive={false}
            >
              <XAxis 
                dataKey="time" 
                stroke="#ffffff40" 
                tick={{ fill: '#ffffff80', fontSize: 12 }}
              />
              <YAxis 
                stroke="#ffffff40" 
                tick={{ fill: '#ffffff80', fontSize: 12 }}
                domain={multiZoneTempDomain}
                label={{ value: 'Temperature (°C)', angle: -90, position: 'insideLeft', fill: '#ffffff60' }}
                tickFormatter={(value) => value.toFixed(2)}
              />
              <Tooltip 
                content={<CompactMultiZoneTooltip />}
              />
              <Legend 
                wrapperStyle={{ paddingTop: '20px' }}
                iconType="line"
              />
              {/* Zones 1-4 (all machines) */}
              <Line 
                type="monotone" 
                dataKey="zone1" 
                stroke="#FF6B6B" 
                strokeWidth={3}
                name="Zone 1"
                dot={false}
                isAnimationActive={false}
              />
              <Line 
                type="monotone" 
                dataKey="zone2" 
                stroke="#FFB86C" 
                strokeWidth={3}
                name="Zone 2"
                dot={false}
                isAnimationActive={false}
              />
              <Line 
                type="monotone" 
                dataKey="zone3" 
                stroke="#F59E0B" 
                strokeWidth={3}
                name="Zone 3"
                dot={false}
                isAnimationActive={false}
              />
              <Line 
                type="monotone" 
                dataKey="zone4" 
                stroke="#34E7F8" 
                strokeWidth={3}
                name="Zone 4"
                dot={false}
                isAnimationActive={false}
              />
              {/* Zones 5-10 (extrusion machines only) */}
              {machine.area === 'sheathing' && (
                <>
                  <Line 
                    type="monotone" 
                    dataKey="zone5" 
                    stroke="#4FFFBC" 
                    strokeWidth={3}
                    name="Zone 5"
                    dot={false}
                    isAnimationActive={false}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="zone6" 
                    stroke="#9580FF" 
                    strokeWidth={3}
                    name="Zone 6"
                    dot={false}
                    isAnimationActive={false}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="zone7" 
                    stroke="#FF4C4C" 
                    strokeWidth={3}
                    name="Zone 7"
                    dot={false}
                    isAnimationActive={false}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="zone8" 
                    stroke="#22C55E" 
                    strokeWidth={3}
                    name="Zone 8"
                    dot={false}
                    isAnimationActive={false}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="zone9" 
                    stroke="#FBBF24" 
                    strokeWidth={3}
                    name="Zone 9"
                    dot={false}
                    isAnimationActive={false}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="zone10" 
                    stroke="#A78BFA" 
                    strokeWidth={3}
                    name="Zone 10"
                    dot={false}
                    isAnimationActive={false}
                  />
                </>
              )}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Power and Energy Analytics */}
      <div className="mt-4 grid grid-cols-2 gap-4">
        {/* Real-time Power Consumption */}
        <div className="rounded-xl bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-xl border border-white/20 shadow-2xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <Zap className="w-4 h-4 text-[#FFB86C]" strokeWidth={2.5} />
            <h3 className="text-base text-white">Power Trend</h3>
          </div>
          <div className="mb-3">
            <div className="text-3xl text-[#FFB86C] tracking-tight">
              {machine.power ? `${machine.power.toFixed(1)} kW` : 'N/A'}
            </div>
            <div className="text-white/60 text-xs">Current</div>
          </div>
          <div className="h-40">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart 
                data={powerData}
                isAnimationActive={false}
              >
                <defs>
                  <linearGradient id="powerGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#FFB86C" stopOpacity={0.4}/>
                    <stop offset="100%" stopColor="#FFB86C" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <XAxis 
                  dataKey="time" 
                  stroke="#ffffff40" 
                  tick={{ fill: '#ffffff60', fontSize: 11 }}
                />
                <YAxis 
                  stroke="#ffffff40" 
                  tick={{ fill: '#ffffff60', fontSize: 11 }}
                  domain={['auto', 'auto']}
                  tickFormatter={(value) => value.toFixed(2)}
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: '#0E2F4F', 
                    border: '1px solid rgba(255,255,255,0.2)',
                    borderRadius: '8px',
                    fontSize: '12px'
                  }}
                />
                <Area 
                  type="monotone" 
                  dataKey="power" 
                  stroke="#FFB86C" 
                  strokeWidth={3}
                  fill="url(#powerGradient)"
                  isAnimationActive={false}
                  dot={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Energy Consumption per Interval */}
        <div className="rounded-xl bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-xl border border-white/20 shadow-2xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <Battery className="w-4 h-4 text-[#4FFFBC]" strokeWidth={2.5} />
            <h3 className="text-base text-white">Energy Consumption per Interval</h3>
          </div>
          
          <div className="mb-3">
            <div className="text-3xl text-[#4FFFBC] tracking-tight">
              {energyData.reduce((sum: number, d: any) => sum + (typeof d === 'object' ? (d.energy || 0) : d), 0).toFixed(1)} kWh
            </div>
            <div className="text-white/60 text-xs">8-hour shift total</div>
          </div>

          <div className="h-40">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart 
                data={energyData} 
                margin={{ top: 10, right: 10, left: 40, bottom: 50 }}
                isAnimationActive={false}
                barCategoryGap="10%"
              >
                <defs>
                  <linearGradient id="energyGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#4FFFBC" stopOpacity={1}/>
                    <stop offset="100%" stopColor="#4FFFBC" stopOpacity={0.7}/>
                  </linearGradient>
                </defs>
                <XAxis 
                  dataKey="hour" 
                  stroke="#ffffff40" 
                  tick={{ fill: '#ffffff60', fontSize: 10 }}
                  angle={-45}
                  textAnchor="end"
                  height={60}
                  label={{ value: 'Time (Hour)', position: 'insideBottom', offset: -5, fill: '#ffffff60', fontSize: 10 }}
                />
                <YAxis 
                  stroke="#ffffff40" 
                  tick={{ fill: '#ffffff60', fontSize: 10 }}
                  label={{ value: 'Energy (kWh)', angle: -90, position: 'insideLeft', fill: '#ffffff60', fontSize: 10, style: { textAnchor: 'middle' } }}
                  domain={[0, 'auto']}
                  width={50}
                  tickFormatter={(value) => value.toFixed(1)}
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: '#0E2F4F', 
                    border: '1px solid rgba(255,255,255,0.2)',
                    borderRadius: '8px',
                    fontSize: '11px',
                    color: '#ffffff',
                    padding: '6px 8px'
                  }}
                  formatter={(value: any) => {
                    const numValue = typeof value === 'number' ? value : parseFloat(value) || 0;
                    return [`${numValue.toFixed(2)} kWh`, 'Energy'];
                  }}
                  labelFormatter={(label) => `Hour: ${label}`}
                />
                <Bar 
                  dataKey="energy" 
                  fill="url(#energyGradient)"
                  radius={[4, 4, 0, 0]}
                  isAnimationActive={false}
                  stroke="#4FFFBC"
                  strokeWidth={1}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Production Order History (24h) */}
      <div className="mt-4 rounded-xl bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-xl border border-white/20 shadow-2xl p-4">
        <div className="flex items-center gap-2 mb-4">
          <History className="w-5 h-5 text-[#34E7F8]" strokeWidth={2.5} />
          <h2 className="text-xl text-white">Production Order History - Last 24 Hours</h2>
        </div>

        <div className="space-y-2">
          {orderHistory.map((order, index) => {
            const StatusIcon = getOrderStatusIcon(order.status);
            const statusColor = getOrderStatusColor(order.status);
            const completionPercentage = (order.producedLength / order.targetLength) * 100;
            
            return (
              <div 
                key={index}
                className="p-4 rounded-lg bg-gradient-to-br from-white/8 to-white/3 border border-white/10 hover:border-white/20 transition-all"
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div 
                      className="p-2 rounded-lg border"
                      style={{
                        backgroundColor: `${statusColor}15`,
                        borderColor: `${statusColor}30`
                      }}
                    >
                      <StatusIcon className="w-5 h-5" style={{ color: statusColor }} strokeWidth={2.5} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xl text-white tracking-tight">{order.id}</span>
                        <div 
                          className="px-2 py-0.5 rounded-md text-xs tracking-wider uppercase border"
                          style={{
                            backgroundColor: `${statusColor}20`,
                            borderColor: `${statusColor}40`,
                            color: statusColor
                          }}
                        >
                          {order.status}
                        </div>
                      </div>
                      <div className="text-white/60 text-sm">{order.productName} • {order.customer}</div>
                    </div>
                  </div>
                  <div className="text-right">
                      <div className="text-white/60 text-xs mb-1">DURATION</div>
                    <div className="text-lg text-white">
                      {order.duration || (order.endTime 
                        ? `${Math.round((new Date(order.endTime).getTime() - new Date(order.startTime).getTime()) / 3600000)}h ${Math.round(((new Date(order.endTime).getTime() - new Date(order.startTime).getTime()) % 3600000) / 60000)}m`
                        : `${Math.round((Date.now() - new Date(order.startTime).getTime()) / 3600000)}h ${Math.round(((Date.now() - new Date(order.startTime).getTime()) % 3600000) / 60000)}m`)}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-4 gap-4 mb-3">
                    <div>
                      <div className="flex items-center gap-1.5 mb-1">
                        <Clock className="w-3.5 h-3.5 text-[#34E7F8]" />
                        <span className="text-white/60 text-xs">START TIME</span>
                      </div>
                      <div className="text-base text-white">
                        {new Date(order.startTime).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5 mb-1">
                        <Clock className="w-3.5 h-3.5 text-[#FFB86C]" />
                        <span className="text-white/60 text-xs">END TIME</span>
                      </div>
                      <div className="text-base text-white">
                        {order.endTime 
                          ? new Date(order.endTime).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
                          : '-'}
                      </div>
                    </div>
                  <div>
                    <div className="flex items-center gap-1.5 mb-1">
                      <Activity className="w-3.5 h-3.5 text-[#4FFFBC]" />
                      <span className="text-white/60 text-xs">PRODUCED</span>
                    </div>
                    <div className="text-base text-[#4FFFBC]">{order.producedLength.toLocaleString()} m</div>
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5 mb-1">
                      <Target className="w-3.5 h-3.5 text-white/60" />
                      <span className="text-white/60 text-xs">TARGET</span>
                    </div>
                    <div className="text-base text-white">{order.targetLength.toLocaleString()} m</div>
                  </div>
                </div>

                {/* Progress bar */}
                <div>
                  <div className="flex justify-between items-center mb-1.5">
                    <span className="text-white/60 text-xs">Completion</span>
                    <span className="text-white text-sm">{completionPercentage.toFixed(1)}%</span>
                  </div>
                  <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                    <div 
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${Math.min(completionPercentage, 100)}%`,
                        backgroundColor: statusColor
                      }}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// Compact Multi-Zone Temperature Tooltip Component
const CompactMultiZoneTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload || !payload.length) return null;

  // Filter out null/undefined values and sort by zone number
  const validPayloads = payload
    .filter((item: any) => item.value !== null && item.value !== undefined)
    .sort((a: any, b: any) => {
      const zoneNumA = parseInt(a.dataKey.replace('zone', ''));
      const zoneNumB = parseInt(b.dataKey.replace('zone', ''));
      return zoneNumA - zoneNumB;
    });

  if (validPayloads.length === 0) return null;

  // Group zones into columns (2 columns max)
  const columns = 2;
  const rows = Math.ceil(validPayloads.length / columns);

  return (
    <div 
      style={{
        backgroundColor: '#0E2F4F',
        border: '1px solid rgba(255,255,255,0.2)',
        borderRadius: '6px',
        padding: '6px 8px',
        fontSize: '10px',
        maxWidth: '280px',
        boxShadow: '0 4px 12px rgba(0,0,0,0.3)'
      }}
    >
      <div style={{ marginBottom: '4px', color: '#ffffff80', fontSize: '9px' }}>
        {label}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${columns}, 1fr)`, gap: '4px' }}>
        {validPayloads.map((item: any, index: number) => {
          const zoneNum = item.dataKey.replace('zone', '');
          return (
            <div key={index} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <div
                style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  backgroundColor: item.color,
                  flexShrink: 0
                }}
              />
              <span style={{ color: '#ffffff60', fontSize: '9px' }}>Z{zoneNum}:</span>
              <span style={{ color: item.color, fontWeight: '500', fontSize: '10px' }}>
                {typeof item.value === 'number' ? `${Math.round(item.value)}°C` : 'N/A'}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// Gantt Chart Component for Operational States
interface GanttChartProps {
  data: Array<{
    id: number;
    status: string;
    startTime: string;
    endTime: string | null;
    durationSeconds: number | null;
  }>;
}

function GanttChart({ data }: GanttChartProps) {
  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'running': return '#22C55E';
      case 'idle': return '#64748B';
      case 'warning': return '#F59E0B';
      case 'error': return '#EF4444';
      case 'alarm': return '#EF4444';
      case 'stopped': return '#34E7F8';
      case 'setup': return '#FFB86C';
      default: return '#64748B';
    }
  };

  // Calculate time range (8 hours = 480 minutes)
  const now = new Date();
  const startTime = new Date(now.getTime() - 8 * 60 * 60 * 1000);
  const endTime = now;
  const totalMinutes = 8 * 60;
  
  // Process data to create timeline segments
  const timelineSegments = useMemo(() => {
    if (!data || data.length === 0) return [];
    
    const segments: Array<{
      status: string;
      startPercent: number;
      endPercent: number;
      duration: number;
      startTime: Date;
      endTime: Date | null;
    }> = [];
    
    data.forEach((item) => {
      const itemStart = new Date(item.startTime);
      const itemEnd = item.endTime ? new Date(item.endTime) : now;
      
      // Only include segments within the 8-hour window
      if (itemEnd >= startTime && itemStart <= endTime) {
        const actualStart = itemStart < startTime ? startTime : itemStart;
        const actualEnd = itemEnd > endTime ? endTime : itemEnd;
        
        const startMinutes = Math.max(0, (actualStart.getTime() - startTime.getTime()) / (1000 * 60));
        const endMinutes = Math.min(totalMinutes, (actualEnd.getTime() - startTime.getTime()) / (1000 * 60));
        
        if (endMinutes > startMinutes) {
          segments.push({
            status: item.status,
            startPercent: (startMinutes / totalMinutes) * 100,
            endPercent: (endMinutes / totalMinutes) * 100,
            duration: endMinutes - startMinutes,
            startTime: actualStart,
            endTime: actualEnd,
          });
        }
      }
    });
    
    // Sort by start time
    return segments.sort((a, b) => a.startTime.getTime() - b.startTime.getTime());
  }, [data, startTime, endTime, now, totalMinutes]);

  // Generate time labels for the x-axis (every hour)
  const timeLabels = useMemo(() => {
    const labels = [];
    for (let i = 0; i <= 8; i++) {
      const time = new Date(startTime.getTime() + i * 60 * 60 * 1000);
      labels.push({
        time: time.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
        percent: (i / 8) * 100,
      });
    }
    return labels;
  }, [startTime]);

  // Group segments by status for legend
  const statusGroups = useMemo(() => {
    const groups: Record<string, typeof timelineSegments> = {};
    timelineSegments.forEach((segment) => {
      const statusKey = segment.status.toLowerCase();
      if (!groups[statusKey]) {
        groups[statusKey] = [];
      }
      groups[statusKey].push(segment);
    });
    return groups;
  }, [timelineSegments]);

  const statusOrder = ['running', 'idle', 'setup', 'warning', 'stopped', 'error', 'alarm'];
  
  // Calculate current time position
  const currentTimePercent = ((now.getTime() - startTime.getTime()) / (8 * 60 * 60 * 1000)) * 100;
  
  return (
    <div className="space-y-4">
      {/* Status Legend */}
      <div className="flex flex-wrap gap-4">
        {statusOrder.map((status) => {
          if (!statusGroups[status] || statusGroups[status].length === 0) return null;
          const totalDuration = statusGroups[status].reduce((sum, seg) => sum + seg.duration, 0);
          const hours = Math.floor(totalDuration / 60);
          const minutes = Math.floor(totalDuration % 60);
          return (
            <div key={status} className="flex items-center gap-2">
              <div
                className="w-4 h-4 rounded"
                style={{ backgroundColor: getStatusColor(status) }}
              />
              <span className="text-sm text-white/80 font-medium uppercase">{status}</span>
              <span className="text-xs text-white/50">
                ({hours}h {minutes}m)
              </span>
            </div>
          );
        })}
      </div>

      {/* Gantt Chart */}
      <div className="relative h-32 bg-white/5 rounded-lg overflow-hidden border border-white/10">
        {/* Time grid lines */}
        <div className="absolute inset-0">
          {timeLabels.map((label, index) => (
            <div
              key={index}
              className="absolute top-0 bottom-0 border-l border-white/10"
              style={{ left: `${label.percent}%` }}
            >
            </div>
          ))}
        </div>

        {/* Status segments */}
        <div className="relative h-full flex items-center pt-6">
          {timelineSegments.map((segment, index) => {
            const width = segment.endPercent - segment.startPercent;
            const statusLower = segment.status.toLowerCase();
            return (
              <div
                key={`${segment.status}-${index}`}
                className="absolute h-16 rounded transition-all hover:opacity-90 hover:shadow-lg cursor-pointer border border-white/20"
                style={{
                  left: `${segment.startPercent}%`,
                  width: `${width}%`,
                  backgroundColor: getStatusColor(statusLower),
                  minWidth: '3px',
                }}
                title={`${segment.status.toUpperCase()}\nStart: ${segment.startTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}\nEnd: ${segment.endTime?.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) || 'Now'}\nDuration: ${Math.round(segment.duration)} min (${(segment.duration / 60).toFixed(1)}h)`}
              >
                {/* Show status label if segment is wide enough */}
                {width > 5 && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-xs text-white font-semibold drop-shadow-lg uppercase">
                      {segment.status}
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Current time indicator */}
        {currentTimePercent > 0 && currentTimePercent < 100 && (
          <div
            className="absolute top-0 bottom-0 w-0.5 bg-[#34E7F8] z-20 pointer-events-none"
            style={{ left: `${currentTimePercent}%` }}
          >
            <div className="absolute -top-2 left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-[#34E7F8]" />
            <div className="absolute -bottom-2 left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-b-4 border-transparent border-b-[#34E7F8]" />
          </div>
        )}
      </div>
    </div>
  );
}
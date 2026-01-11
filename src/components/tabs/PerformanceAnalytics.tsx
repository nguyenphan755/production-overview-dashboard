import { useState, useEffect, useMemo, useRef } from 'react';
import { 
  TrendingUp, Clock, Zap, Target, AlertTriangle, Activity, 
  BarChart3, PieChart, Calendar, Package, Flame, Battery,
  TrendingDown, ArrowUp, ArrowDown, Minus, AlertCircle, Download, FileText, File
} from 'lucide-react';
import { 
  LineChart, Line, XAxis, YAxis, ResponsiveContainer, BarChart, Bar, 
  Tooltip, Legend, ComposedChart, Area, AreaChart, PieChart as RechartsPieChart, 
  Cell, CartesianGrid, ReferenceLine
} from 'recharts';
import { useMachines, useGlobalKPIs, useProductionOrders, useProductionAreas } from '../../hooks/useProductionData';
import { apiClient } from '../../services/api';
import { exportToPowerPoint, exportAsPDF, ExportOptions } from '../../utils/exportAnalytics';

type TimeRange = 'today' | 'week' | 'month' | 'shift';

export function PerformanceAnalytics() {
  const { machines, loading: machinesLoading } = useMachines();
  const { kpis, loading: kpisLoading } = useGlobalKPIs();
  const { orders } = useProductionOrders();
  const { areas } = useProductionAreas();
  const [timeRange, setTimeRange] = useState<TimeRange>('today');
  const [selectedArea, setSelectedArea] = useState<string>('all');
  const [exporting, setExporting] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const exportMenuRef = useRef<HTMLDivElement>(null);
  
  // Close export menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (exportMenuRef.current && !exportMenuRef.current.contains(event.target as Node)) {
        setShowExportMenu(false);
      }
    };
    
    if (showExportMenu) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showExportMenu]);

  // Calculate aggregated OEE metrics from real machine data
  const oeeMetrics = useMemo(() => {
    if (!machines || machines.length === 0) {
      return { oee: 0, availability: 0, performance: 0, quality: 0 };
    }

    const validMachines = machines.filter(m => 
      m.oee !== undefined && m.oee !== null &&
      m.availability !== undefined && m.availability !== null &&
      m.performance !== undefined && m.performance !== null &&
      m.quality !== undefined && m.quality !== null
    );

    if (validMachines.length === 0) {
      return { oee: 0, availability: 0, performance: 0, quality: 0 };
    }

    const avgOEE = validMachines.reduce((sum, m) => sum + (m.oee || 0), 0) / validMachines.length;
    const avgAvailability = validMachines.reduce((sum, m) => sum + (m.availability || 0), 0) / validMachines.length;
    const avgPerformance = validMachines.reduce((sum, m) => sum + (m.performance || 0), 0) / validMachines.length;
    const avgQuality = validMachines.reduce((sum, m) => sum + (m.quality || 0), 0) / validMachines.length;

    return {
      oee: Math.round(avgOEE * 100) / 100,
      availability: Math.round(avgAvailability * 100) / 100,
      performance: Math.round(avgPerformance * 100) / 100,
      quality: Math.round(avgQuality * 100) / 100,
    };
  }, [machines]);

  // Calculate NG (No Good) metrics from machine data
  const ngMetrics = useMemo(() => {
    if (!machines || machines.length === 0) {
      return { totalNG: 0, totalOK: 0, totalLength: 0, ngRate: 0 };
    }

    let totalNG = 0;
    let totalOK = 0;
    let totalLength = 0;

    machines.forEach(machine => {
      // Access producedLengthNg from machine detail if available
      const ngLength = (machine as any).producedLengthNg || 0;
      const okLength = (machine as any).producedLengthOk || 0;
      const totalProd = machine.producedLength || 0;

      totalNG += ngLength;
      totalOK += okLength || (totalProd - ngLength);
      totalLength += totalProd;
    });

    const ngRate = totalLength > 0 ? (totalNG / totalLength) * 100 : 0;

    return {
      totalNG: Math.round(totalNG * 100) / 100,
      totalOK: Math.round(totalOK * 100) / 100,
      totalLength: Math.round(totalLength * 100) / 100,
      ngRate: Math.round(ngRate * 100) / 100,
    };
  }, [machines]);

  // Generate OEE trend data (simulated hourly for today, can be enhanced with real historical data)
  const oeeTrendData = useMemo(() => {
    const now = new Date();
    const hours = [];
    const baseOEE = oeeMetrics.oee || 85;
    
    for (let i = 0; i < 24; i++) {
      const hour = new Date(now);
      hour.setHours(i, 0, 0, 0);
      const hourStr = hour.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
      
      // Simulate realistic variation around base OEE
      const variation = (Math.sin(i * 0.3) * 3) + (Math.random() * 2 - 1);
      const oee = Math.max(70, Math.min(100, baseOEE + variation));
      const availability = oeeMetrics.availability + (Math.random() * 2 - 1);
      const performance = oeeMetrics.performance + (Math.random() * 2 - 1);
      const quality = oeeMetrics.quality + (Math.random() * 0.5 - 0.25);

      hours.push({
        time: hourStr,
        oee: Math.round(oee * 100) / 100,
        availability: Math.round(availability * 100) / 100,
        performance: Math.round(performance * 100) / 100,
        quality: Math.round(quality * 100) / 100,
      });
    }
    return hours;
  }, [oeeMetrics]);

  // Calculate downtime by status from machine data
  const downtimeData = useMemo(() => {
    if (!machines || machines.length === 0) return [];

    const statusCounts: Record<string, number> = {};
    machines.forEach(machine => {
      const status = machine.status?.toLowerCase() || 'idle';
      if (status !== 'running') {
        statusCounts[status] = (statusCounts[status] || 0) + 1;
      }
    });

    const statusColors: Record<string, string> = {
      idle: '#64748B',
      warning: '#F59E0B',
      error: '#EF4444',
      stopped: '#34E7F8',
      setup: '#FFB86C',
    };

    return Object.entries(statusCounts)
      .map(([reason, count]) => ({
        reason: reason.charAt(0).toUpperCase() + reason.slice(1),
        duration: count * 15, // Approximate minutes (can be enhanced with real downtime data)
        count,
        color: statusColors[reason] || '#9580FF',
      }))
      .sort((a, b) => b.duration - a.duration);
  }, [machines]);

  // Calculate area performance
  const areaPerformanceData = useMemo(() => {
    if (!areas || areas.length === 0) return [];

    return areas.map(area => {
      const areaMachines = machines?.filter(m => m.area === area.id) || [];
      const validMachines = areaMachines.filter(m => 
        m.oee !== undefined && m.oee !== null
      );

      if (validMachines.length === 0) {
        return {
          area: area.name,
          oee: 0,
          availability: 0,
          performance: 0,
          quality: 0,
          machineCount: 0,
        };
      }

      const avgOEE = validMachines.reduce((sum, m) => sum + (m.oee || 0), 0) / validMachines.length;
      const avgAvailability = validMachines.reduce((sum, m) => sum + (m.availability || 0), 0) / validMachines.length;
      const avgPerformance = validMachines.reduce((sum, m) => sum + (m.performance || 0), 0) / validMachines.length;
      const avgQuality = validMachines.reduce((sum, m) => sum + (m.quality || 0), 0) / validMachines.length;

      return {
        area: area.name,
        oee: Math.round(avgOEE * 100) / 100,
        availability: Math.round(avgAvailability * 100) / 100,
        performance: Math.round(avgPerformance * 100) / 100,
        quality: Math.round(avgQuality * 100) / 100,
        machineCount: validMachines.length,
      };
    });
  }, [areas, machines]);

  // Calculate Six Big Losses (OEE Loss Analysis)
  const sixBigLosses = useMemo(() => {
    if (!machines || machines.length === 0) return [];

    const avgAvailability = oeeMetrics.availability;
    const avgPerformance = oeeMetrics.performance;
    const avgQuality = oeeMetrics.quality;
    const idealOEE = 100;

    // Calculate losses
    const availabilityLoss = idealOEE - avgAvailability;
    const performanceLoss = avgAvailability - (avgAvailability * avgPerformance / 100);
    const qualityLoss = (avgAvailability * avgPerformance / 100) - (avgAvailability * avgPerformance * avgQuality / 10000);

    return [
      {
        category: 'Equipment Failure',
        loss: Math.round(availabilityLoss * 0.4 * 100) / 100,
        type: 'availability',
        color: '#EF4444',
      },
      {
        category: 'Setup & Adjustments',
        loss: Math.round(availabilityLoss * 0.3 * 100) / 100,
        type: 'availability',
        color: '#FFB86C',
      },
      {
        category: 'Idling & Minor Stops',
        loss: Math.round(availabilityLoss * 0.3 * 100) / 100,
        type: 'availability',
        color: '#F59E0B',
      },
      {
        category: 'Reduced Speed',
        loss: Math.round(performanceLoss * 0.6 * 100) / 100,
        type: 'performance',
        color: '#34E7F8',
      },
      {
        category: 'Process Defects',
        loss: Math.round(qualityLoss * 0.7 * 100) / 100,
        type: 'quality',
        color: '#FF4C4C',
      },
      {
        category: 'Reduced Yield',
        loss: Math.round(qualityLoss * 0.3 * 100) / 100,
        type: 'quality',
        color: '#9580FF',
      },
    ].filter(loss => loss.loss > 0)
      .sort((a, b) => b.loss - a.loss);
  }, [oeeMetrics]);

  // Calculate production rate trend
  const productionRateData = useMemo(() => {
    if (!machines || machines.length === 0) return [];

    const now = new Date();
    const hours = [];

    for (let i = 0; i < 24; i++) {
      const hour = new Date(now);
      hour.setHours(i, 0, 0, 0);
      const hourStr = hour.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

      // Calculate average speed for this hour (simulated, can be enhanced with real historical data)
      const avgSpeed = machines.reduce((sum, m) => sum + (m.lineSpeed || 0), 0) / machines.length;
      const variation = (Math.sin(i * 0.2) * 50) + (Math.random() * 20 - 10);
      const rate = Math.max(0, avgSpeed + variation);

      hours.push({
        time: hourStr,
        rate: Math.round(rate * 100) / 100,
        target: machines[0]?.targetSpeed || 1000,
      });
    }
    return hours;
  }, [machines]);

  // Calculate energy consumption trend
  const energyData = useMemo(() => {
    if (!machines || machines.length === 0) return [];

    const now = new Date();
    const hours = [];

    for (let i = 0; i < 24; i++) {
      const hour = new Date(now);
      hour.setHours(i, 0, 0, 0);
      const hourStr = hour.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

      // Calculate total energy for this hour
      const totalEnergy = machines.reduce((sum, m) => sum + ((m as any).energyConsumption || (m.power || 0) * 0.5), 0);
      const variation = (Math.sin(i * 0.15) * 5) + (Math.random() * 2 - 1);
      const energy = Math.max(0, totalEnergy + variation);

      hours.push({
        time: hourStr,
        energy: Math.round(energy * 100) / 100,
      });
    }
    return hours;
  }, [machines]);

  // Calculate NG trend by time
  const ngTrendData = useMemo(() => {
    if (!machines || machines.length === 0) return [];

    const now = new Date();
    const hours = [];
    const baseNG = ngMetrics.ngRate || 1;

    for (let i = 0; i < 24; i++) {
      const hour = new Date(now);
      hour.setHours(i, 0, 0, 0);
      const hourStr = hour.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

      const variation = (Math.sin(i * 0.25) * 0.5) + (Math.random() * 0.3 - 0.15);
      const ngRate = Math.max(0, Math.min(5, baseNG + variation));
      const ngLength = (ngMetrics.totalNG / 24) * (1 + variation * 0.1);

      hours.push({
        time: hourStr,
        ngRate: Math.round(ngRate * 100) / 100,
        ngLength: Math.round(ngLength * 100) / 100,
      });
    }
    return hours;
  }, [ngMetrics]);

  // Calculate planned vs actual production
  const plannedVsActual = useMemo(() => {
    if (!orders || orders.length === 0) return { planned: 0, actual: 0, variance: 0 };

    const planned = orders.reduce((sum, order) => sum + (order.targetLength || 0), 0);
    const actual = orders.reduce((sum, order) => sum + (order.producedLength || 0), 0);
    const variance = planned > 0 ? ((actual - planned) / planned) * 100 : 0;

    return {
      planned: Math.round(planned * 100) / 100,
      actual: Math.round(actual * 100) / 100,
      variance: Math.round(variance * 100) / 100,
    };
  }, [orders]);

  // Calculate temperature stability (variance across zones)
  const temperatureStability = useMemo(() => {
    if (!machines || machines.length === 0) return { avgVariance: 0, stability: 100 };

    let totalVariance = 0;
    let machineCount = 0;

    machines.forEach(machine => {
      const zones = (machine as any).multiZoneTemperatures;
      if (zones && typeof zones === 'object') {
        const zoneValues = Object.values(zones).filter(v => typeof v === 'number') as number[];
        if (zoneValues.length > 1) {
          const avg = zoneValues.reduce((sum, v) => sum + v, 0) / zoneValues.length;
          const variance = zoneValues.reduce((sum, v) => sum + Math.abs(v - avg), 0) / zoneValues.length;
          totalVariance += variance;
          machineCount++;
        }
      }
    });

    const avgVariance = machineCount > 0 ? totalVariance / machineCount : 0;
    const stability = Math.max(0, 100 - (avgVariance * 2)); // Convert variance to stability percentage

    return {
      avgVariance: Math.round(avgVariance * 100) / 100,
      stability: Math.round(stability * 100) / 100,
    };
  }, [machines]);

  const loading = machinesLoading || kpisLoading;

  // Export handlers
  const handleExportPowerPoint = async () => {
    if (!containerRef.current) return;
    
    setExporting(true);
    setShowExportMenu(false);
    try {
      const options: ExportOptions = {
        timeRange,
        selectedArea,
        timestamp: new Date().toISOString(),
      };
      
      const data = {
        oeeMetrics,
        ngMetrics,
        plannedVsActual,
        temperatureStability,
        areaPerformance: areaPerformanceData,
        downtimeData,
        sixBigLosses,
      };
      
      await exportToPowerPoint(containerRef.current, options, data);
      // File download will start automatically
    } catch (error) {
      console.error('Export error:', error);
      alert('Error exporting to PowerPoint. Please check the console for details.');
    } finally {
      setExporting(false);
    }
  };

  const handleExportPDF = async () => {
    if (!containerRef.current) return;
    
    setExporting(true);
    setShowExportMenu(false);
    try {
      const options: ExportOptions = {
        timeRange,
        selectedArea,
        timestamp: new Date().toISOString(),
      };
      
      await exportAsPDF(containerRef.current, options);
    } catch (error) {
      console.error('Export error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      alert(`PDF Export Failed\n\n${errorMessage}\n\nPlease use the PowerPoint export option instead, which works correctly with all color formats.`);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div ref={containerRef} className="space-y-6">
      {/* Header with Time Range Selector and Export Buttons */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Calendar className="w-5 h-5 text-[#34E7F8]" />
          <h2 className="text-xl text-white font-semibold">Analytics Dashboard</h2>
        </div>
        <div className="flex items-center gap-3">
          {/* Time Range Selector */}
          <div className="flex gap-2">
            {(['today', 'week', 'month', 'shift'] as TimeRange[]).map((range) => (
              <button
                key={range}
                onClick={() => setTimeRange(range)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  timeRange === range
                    ? 'bg-[#34E7F8]/30 text-[#34E7F8] border border-[#34E7F8]/50'
                    : 'bg-white/5 text-white/60 border border-white/10 hover:bg-white/10'
                }`}
              >
                {range.charAt(0).toUpperCase() + range.slice(1)}
              </button>
            ))}
          </div>
          
          {/* Export Dropdown */}
          <div ref={exportMenuRef} className="relative">
            <button
              onClick={() => setShowExportMenu(!showExportMenu)}
              disabled={exporting}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#34E7F8]/20 text-[#34E7F8] border border-[#34E7F8]/50 hover:bg-[#34E7F8]/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Download className="w-4 h-4" />
              <span className="text-sm font-medium">{exporting ? 'Exporting...' : 'Export'}</span>
            </button>
            
            {/* Export Menu */}
            {showExportMenu && (
            <div className="absolute right-0 top-full mt-2 w-56 rounded-xl bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-xl border border-white/20 shadow-2xl p-2 z-50">
              <div className="space-y-1">
                <button
                  onClick={handleExportPowerPoint}
                  disabled={exporting}
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-white text-sm transition-all disabled:opacity-50"
                >
                  <FileText className="w-4 h-4 text-[#34E7F8]" />
                  <span>Export to PowerPoint</span>
                </button>
                <button
                  onClick={handleExportPDF}
                  disabled={exporting}
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-white text-sm transition-all disabled:opacity-50"
                >
                  <File className="w-4 h-4 text-[#FF4C4C]" />
                  <span>Export to PDF</span>
                </button>
              </div>
            </div>
            )}
          </div>
        </div>
      </div>

      {/* OEE Summary Cards */}
      <div className="grid grid-cols-4 gap-4">
        <div className="rounded-2xl bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-xl border border-white/20 shadow-2xl p-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-xl bg-[#34E7F8]/20">
              <Target className="w-5 h-5 text-[#34E7F8]" strokeWidth={2.5} />
            </div>
            <span className="text-white/60 text-xs tracking-wider">OEE</span>
          </div>
          {loading ? (
            <div className="text-3xl text-white/40">--</div>
          ) : (
            <>
              <div className="text-3xl text-[#34E7F8]">{oeeMetrics.oee.toFixed(1)}%</div>
              <div className="text-white/40 text-xs mt-1">Overall Equipment Effectiveness</div>
            </>
          )}
        </div>

        <div className="rounded-2xl bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-xl border border-white/20 shadow-2xl p-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-xl bg-[#4FFFBC]/20">
              <Zap className="w-5 h-5 text-[#4FFFBC]" strokeWidth={2.5} />
            </div>
            <span className="text-white/60 text-xs tracking-wider">AVAILABILITY</span>
          </div>
          {loading ? (
            <div className="text-3xl text-white/40">--</div>
          ) : (
            <>
              <div className="text-3xl text-[#4FFFBC]">{oeeMetrics.availability.toFixed(1)}%</div>
              <div className="text-white/40 text-xs mt-1">Uptime / Planned Time</div>
            </>
          )}
        </div>

        <div className="rounded-2xl bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-xl border border-white/20 shadow-2xl p-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-xl bg-[#FFB86C]/20">
              <TrendingUp className="w-5 h-5 text-[#FFB86C]" strokeWidth={2.5} />
            </div>
            <span className="text-white/60 text-xs tracking-wider">PERFORMANCE</span>
          </div>
          {loading ? (
            <div className="text-3xl text-white/40">--</div>
          ) : (
            <>
              <div className="text-3xl text-[#FFB86C]">{oeeMetrics.performance.toFixed(1)}%</div>
              <div className="text-white/40 text-xs mt-1">Actual Speed / Ideal Speed</div>
            </>
          )}
        </div>

        <div className="rounded-2xl bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-xl border border-white/20 shadow-2xl p-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-xl bg-[#9580FF]/20">
              <Target className="w-5 h-5 text-[#9580FF]" strokeWidth={2.5} />
            </div>
            <span className="text-white/60 text-xs tracking-wider">QUALITY</span>
          </div>
          {loading ? (
            <div className="text-3xl text-white/40">--</div>
          ) : (
            <>
              <div className="text-3xl text-[#9580FF]">{oeeMetrics.quality.toFixed(1)}%</div>
              <div className="text-white/40 text-xs mt-1">OK Length / Total Length</div>
            </>
          )}
        </div>
      </div>

      {/* NG Metrics Cards */}
      <div className="grid grid-cols-4 gap-4">
        <div className="rounded-2xl bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-xl border border-white/20 shadow-2xl p-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-xl bg-[#FF4C4C]/20">
              <AlertTriangle className="w-5 h-5 text-[#FF4C4C]" strokeWidth={2.5} />
            </div>
            <span className="text-white/60 text-xs tracking-wider">NG LENGTH</span>
          </div>
          {loading ? (
            <div className="text-3xl text-white/40">--</div>
          ) : (
            <>
              <div className="text-3xl text-[#FF4C4C]">{ngMetrics.totalNG.toLocaleString()}m</div>
              <div className="text-white/40 text-xs mt-1">No Good / Rejected</div>
            </>
          )}
        </div>

        <div className="rounded-2xl bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-xl border border-white/20 shadow-2xl p-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-xl bg-[#22C55E]/20">
              <Package className="w-5 h-5 text-[#22C55E]" strokeWidth={2.5} />
            </div>
            <span className="text-white/60 text-xs tracking-wider">OK LENGTH</span>
          </div>
          {loading ? (
            <div className="text-3xl text-white/40">--</div>
          ) : (
            <>
              <div className="text-3xl text-[#22C55E]">{ngMetrics.totalOK.toLocaleString()}m</div>
              <div className="text-white/40 text-xs mt-1">Good / Accepted</div>
            </>
          )}
        </div>

        <div className="rounded-2xl bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-xl border border-white/20 shadow-2xl p-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-xl bg-[#F59E0B]/20">
              <BarChart3 className="w-5 h-5 text-[#F59E0B]" strokeWidth={2.5} />
            </div>
            <span className="text-white/60 text-xs tracking-wider">NG RATE</span>
          </div>
          {loading ? (
            <div className="text-3xl text-white/40">--</div>
          ) : (
            <>
              <div className="text-3xl text-[#F59E0B]">{ngMetrics.ngRate.toFixed(2)}%</div>
              <div className="text-white/40 text-xs mt-1">NG / Total × 100</div>
            </>
          )}
        </div>

        <div className="rounded-2xl bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-xl border border-white/20 shadow-2xl p-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-xl bg-[#34E7F8]/20">
              <Activity className="w-5 h-5 text-[#34E7F8]" strokeWidth={2.5} />
            </div>
            <span className="text-white/60 text-xs tracking-wider">TOTAL OUTPUT</span>
          </div>
          {loading ? (
            <div className="text-3xl text-white/40">--</div>
          ) : (
            <>
              <div className="text-3xl text-[#34E7F8]">{ngMetrics.totalLength.toLocaleString()}m</div>
              <div className="text-white/40 text-xs mt-1">Total Produced Length</div>
            </>
          )}
        </div>
      </div>

      {/* Main Charts Row */}
      <div className="grid grid-cols-2 gap-4">
        {/* OEE Trend Chart */}
        <div 
          className="rounded-2xl bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-xl border border-white/20 shadow-2xl p-5"
          data-chart-export
          data-chart-title="OEE Trend"
        >
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="w-5 h-5 text-[#34E7F8]" />
            <h3 className="text-white font-semibold">OEE Trend ({timeRange === 'today' ? 'Today' : timeRange})</h3>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={oeeTrendData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
                <XAxis 
                  dataKey="time" 
                  stroke="#ffffff40" 
                  tick={{ fill: '#ffffff80', fontSize: 11 }}
                />
                <YAxis 
                  stroke="#ffffff40" 
                  tick={{ fill: '#ffffff80', fontSize: 11 }}
                  domain={[70, 100]}
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: '#0E2F4F', 
                    border: '1px solid rgba(255,255,255,0.2)',
                    borderRadius: '8px',
                    fontSize: '12px'
                  }}
                />
                <Legend />
                <Area 
                  type="monotone" 
                  dataKey="oee" 
                  fill="#34E7F8" 
                  fillOpacity={0.2}
                  stroke="#34E7F8" 
                  strokeWidth={3}
                />
                <Line 
                  type="monotone" 
                  dataKey="availability" 
                  stroke="#4FFFBC" 
                  strokeWidth={2}
                  strokeDasharray="5 5"
                  dot={false}
                />
                <Line 
                  type="monotone" 
                  dataKey="performance" 
                  stroke="#FFB86C" 
                  strokeWidth={2}
                  strokeDasharray="5 5"
                  dot={false}
                />
                <Line 
                  type="monotone" 
                  dataKey="quality" 
                  stroke="#9580FF" 
                  strokeWidth={2}
                  strokeDasharray="5 5"
                  dot={false}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* NG Trend Chart */}
        <div 
          className="rounded-2xl bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-xl border border-white/20 shadow-2xl p-5"
          data-chart-export
          data-chart-title="NG Trend - Produced Length NG"
        >
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle className="w-5 h-5 text-[#FF4C4C]" />
            <h3 className="text-white font-semibold">NG Trend - Produced Length NG</h3>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={ngTrendData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
                <XAxis 
                  dataKey="time" 
                  stroke="#ffffff40" 
                  tick={{ fill: '#ffffff80', fontSize: 11 }}
                />
                <YAxis 
                  yAxisId="left"
                  stroke="#ffffff40" 
                  tick={{ fill: '#ffffff80', fontSize: 11 }}
                  label={{ value: 'NG Rate (%)', angle: -90, position: 'insideLeft', fill: '#ffffff60' }}
                />
                <YAxis 
                  yAxisId="right"
                  orientation="right"
                  stroke="#ffffff40" 
                  tick={{ fill: '#ffffff80', fontSize: 11 }}
                  label={{ value: 'NG Length (m)', angle: 90, position: 'insideRight', fill: '#ffffff60' }}
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: '#0E2F4F', 
                    border: '1px solid rgba(255,255,255,0.2)',
                    borderRadius: '8px',
                    fontSize: '12px'
                  }}
                />
                <Legend />
                <Bar 
                  yAxisId="right"
                  dataKey="ngLength" 
                  fill="#FF4C4C" 
                  fillOpacity={0.6}
                  radius={[4, 4, 0, 0]}
                />
                <Line 
                  yAxisId="left"
                  type="monotone" 
                  dataKey="ngRate" 
                  stroke="#F59E0B" 
                  strokeWidth={3}
                  dot={false}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Six Big Losses and Downtime Analysis */}
      <div className="grid grid-cols-2 gap-4">
        {/* Six Big Losses */}
        <div 
          className="rounded-2xl bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-xl border border-white/20 shadow-2xl p-5"
          data-chart-export
          data-chart-title="Six Big Losses Analysis"
        >
          <div className="flex items-center gap-2 mb-4">
            <PieChart className="w-5 h-5 text-[#FFB86C]" />
            <h3 className="text-white font-semibold">Six Big Losses Analysis</h3>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={sixBigLosses} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
                <XAxis 
                  type="number" 
                  stroke="#ffffff40" 
                  tick={{ fill: '#ffffff80', fontSize: 11 }}
                  label={{ value: 'OEE Loss (%)', position: 'insideBottom', offset: -5, fill: '#ffffff60' }}
                />
                <YAxis 
                  type="category" 
                  dataKey="category" 
                  stroke="#ffffff40" 
                  tick={{ fill: '#ffffff80', fontSize: 10 }}
                  width={140}
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: '#0E2F4F', 
                    border: '1px solid rgba(255,255,255,0.2)',
                    borderRadius: '8px',
                    fontSize: '12px'
                  }}
                  formatter={(value: any) => [`${value.toFixed(2)}%`, 'OEE Loss']}
                />
                <Bar dataKey="loss" radius={[0, 8, 8, 0]}>
                  {sixBigLosses.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Downtime Analysis */}
        <div 
          className="rounded-2xl bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-xl border border-white/20 shadow-2xl p-5"
          data-chart-export
          data-chart-title="Downtime Analysis"
        >
          <div className="flex items-center gap-2 mb-4">
            <Clock className="w-5 h-5 text-[#FFB86C]" />
            <h3 className="text-white font-semibold">Downtime Analysis</h3>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={downtimeData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
                <XAxis 
                  type="number" 
                  stroke="#ffffff40" 
                  tick={{ fill: '#ffffff80', fontSize: 11 }}
                  label={{ value: 'Duration (min)', position: 'insideBottom', offset: -5, fill: '#ffffff60' }}
                />
                <YAxis 
                  type="category" 
                  dataKey="reason" 
                  stroke="#ffffff40" 
                  tick={{ fill: '#ffffff80', fontSize: 11 }}
                  width={100}
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: '#0E2F4F', 
                    border: '1px solid rgba(255,255,255,0.2)',
                    borderRadius: '8px',
                    fontSize: '12px'
                  }}
                  formatter={(value: any, name: string, props: any) => [
                    `${value} min (${props.payload.count} machines)`,
                    'Downtime'
                  ]}
                />
                <Bar dataKey="duration" radius={[0, 8, 8, 0]}>
                  {downtimeData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-4 text-center">
            <span className="text-white/60 text-xs">Total Downtime: </span>
            <span className="text-xl text-[#FF4C4C]">
              {downtimeData.reduce((sum, d) => sum + d.duration, 0)} min
            </span>
          </div>
        </div>
      </div>

      {/* Production Rate and Energy Consumption */}
      <div className="grid grid-cols-2 gap-4">
        {/* Production Rate Trend */}
        <div 
          className="rounded-2xl bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-xl border border-white/20 shadow-2xl p-5"
          data-chart-export
          data-chart-title="Production Rate Trend"
        >
          <div className="flex items-center gap-2 mb-4">
            <Activity className="w-5 h-5 text-[#4FFFBC]" />
            <h3 className="text-white font-semibold">Production Rate Trend</h3>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={productionRateData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
                <XAxis 
                  dataKey="time" 
                  stroke="#ffffff40" 
                  tick={{ fill: '#ffffff80', fontSize: 11 }}
                />
                <YAxis 
                  stroke="#ffffff40" 
                  tick={{ fill: '#ffffff80', fontSize: 11 }}
                  label={{ value: 'Speed (m/min)', angle: -90, position: 'insideLeft', fill: '#ffffff60' }}
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: '#0E2F4F', 
                    border: '1px solid rgba(255,255,255,0.2)',
                    borderRadius: '8px',
                    fontSize: '12px'
                  }}
                />
                <Legend />
                <defs>
                  <linearGradient id="rateGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#4FFFBC" stopOpacity={0.4}/>
                    <stop offset="100%" stopColor="#4FFFBC" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <Area 
                  type="monotone" 
                  dataKey="rate" 
                  fill="url(#rateGradient)"
                  stroke="#4FFFBC" 
                  strokeWidth={3}
                />
                <Line 
                  type="monotone" 
                  dataKey="target" 
                  stroke="#ffffff40" 
                  strokeWidth={2}
                  strokeDasharray="5 5"
                  dot={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Energy Consumption Trend */}
        <div 
          className="rounded-2xl bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-xl border border-white/20 shadow-2xl p-5"
          data-chart-export
          data-chart-title="Energy Consumption Trend"
        >
          <div className="flex items-center gap-2 mb-4">
            <Battery className="w-5 h-5 text-[#34E7F8]" />
            <h3 className="text-white font-semibold">Energy Consumption Trend</h3>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={energyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
                <XAxis 
                  dataKey="time" 
                  stroke="#ffffff40" 
                  tick={{ fill: '#ffffff80', fontSize: 11 }}
                />
                <YAxis 
                  stroke="#ffffff40" 
                  tick={{ fill: '#ffffff80', fontSize: 11 }}
                  label={{ value: 'Energy (kWh)', angle: -90, position: 'insideLeft', fill: '#ffffff60' }}
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: '#0E2F4F', 
                    border: '1px solid rgba(255,255,255,0.2)',
                    borderRadius: '8px',
                    fontSize: '12px'
                  }}
                  formatter={(value: any) => [`${value.toFixed(2)} kWh`, 'Energy']}
                />
                <defs>
                  <linearGradient id="energyGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#34E7F8" stopOpacity={0.4}/>
                    <stop offset="100%" stopColor="#34E7F8" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <Area 
                  type="monotone" 
                  dataKey="energy" 
                  fill="url(#energyGradient)"
                  stroke="#34E7F8" 
                  strokeWidth={3}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Planned vs Actual and Temperature Stability */}
      <div className="grid grid-cols-2 gap-4">
        {/* Planned vs Actual Production */}
        <div className="rounded-2xl bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-xl border border-white/20 shadow-2xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <Target className="w-5 h-5 text-[#FFB86C]" />
            <h3 className="text-white font-semibold">Planned vs Actual Production</h3>
          </div>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                <div className="text-white/60 text-xs mb-2">PLANNED</div>
                <div className="text-2xl text-[#34E7F8]">{plannedVsActual.planned.toLocaleString()}m</div>
              </div>
              <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                <div className="text-white/60 text-xs mb-2">ACTUAL</div>
                <div className="text-2xl text-[#4FFFBC]">{plannedVsActual.actual.toLocaleString()}m</div>
              </div>
            </div>
            <div className="p-4 rounded-xl bg-white/5 border border-white/10">
              <div className="flex items-center justify-between mb-2">
                <div className="text-white/60 text-xs">VARIANCE</div>
                <div className={`text-lg font-semibold flex items-center gap-1 ${
                  plannedVsActual.variance >= 0 ? 'text-[#22C55E]' : 'text-[#FF4C4C]'
                }`}>
                  {plannedVsActual.variance >= 0 ? <ArrowUp className="w-4 h-4" /> : <ArrowDown className="w-4 h-4" />}
                  {Math.abs(plannedVsActual.variance).toFixed(2)}%
                </div>
              </div>
              <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                <div 
                  className={`h-full rounded-full transition-all ${
                    plannedVsActual.variance >= 0 ? 'bg-[#22C55E]' : 'bg-[#FF4C4C]'
                  }`}
                  style={{ width: `${Math.min(100, Math.abs(plannedVsActual.variance))}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Temperature Stability */}
        <div className="rounded-2xl bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-xl border border-white/20 shadow-2xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <Flame className="w-5 h-5 text-[#FF6B6B]" />
            <h3 className="text-white font-semibold">Temperature Stability</h3>
          </div>
          <div className="space-y-4">
            <div className="p-4 rounded-xl bg-white/5 border border-white/10">
              <div className="text-white/60 text-xs mb-2">AVERAGE VARIANCE</div>
              <div className="text-2xl text-[#FF6B6B]">{temperatureStability.avgVariance.toFixed(2)}°C</div>
              <div className="text-white/40 text-xs mt-1">Across all zones</div>
            </div>
            <div className="p-4 rounded-xl bg-white/5 border border-white/10">
              <div className="flex items-center justify-between mb-2">
                <div className="text-white/60 text-xs">STABILITY INDEX</div>
                <div className={`text-lg font-semibold ${
                  temperatureStability.stability >= 90 ? 'text-[#22C55E]' : 
                  temperatureStability.stability >= 75 ? 'text-[#F59E0B]' : 'text-[#FF4C4C]'
                }`}>
                  {temperatureStability.stability.toFixed(1)}%
                </div>
              </div>
              <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                <div 
                  className={`h-full rounded-full transition-all ${
                    temperatureStability.stability >= 90 ? 'bg-[#22C55E]' : 
                    temperatureStability.stability >= 75 ? 'bg-[#F59E0B]' : 'bg-[#FF4C4C]'
                  }`}
                  style={{ width: `${temperatureStability.stability}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Area Performance Comparison */}
      <div className="rounded-2xl bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-xl border border-white/20 shadow-2xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <BarChart3 className="w-5 h-5 text-[#34E7F8]" />
          <h3 className="text-white font-semibold">Performance by Production Area</h3>
        </div>
        <div className="grid grid-cols-3 gap-4">
          {areaPerformanceData.map((area, index) => (
            <div 
              key={index}
              className="p-4 rounded-xl bg-white/5 border border-white/10"
            >
              <div className="flex items-center justify-between mb-4">
                <div className="text-white text-lg font-semibold">{area.area}</div>
                <div className="text-white/40 text-xs">{area.machineCount} machines</div>
              </div>
              <div className="space-y-3">
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-white/60 text-xs">OEE</span>
                    <span className="text-[#34E7F8] font-semibold">{area.oee.toFixed(1)}%</span>
                  </div>
                  <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-gradient-to-r from-[#34E7F8] to-[#4FFFBC] rounded-full"
                      style={{ width: `${area.oee}%` }}
                    />
                  </div>
                </div>
                
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-white/60 text-xs">Availability</span>
                    <span className="text-[#4FFFBC]">{area.availability.toFixed(1)}%</span>
                  </div>
                  <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-[#4FFFBC] rounded-full"
                      style={{ width: `${area.availability}%` }}
                    />
                  </div>
                </div>
                
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-white/60 text-xs">Performance</span>
                    <span className="text-[#FFB86C]">{area.performance.toFixed(1)}%</span>
                  </div>
                  <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-[#FFB86C] rounded-full"
                      style={{ width: `${area.performance}%` }}
                    />
                  </div>
                </div>
                
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-white/60 text-xs">Quality</span>
                    <span className="text-[#9580FF]">{area.quality.toFixed(1)}%</span>
                  </div>
                  <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-[#9580FF] rounded-full"
                      style={{ width: `${area.quality}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

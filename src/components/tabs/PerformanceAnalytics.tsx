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

type TimeRange = 'shift' | 'today' | 'yesterday' | 'last7' | 'month';


export function PerformanceAnalytics() {
  const { machines, loading: machinesLoading } = useMachines();
  const { kpis, loading: kpisLoading } = useGlobalKPIs();
  const { orders } = useProductionOrders();
  const { areas } = useProductionAreas();
  const [timeRange, setTimeRange] = useState<TimeRange>('today');
  const [selectedArea, setSelectedArea] = useState<string>('all');
  const [analyticsLayer, setAnalyticsLayer] = useState<'overview' | 'detail'>('overview');
  const [detailFocus, setDetailFocus] = useState<'six-big-losses'>('six-big-losses');
  const [exporting, setExporting] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const exportMenuRef = useRef<HTMLDivElement>(null);
  const maxOeePoints = 60;
  const maxTrendPoints = 60;
  const [oeeSeries, setOeeSeries] = useState<
    Array<{
      time: string;
      timestamp: number;
      oee: number;
      availability: number;
      performance: number;
      quality: number;
    }>
  >([]);
  const [productionRateSeries, setProductionRateSeries] = useState<
    Array<{
      time: string;
      timestamp: number;
      rate: number;
      target: number;
    }>
  >([]);
  const [energySeries, setEnergySeries] = useState<
    Array<{
      time: string;
      timestamp: number;
      energy: number;
    }>
  >([]);
  const [analyticsData, setAnalyticsData] = useState<any | null>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [analyticsError, setAnalyticsError] = useState<string | null>(null);
  const [analyticsCachedAt, setAnalyticsCachedAt] = useState<string | null>(null);
  const [isLiveMode, setIsLiveMode] = useState(true);
  const getCurrentShiftMeta = () => {
    const now = new Date();
    const hour = now.getHours();
    let shiftNum = '3';
    let shiftDateLocal = new Date(now);
    if (hour >= 6 && hour < 14) {
      shiftNum = '1';
    } else if (hour >= 14 && hour < 22) {
      shiftNum = '2';
    } else {
      shiftNum = '3';
      if (hour < 6) {
        shiftDateLocal = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      }
    }
    return {
      shiftNumber: shiftNum,
      shiftDate: shiftDateLocal.toISOString().slice(0, 10),
    };
  };

  const currentShiftMeta = getCurrentShiftMeta();
  const [shiftDate, setShiftDate] = useState<string>(currentShiftMeta.shiftDate);
  const [shiftNumber, setShiftNumber] = useState<string>(currentShiftMeta.shiftNumber);
  
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

  // Load analytics from backend cache
  useEffect(() => {
    let isMounted = true;

    const fetchAnalytics = async () => {
      try {
        setAnalyticsLoading(true);
        const response = await apiClient.getAnalytics(
          timeRange,
          selectedArea,
          undefined,
          timeRange === 'shift' ? shiftDate : undefined,
          timeRange === 'shift' ? shiftNumber : undefined
        );
        if (!isMounted) return;
        if (response.success && response.data) {
          setAnalyticsData(response.data);
          setAnalyticsCachedAt(response.timestamp || new Date().toISOString());
          setAnalyticsError(null);
        } else {
          setAnalyticsError(response.message || 'Failed to load analytics');
        }
      } catch (error) {
        if (isMounted) {
          setAnalyticsError(error instanceof Error ? error.message : 'Failed to load analytics');
        }
      } finally {
        if (isMounted) {
          setAnalyticsLoading(false);
        }
      }
    };

    fetchAnalytics();
    if (!isLiveMode) {
      return () => {
        isMounted = false;
      };
    }
    const interval = setInterval(fetchAnalytics, 60000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [isLiveMode, selectedArea, shiftDate, shiftNumber, timeRange]);

  const roundOneDecimal = (value: number) =>
    Number.isFinite(value) ? Math.round(value * 10) / 10 : 0;

  const formatOneDecimal = (value: number) =>
    Number.isFinite(value) ? value.toFixed(1) : '--';

  // Append real-time OEE snapshots as data arrives (no client-side simulation)
  useEffect(() => {
    const now = new Date();
    const point = {
      time: now.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      }),
      timestamp: now.getTime(),
      oee: roundOneDecimal(oeeMetrics.oee),
      availability: roundOneDecimal(oeeMetrics.availability),
      performance: roundOneDecimal(oeeMetrics.performance),
      quality: roundOneDecimal(oeeMetrics.quality),
    };

    setOeeSeries((prev) => {
      const last = prev[prev.length - 1];
      const isDuplicate =
        last &&
        last.oee === point.oee &&
        last.availability === point.availability &&
        last.performance === point.performance &&
        last.quality === point.quality &&
        point.timestamp - last.timestamp < 1000;

      if (isDuplicate) return prev;

      const next = [...prev, point];
      if (next.length > maxOeePoints) {
        next.splice(0, next.length - maxOeePoints);
      }
      return next;
    });
  }, [oeeMetrics]);

  // Append real-time production rate snapshots from live machine data
  useEffect(() => {
    const now = new Date();
    const avgSpeed =
      machines && machines.length > 0
        ? machines.reduce((sum, m) => sum + (m.lineSpeed || 0), 0) / machines.length
        : 0;
    const targetSpeed =
      machines && machines.length > 0
        ? machines.reduce((sum, m) => sum + (m.targetSpeed || 0), 0) / machines.length
        : 0;
    const point = {
      time: now.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      }),
      timestamp: now.getTime(),
      rate: roundOneDecimal(avgSpeed),
      target: roundOneDecimal(targetSpeed),
    };

    setProductionRateSeries((prev) => {
      const last = prev[prev.length - 1];
      const isDuplicate =
        last &&
        last.rate === point.rate &&
        last.target === point.target &&
        point.timestamp - last.timestamp < 1000;

      if (isDuplicate) return prev;

      const next = [...prev, point];
      if (next.length > maxTrendPoints) {
        next.splice(0, next.length - maxTrendPoints);
      }
      return next;
    });
  }, [machines]);

  // Append real-time energy snapshots from live machine data
  useEffect(() => {
    const now = new Date();
    const totalEnergy =
      machines && machines.length > 0
        ? machines.reduce((sum, m) => {
            const energyValue = (m as any).energyConsumption;
            if (typeof energyValue === 'number') {
              return sum + energyValue;
            }
            return sum + (m.power || 0);
          }, 0)
        : 0;
    const point = {
      time: now.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      }),
      timestamp: now.getTime(),
      energy: roundOneDecimal(totalEnergy),
    };

    setEnergySeries((prev) => {
      const last = prev[prev.length - 1];
      const isDuplicate =
        last &&
        last.energy === point.energy &&
        point.timestamp - last.timestamp < 1000;

      if (isDuplicate) return prev;

      const next = [...prev, point];
      if (next.length > maxTrendPoints) {
        next.splice(0, next.length - maxTrendPoints);
      }
      return next;
    });
  }, [machines]);

  const latestOeePoint = oeeSeries[oeeSeries.length - 1];
  const latestRatePoint = productionRateSeries[productionRateSeries.length - 1];
  const latestEnergyPoint = energySeries[energySeries.length - 1];
  const timeRangeLabels: Record<TimeRange, string> = {
    shift: 'Shift',
    today: 'Today',
    yesterday: 'Yesterday',
    last7: 'Last 7 Days',
    month: 'Month',
  };
  const analyticsOeeSummary = analyticsData?.oeeSummary;
  const analyticsOutputSummary = analyticsData?.outputSummary;
  const analyticsNgTrend = (analyticsData?.ngTrend ?? []).length > 0
    ? analyticsData?.ngTrend
    : [];
  const analyticsProductionRateTrend = (analyticsData?.productionRateTrend ?? []).length > 0
    ? analyticsData?.productionRateTrend
    : productionRateSeries;
  const analyticsEnergyTrend = (analyticsData?.energyTrend ?? []).length > 0
    ? analyticsData?.energyTrend
    : energySeries;
  const analyticsPlannedVsActual = analyticsData?.plannedVsActual;
  const analyticsTemperatureStability = analyticsData?.temperatureStability;
  const oeeTrendData = (analyticsData?.oeeTrend ?? []).length > 0
    ? analyticsData?.oeeTrend
    : oeeSeries;
  const isHistoricalRange = !isLiveMode;

  const ngMetrics = useMemo(() => {
    if (isHistoricalRange && analyticsOutputSummary) {
      return {
        totalNG: analyticsOutputSummary.totalNg || 0,
        totalOK: analyticsOutputSummary.totalOk || 0,
        totalLength: analyticsOutputSummary.totalLength || 0,
        ngRate: analyticsOutputSummary.ngRate || 0,
      };
    }
    if (!machines || machines.length === 0) {
      return { totalNG: 0, totalOK: 0, totalLength: 0, ngRate: 0 };
    }

    let totalNG = 0;
    let totalOK = 0;
    let totalLength = 0;

    machines.forEach(machine => {
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
  }, [analyticsOutputSummary, isHistoricalRange, machines]);

  useEffect(() => {
    if (
      isLiveMode &&
      (timeRange !== 'shift' ||
        shiftDate !== currentShiftMeta.shiftDate ||
        shiftNumber !== currentShiftMeta.shiftNumber)
    ) {
      setIsLiveMode(false);
    }
  }, [currentShiftMeta.shiftDate, currentShiftMeta.shiftNumber, isLiveMode, shiftDate, shiftNumber, timeRange]);


  const formatTimeLabel = (value: string) => {
    if (!value) return value;
    const parts = value.split(' ');
    if (parts.length < 2) return value;
    const timeParts = parts[0].split(':');
    if (timeParts.length < 2) return value;
    return `${timeParts[0]}:${timeParts[1]} ${parts[1]}`;
  };

  const formatOeeTooltip = (value: any, name: string) => {
    if (typeof value !== 'number') return [value, name];
    const labelMap: Record<string, string> = {
      oee: 'OEE',
      availability: 'Availability',
      performance: 'Performance',
      quality: 'Quality',
    };
    return [`${value.toFixed(1)}%`, labelMap[name] || name];
  };

  const renderOeeLastDot = (props: any) => {
    const { cx, cy, index, payload } = props;
    if (index !== oeeSeries.length - 1 || cx === undefined || cy === undefined) {
      return null;
    }
    return (
      <g>
        <circle cx={cx} cy={cy} r={7} fill="#4FFFBC" opacity={0.15} />
        <circle cx={cx} cy={cy} r={4} fill="#4FFFBC" stroke="#0E2F4F" strokeWidth={2} />
        <text
          x={cx + 10}
          y={cy - 10}
          fill="#4FFFBC"
          fontSize={12}
          fontWeight={600}
        >
          {formatOneDecimal(payload.oee)}%
        </text>
      </g>
    );
  };

  const formatRateTooltip = (value: any, name: string) => {
    if (typeof value !== 'number') return [value, name];
    if (name === 'target') return [`${value.toFixed(1)} m/min`, 'Target'];
    return [`${value.toFixed(1)} m/min`, 'Rate'];
  };

  const formatEnergyTooltip = (value: any) => {
    if (typeof value !== 'number') return [value, 'Energy'];
    return [`${value.toFixed(1)} kWh`, 'Energy'];
  };

  const renderRateLastDot = (props: any) => {
    const { cx, cy, index, payload } = props;
    if (index !== productionRateSeries.length - 1 || cx === undefined || cy === undefined) {
      return null;
    }
    return (
      <g>
        <circle cx={cx} cy={cy} r={7} fill="#4FFFBC" opacity={0.15} />
        <circle cx={cx} cy={cy} r={4} fill="#4FFFBC" stroke="#0E2F4F" strokeWidth={2} />
        <text
          x={cx + 10}
          y={cy - 10}
          fill="#4FFFBC"
          fontSize={12}
          fontWeight={600}
        >
          {formatOneDecimal(payload.rate)} m/min
        </text>
      </g>
    );
  };

  const renderEnergyLastDot = (props: any) => {
    const { cx, cy, index, payload } = props;
    if (index !== energySeries.length - 1 || cx === undefined || cy === undefined) {
      return null;
    }
    return (
      <g>
        <circle cx={cx} cy={cy} r={7} fill="#34E7F8" opacity={0.15} />
        <circle cx={cx} cy={cy} r={4} fill="#34E7F8" stroke="#0E2F4F" strokeWidth={2} />
        <text
          x={cx + 10}
          y={cy - 10}
          fill="#34E7F8"
          fontSize={12}
          fontWeight={600}
        >
          {formatOneDecimal(payload.energy)} kWh
        </text>
      </g>
    );
  };

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

  const sixBigLosses = analyticsData?.sixBigLosses ?? [];
  const paretoByCategory = analyticsData?.pareto?.byCategory ?? [];
  const paretoByMachine = analyticsData?.pareto?.byMachine ?? [];
  const paretoByArea = analyticsData?.pareto?.byArea ?? [];
  const paretoByShift = analyticsData?.pareto?.byShift ?? [];
  const lossRanking = analyticsData?.lossRanking ?? [];
  const rootCauseInsights = analyticsData?.rootCauseContributors ?? [];
  const lossAnomalies = analyticsData?.anomalies ?? [];
  const lossByMachine = analyticsData?.breakdowns?.byMachine ?? [];
  const lossByOrder = analyticsData?.breakdowns?.byOrder ?? [];
  const lossTrendSeries = (analyticsData?.lossTrend ?? []).map((entry: any) => ({
    time: new Date(entry.timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
    totalLoss: entry.totalLoss,
  }));
  const aiInsightSummary = analyticsData?.insights?.summary || 'No validated loss data available yet.';

  const lossActionPlanMap = [
      {
        category: 'Equipment Failure',
      oeeComponent: 'Availability',
      action: 'Maintenance action (preventive + corrective)',
      priority: 'High',
      },
      {
        category: 'Setup & Adjustments',
      oeeComponent: 'Availability',
      action: 'Setup optimization / SMED',
      priority: 'Medium',
      },
      {
        category: 'Idling & Minor Stops',
      oeeComponent: 'Performance',
      action: 'Operator + process standardization',
      priority: 'Medium',
      },
      {
        category: 'Reduced Speed',
      oeeComponent: 'Performance',
      action: 'Parameter tuning + bottleneck removal',
      priority: 'High',
      },
      {
        category: 'Process Defects',
      oeeComponent: 'Quality',
      action: 'Process quality improvement',
      priority: 'High',
      },
      {
        category: 'Reduced Yield',
      oeeComponent: 'Quality',
      action: 'Standardized startup procedure',
      priority: 'Medium',
    },
  ];


  const ngTrendData = useMemo(() => {
    if (analyticsNgTrend.length > 0) return analyticsNgTrend;
    if (ngMetrics.totalLength > 0) {
      return [
        {
          time: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
          ngRate: ngMetrics.ngRate,
          ngLength: ngMetrics.totalNG,
        },
      ];
    }
    return [];
  }, [analyticsNgTrend, ngMetrics]);

  const plannedVsActual = useMemo(() => {
    if (isHistoricalRange && analyticsPlannedVsActual) return analyticsPlannedVsActual;
    if (!orders || orders.length === 0) return { planned: 0, actual: 0, variance: 0 };

    const planned = orders.reduce((sum, order) => sum + (order.targetLength || 0), 0);
    const actual = orders.reduce((sum, order) => sum + (order.producedLength || 0), 0);
    const variance = planned > 0 ? ((actual - planned) / planned) * 100 : 0;

    return {
      planned: Math.round(planned * 100) / 100,
      actual: Math.round(actual * 100) / 100,
      variance: Math.round(variance * 100) / 100,
    };
  }, [analyticsPlannedVsActual, isHistoricalRange, orders]);

  const temperatureStability = useMemo(() => {
    if (isHistoricalRange && analyticsTemperatureStability) return analyticsTemperatureStability;
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
    const stability = Math.max(0, 100 - (avgVariance * 2));

    return {
      avgVariance: Math.round(avgVariance * 100) / 100,
      stability: Math.round(stability * 100) / 100,
    };
  }, [analyticsTemperatureStability, isHistoricalRange, machines]);

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

  const handleRecalculateAnalytics = async () => {
    try {
      setAnalyticsLoading(true);
      const response = await apiClient.recalculateAnalytics(
        timeRange,
        selectedArea,
        undefined,
        timeRange === 'shift' ? shiftDate : undefined,
        timeRange === 'shift' ? shiftNumber : undefined
      );
      if (response.success && response.data) {
        setAnalyticsData(response.data);
        setAnalyticsCachedAt(response.timestamp || new Date().toISOString());
        setAnalyticsError(null);
      } else {
        setAnalyticsError(response.message || 'Failed to recalculate analytics');
      }
    } catch (error) {
      setAnalyticsError(error instanceof Error ? error.message : 'Failed to recalculate analytics');
    } finally {
      setAnalyticsLoading(false);
    }
  };

  return (
    <div ref={containerRef} className="space-y-6">
      {/* Header with Time Range Selector and Export Buttons */}
      <div className="flex items-center justify-between mb-4 mobile-stack">
        <div className="flex items-center gap-2">
          <Calendar className="w-5 h-5 text-[#34E7F8]" />
          <h2 className="text-xl text-white font-semibold">Analytics Dashboard</h2>
          <span className={`text-xs px-2 py-1 rounded-full border ${
            isLiveMode
              ? 'text-[#4FFFBC] border-[#4FFFBC]/50 bg-[#4FFFBC]/10'
              : 'text-[#FFB86C] border-[#FFB86C]/50 bg-[#FFB86C]/10'
          }`}>
            {isLiveMode ? 'LIVE' : 'HISTORY'}
          </span>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          {/* Time Range Selector */}
          <div className="flex gap-2 flex-wrap">
            {(['shift', 'today', 'yesterday', 'last7', 'month'] as TimeRange[]).map((range) => (
              <button
                key={range}
                onClick={() => {
                  setTimeRange(range);
                  if (range !== 'shift') {
                    setIsLiveMode(false);
                  }
                }}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  timeRange === range
                    ? 'bg-[#34E7F8]/30 text-[#34E7F8] border border-[#34E7F8]/50'
                    : 'bg-white/5 text-white/60 border border-white/10 hover:bg-white/10'
                }`}
              >
                {timeRangeLabels[range]}
              </button>
            ))}
          </div>

          {/* Shift Selector */}
          {timeRange === 'shift' && (
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={shiftDate}
                onChange={(event) => {
                  setShiftDate(event.target.value);
                  setIsLiveMode(false);
                }}
                className="px-3 py-2 rounded-lg bg-white/5 text-white/80 border border-white/10"
              />
              <select
                value={shiftNumber}
                onChange={(event) => {
                  setShiftNumber(event.target.value);
                  setIsLiveMode(false);
                }}
                className="px-3 py-2 rounded-lg bg-white/5 text-white/80 border border-white/10"
              >
                <option value="1">Shift 1 (06-14)</option>
                <option value="2">Shift 2 (14-22)</option>
                <option value="3">Shift 3 (22-06)</option>
              </select>
            </div>
          )}

          <button
            onClick={() => {
              const currentShift = getCurrentShiftMeta();
              setTimeRange('shift');
              setShiftDate(currentShift.shiftDate);
              setShiftNumber(currentShift.shiftNumber);
              setIsLiveMode(true);
            }}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
              isLiveMode
                ? 'bg-[#4FFFBC]/30 text-[#4FFFBC] border border-[#4FFFBC]/50'
                : 'bg-white/5 text-white/60 border border-white/10 hover:bg-white/10'
            }`}
          >
            LIVE
          </button>
          
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

      {analyticsLayer === 'overview' ? (
        <>
      {/* OEE Summary Cards */}
      <div className="grid gap-4 responsive-grid-4">
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
              <div className="text-3xl text-[#34E7F8]">
                {((isHistoricalRange ? analyticsOeeSummary?.oee : oeeMetrics.oee) ?? oeeMetrics.oee).toFixed(1)}%
              </div>
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
              <div className="text-3xl text-[#4FFFBC]">
                {((isHistoricalRange ? analyticsOeeSummary?.availability : oeeMetrics.availability) ?? oeeMetrics.availability).toFixed(1)}%
              </div>
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
              <div className="text-3xl text-[#FFB86C]">
                {((isHistoricalRange ? analyticsOeeSummary?.performance : oeeMetrics.performance) ?? oeeMetrics.performance).toFixed(1)}%
              </div>
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
              <div className="text-3xl text-[#9580FF]">
                {((isHistoricalRange ? analyticsOeeSummary?.quality : oeeMetrics.quality) ?? oeeMetrics.quality).toFixed(1)}%
              </div>
              <div className="text-white/40 text-xs mt-1">OK Length / Total Length</div>
            </>
          )}
        </div>
      </div>

      {/* NG Metrics Cards */}
      <div className="grid gap-4 responsive-grid-4">
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
      <div className="grid gap-4 responsive-grid-2">
        {/* OEE Trend Chart */}
        <div 
          className="rounded-2xl bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-xl border border-white/20 shadow-2xl p-5"
          data-chart-export
          data-chart-title="OEE Trend"
        >
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="w-5 h-5 text-[#34E7F8]" />
            <h3 className="text-white font-semibold">OEE Trend ({timeRangeLabels[timeRange]})</h3>
            <div className="ml-auto flex items-center gap-3">
              <div className="flex items-center gap-2 text-xs text-[#4FFFBC]">
                <span className="inline-flex h-2 w-2 rounded-full bg-[#4FFFBC] animate-pulse" />
                LIVE
              </div>
              <div className="text-sm text-white/80">
                Current: <span className="text-[#4FFFBC] font-semibold">{formatOneDecimal(latestOeePoint?.oee ?? 0)}%</span>
              </div>
            </div>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={isHistoricalRange ? oeeTrendData : oeeSeries}>
                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
                <XAxis 
                  dataKey="time" 
                  stroke="#ffffff40" 
                  tick={{ fill: '#ffffff80', fontSize: 11 }}
                  tickFormatter={formatTimeLabel}
                  interval="preserveStartEnd"
                  minTickGap={24}
                />
                <YAxis 
                  stroke="#ffffff40" 
                  tick={{ fill: '#ffffff80', fontSize: 11 }}
                  tickFormatter={(value: number) => `${value}%`}
                  domain={[0, 100]}
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: '#0E2F4F', 
                    border: '1px solid rgba(255,255,255,0.2)',
                    borderRadius: '8px',
                    fontSize: '12px'
                  }}
                  formatter={formatOeeTooltip}
                />
                <Legend />
                {latestOeePoint && (
                  <ReferenceLine
                    y={latestOeePoint.oee}
                    stroke="#4FFFBC"
                    strokeDasharray="4 4"
                    label={{
                      value: `Live ${formatOneDecimal(latestOeePoint.oee)}%`,
                      position: 'right',
                      fill: '#4FFFBC',
                      fontSize: 11,
                    }}
                  />
                )}
                <Area 
                  type="monotone" 
                  dataKey="oee" 
                  fill="#34E7F8" 
                  fillOpacity={0.2}
                  stroke="#34E7F8" 
                  strokeWidth={3.5}
                  isAnimationActive
                  animationDuration={400}
                  animationEasing="ease-in-out"
                />
                <Line 
                  type="monotone" 
                  dataKey="availability" 
                  stroke="#4FFFBC" 
                  strokeWidth={2}
                  strokeDasharray="5 5"
                  dot={false}
                  isAnimationActive
                  animationDuration={400}
                  animationEasing="ease-in-out"
                />
                <Line 
                  type="monotone" 
                  dataKey="performance" 
                  stroke="#FFB86C" 
                  strokeWidth={2}
                  strokeDasharray="5 5"
                  dot={false}
                  isAnimationActive
                  animationDuration={400}
                  animationEasing="ease-in-out"
                />
                <Line 
                  type="monotone" 
                  dataKey="quality" 
                  stroke="#9580FF" 
                  strokeWidth={2}
                  strokeDasharray="5 5"
                  dot={false}
                  isAnimationActive
                  animationDuration={400}
                  animationEasing="ease-in-out"
                />
                <Line
                  type="monotone"
                  dataKey="oee"
                  stroke="#4FFFBC"
                  strokeWidth={0}
                  dot={renderOeeLastDot}
                  activeDot={{ r: 6, stroke: '#4FFFBC', strokeWidth: 2, fill: '#0E2F4F' }}
                  isAnimationActive={false}
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
      <div className="grid gap-4 responsive-grid-2">
        {/* Six Big Losses */}
        <div 
          className="rounded-2xl bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-xl border border-white/20 shadow-2xl p-5 cursor-pointer hover:border-[#34E7F8]/60 transition-colors"
          data-chart-export
          data-chart-title="Six Big Losses Analysis"
          role="button"
          tabIndex={0}
          onClick={() => {
            setDetailFocus('six-big-losses');
            setAnalyticsLayer('detail');
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              setDetailFocus('six-big-losses');
              setAnalyticsLayer('detail');
            }
          }}
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
      <div className="grid gap-4 responsive-grid-2">
        {/* Production Rate Trend */}
        <div 
          className="rounded-2xl bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-xl border border-white/20 shadow-2xl p-5"
          data-chart-export
          data-chart-title="Production Rate Trend"
        >
          <div className="flex items-center gap-2 mb-4">
            <Activity className="w-5 h-5 text-[#4FFFBC]" />
            <h3 className="text-white font-semibold">Production Rate Trend</h3>
            <div className="ml-auto flex items-center gap-3">
              <div className="flex items-center gap-2 text-xs text-[#4FFFBC]">
                <span className="inline-flex h-2 w-2 rounded-full bg-[#4FFFBC] animate-pulse" />
                LIVE
              </div>
              <div className="text-sm text-white/80">
                Current: <span className="text-[#4FFFBC] font-semibold">{formatOneDecimal(latestRatePoint?.rate ?? 0)} m/min</span>
              </div>
            </div>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={isHistoricalRange ? analyticsProductionRateTrend : productionRateSeries}>
                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
                <XAxis 
                  dataKey="time" 
                  stroke="#ffffff40" 
                  tick={{ fill: '#ffffff80', fontSize: 11 }}
                  tickFormatter={formatTimeLabel}
                  interval="preserveStartEnd"
                  minTickGap={24}
                />
                <YAxis 
                  stroke="#ffffff40" 
                  tick={{ fill: '#ffffff80', fontSize: 11 }}
                  tickFormatter={(value: number) => `${value}`}
                  label={{ value: 'Speed (m/min)', angle: -90, position: 'insideLeft', fill: '#ffffff60' }}
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: '#0E2F4F', 
                    border: '1px solid rgba(255,255,255,0.2)',
                    borderRadius: '8px',
                    fontSize: '12px'
                  }}
                  formatter={formatRateTooltip}
                />
                <Legend />
                <defs>
                  <linearGradient id="rateGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#4FFFBC" stopOpacity={0.4}/>
                    <stop offset="100%" stopColor="#4FFFBC" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                {latestRatePoint && (
                  <ReferenceLine
                    y={latestRatePoint.rate}
                    stroke="#4FFFBC"
                    strokeDasharray="4 4"
                    label={{
                      value: `Live ${formatOneDecimal(latestRatePoint.rate)} m/min`,
                      position: 'right',
                      fill: '#4FFFBC',
                      fontSize: 11,
                    }}
                  />
                )}
                <Area 
                  type="monotone" 
                  dataKey="rate" 
                  fill="url(#rateGradient)"
                  stroke="#4FFFBC" 
                  strokeWidth={3.5}
                  isAnimationActive
                  animationDuration={400}
                  animationEasing="ease-in-out"
                />
                <Line 
                  type="monotone" 
                  dataKey="target" 
                  stroke="#ffffff40" 
                  strokeWidth={2}
                  strokeDasharray="5 5"
                  dot={false}
                  isAnimationActive
                  animationDuration={400}
                  animationEasing="ease-in-out"
                />
                <Line
                  type="monotone"
                  dataKey="rate"
                  stroke="#4FFFBC"
                  strokeWidth={0}
                  dot={renderRateLastDot}
                  activeDot={{ r: 6, stroke: '#4FFFBC', strokeWidth: 2, fill: '#0E2F4F' }}
                  isAnimationActive={false}
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
            <div className="ml-auto flex items-center gap-3">
              <div className="flex items-center gap-2 text-xs text-[#34E7F8]">
                <span className="inline-flex h-2 w-2 rounded-full bg-[#34E7F8] animate-pulse" />
                LIVE
              </div>
              <div className="text-sm text-white/80">
                Current: <span className="text-[#34E7F8] font-semibold">{formatOneDecimal(latestEnergyPoint?.energy ?? 0)} kWh</span>
              </div>
            </div>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={isHistoricalRange ? analyticsEnergyTrend : energySeries}>
                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
                <XAxis 
                  dataKey="time" 
                  stroke="#ffffff40" 
                  tick={{ fill: '#ffffff80', fontSize: 11 }}
                  tickFormatter={formatTimeLabel}
                  interval="preserveStartEnd"
                  minTickGap={24}
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
                  formatter={formatEnergyTooltip}
                />
                <defs>
                  <linearGradient id="energyGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#34E7F8" stopOpacity={0.4}/>
                    <stop offset="100%" stopColor="#34E7F8" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                {latestEnergyPoint && (
                  <ReferenceLine
                    y={latestEnergyPoint.energy}
                    stroke="#34E7F8"
                    strokeDasharray="4 4"
                    label={{
                      value: `Live ${formatOneDecimal(latestEnergyPoint.energy)} kWh`,
                      position: 'right',
                      fill: '#34E7F8',
                      fontSize: 11,
                    }}
                  />
                )}
                <Area 
                  type="monotone" 
                  dataKey="energy" 
                  fill="url(#energyGradient)"
                  stroke="#34E7F8" 
                  strokeWidth={3.5}
                  isAnimationActive
                  animationDuration={400}
                  animationEasing="ease-in-out"
                />
                <Line
                  type="monotone"
                  dataKey="energy"
                  stroke="#34E7F8"
                  strokeWidth={0}
                  dot={renderEnergyLastDot}
                  activeDot={{ r: 6, stroke: '#34E7F8', strokeWidth: 2, fill: '#0E2F4F' }}
                  isAnimationActive={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Planned vs Actual and Temperature Stability */}
      <div className="grid gap-4 responsive-grid-2">
        {/* Planned vs Actual Production */}
        <div className="rounded-2xl bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-xl border border-white/20 shadow-2xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <Target className="w-5 h-5 text-[#FFB86C]" />
            <h3 className="text-white font-semibold">Planned vs Actual Production</h3>
          </div>
          <div className="space-y-4">
            <div className="grid gap-4 responsive-grid-2">
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
        <div className="grid gap-4 responsive-grid-3">
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
        </>
      ) : (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setAnalyticsLayer('overview')}
                className="px-3 py-2 rounded-lg bg-white/10 text-white/80 hover:bg-white/20 transition-all"
              >
                ← Back to Overview
              </button>
              <div>
                <div className="text-white text-lg font-semibold">AI Analytics Detail</div>
                <div className="text-white/50 text-xs">Validated MES analytics with explainable AI logic</div>
              </div>
            </div>
            <button
              onClick={handleRecalculateAnalytics}
              disabled={analyticsLoading}
              className="px-3 py-2 rounded-lg bg-[#34E7F8]/20 text-[#34E7F8] border border-[#34E7F8]/50 hover:bg-[#34E7F8]/30 transition-all text-xs disabled:opacity-50"
            >
              Recalculate Now
            </button>
            <div className="text-xs text-white/60">
              {analyticsLoading
                ? 'Loading analytics…'
                : analyticsError || (isLiveMode ? 'Live refresh enabled' : `Cached ${analyticsCachedAt ? new Date(analyticsCachedAt).toLocaleTimeString() : 'now'}`)}
            </div>
          </div>

          {/* AI Insight Summary */}
          <div className="rounded-2xl bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-xl border border-white/20 shadow-2xl p-5">
            <div className="flex items-center gap-2 mb-3">
              <AlertCircle className="w-5 h-5 text-[#FFB86C]" />
              <h3 className="text-white font-semibold">AI Insight Summary</h3>
            </div>
            <div className="text-white/80">{aiInsightSummary}</div>
          </div>

          {/* OEE & Loss Trends */}
          <div className="grid gap-4 responsive-grid-2">
            <div className="rounded-2xl bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-xl border border-white/20 shadow-2xl p-5">
              <div className="flex items-center gap-2 mb-4">
                <TrendingUp className="w-5 h-5 text-[#34E7F8]" />
                <h3 className="text-white font-semibold">OEE Trend (Live)</h3>
              </div>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={isHistoricalRange ? oeeTrendData : oeeSeries}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
                    <XAxis dataKey="time" stroke="#ffffff40" tick={{ fill: '#ffffff80', fontSize: 10 }} />
                    <YAxis stroke="#ffffff40" tick={{ fill: '#ffffff80', fontSize: 11 }} domain={[0, 100]} />
                    <Tooltip contentStyle={{ backgroundColor: '#0E2F4F', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '8px', fontSize: '12px' }} />
                    <Area type="monotone" dataKey="oee" stroke="#34E7F8" fill="#34E7F8" fillOpacity={0.2} strokeWidth={3} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div className="rounded-2xl bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-xl border border-white/20 shadow-2xl p-5">
              <div className="flex items-center gap-2 mb-4">
                <TrendingDown className="w-5 h-5 text-[#FFB86C]" />
                <h3 className="text-white font-semibold">Total Loss Trend</h3>
              </div>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={lossTrendSeries}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
                    <XAxis dataKey="time" stroke="#ffffff40" tick={{ fill: '#ffffff80', fontSize: 10 }} />
                    <YAxis stroke="#ffffff40" tick={{ fill: '#ffffff80', fontSize: 11 }} />
                    <Tooltip contentStyle={{ backgroundColor: '#0E2F4F', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '8px', fontSize: '12px' }} />
                    <Area type="monotone" dataKey="totalLoss" stroke="#FFB86C" fill="#FFB86C" fillOpacity={0.2} strokeWidth={3} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Pareto Analysis */}
          <div className="grid gap-4 responsive-grid-2">
            <div className="rounded-2xl bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-xl border border-white/20 shadow-2xl p-5">
              <div className="flex items-center gap-2 mb-4">
                <BarChart3 className="w-5 h-5 text-[#34E7F8]" />
                <h3 className="text-white font-semibold">Pareto by Loss Category</h3>
              </div>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={paretoByCategory}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
                    <XAxis dataKey="label" stroke="#ffffff40" tick={{ fill: '#ffffff80', fontSize: 10 }} />
                    <YAxis yAxisId="left" stroke="#ffffff40" tick={{ fill: '#ffffff80', fontSize: 11 }} />
                    <YAxis yAxisId="right" orientation="right" domain={[0, 100]} stroke="#ffffff40" tick={{ fill: '#ffffff80', fontSize: 11 }} />
                    <Tooltip contentStyle={{ backgroundColor: '#0E2F4F', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '8px', fontSize: '12px' }} />
                    <Bar yAxisId="left" dataKey="value" fill="#34E7F8" radius={[4, 4, 0, 0]} />
                    <Line yAxisId="right" type="monotone" dataKey="cumulative" stroke="#FFB86C" strokeWidth={2} dot={false} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div className="rounded-2xl bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-xl border border-white/20 shadow-2xl p-5">
              <div className="flex items-center gap-2 mb-4">
                <BarChart3 className="w-5 h-5 text-[#4FFFBC]" />
                <h3 className="text-white font-semibold">Pareto by Machine</h3>
              </div>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={paretoByMachine}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
                    <XAxis dataKey="label" stroke="#ffffff40" tick={{ fill: '#ffffff80', fontSize: 10 }} />
                    <YAxis yAxisId="left" stroke="#ffffff40" tick={{ fill: '#ffffff80', fontSize: 11 }} />
                    <YAxis yAxisId="right" orientation="right" domain={[0, 100]} stroke="#ffffff40" tick={{ fill: '#ffffff80', fontSize: 11 }} />
                    <Tooltip contentStyle={{ backgroundColor: '#0E2F4F', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '8px', fontSize: '12px' }} />
                    <Bar yAxisId="left" dataKey="value" fill="#4FFFBC" radius={[4, 4, 0, 0]} />
                    <Line yAxisId="right" type="monotone" dataKey="cumulative" stroke="#FFB86C" strokeWidth={2} dot={false} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          <div className="grid gap-4 responsive-grid-2">
            <div className="rounded-2xl bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-xl border border-white/20 shadow-2xl p-5">
              <div className="flex items-center gap-2 mb-4">
                <BarChart3 className="w-5 h-5 text-[#FFB86C]" />
                <h3 className="text-white font-semibold">Pareto by Area</h3>
              </div>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={paretoByArea}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
                    <XAxis dataKey="label" stroke="#ffffff40" tick={{ fill: '#ffffff80', fontSize: 10 }} />
                    <YAxis yAxisId="left" stroke="#ffffff40" tick={{ fill: '#ffffff80', fontSize: 11 }} />
                    <YAxis yAxisId="right" orientation="right" domain={[0, 100]} stroke="#ffffff40" tick={{ fill: '#ffffff80', fontSize: 11 }} />
                    <Tooltip contentStyle={{ backgroundColor: '#0E2F4F', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '8px', fontSize: '12px' }} />
                    <Bar yAxisId="left" dataKey="value" fill="#FFB86C" radius={[4, 4, 0, 0]} />
                    <Line yAxisId="right" type="monotone" dataKey="cumulative" stroke="#4FFFBC" strokeWidth={2} dot={false} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div className="rounded-2xl bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-xl border border-white/20 shadow-2xl p-5">
              <div className="flex items-center gap-2 mb-4">
                <BarChart3 className="w-5 h-5 text-[#9580FF]" />
                <h3 className="text-white font-semibold">Pareto by Shift</h3>
              </div>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={paretoByShift}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
                    <XAxis dataKey="label" stroke="#ffffff40" tick={{ fill: '#ffffff80', fontSize: 10 }} />
                    <YAxis yAxisId="left" stroke="#ffffff40" tick={{ fill: '#ffffff80', fontSize: 11 }} />
                    <YAxis yAxisId="right" orientation="right" domain={[0, 100]} stroke="#ffffff40" tick={{ fill: '#ffffff80', fontSize: 11 }} />
                    <Tooltip contentStyle={{ backgroundColor: '#0E2F4F', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '8px', fontSize: '12px' }} />
                    <Bar yAxisId="left" dataKey="value" fill="#9580FF" radius={[4, 4, 0, 0]} />
                    <Line yAxisId="right" type="monotone" dataKey="cumulative" stroke="#34E7F8" strokeWidth={2} dot={false} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Loss Breakdown */}
          <div className="grid gap-4 responsive-grid-3">
            <div className="rounded-2xl bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-xl border border-white/20 shadow-2xl p-5">
              <div className="text-white font-semibold mb-3">Loss by Machine</div>
              <div className="space-y-2">
                {lossByMachine.slice(0, 6).map((item) => (
                  <div key={item.label} className="flex items-center justify-between text-sm text-white/70">
                    <span>{item.label}</span>
                    <span className="text-[#34E7F8]">{item.value.toFixed(2)}%</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="rounded-2xl bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-xl border border-white/20 shadow-2xl p-5">
              <div className="text-white font-semibold mb-3">Loss by Shift</div>
              <div className="space-y-2">
                {paretoByShift.slice(0, 3).map((item) => (
                  <div key={item.label} className="flex items-center justify-between text-sm text-white/70">
                    <span>{item.label}</span>
                    <span className="text-[#9580FF]">{item.value.toFixed(2)}%</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="rounded-2xl bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-xl border border-white/20 shadow-2xl p-5">
              <div className="text-white font-semibold mb-3">Loss by Order</div>
              <div className="space-y-2">
                {lossByOrder.length === 0 && (
                  <div className="text-white/50 text-sm">No active orders linked to loss data.</div>
                )}
                {lossByOrder.slice(0, 6).map((item) => (
                  <div key={item.label} className="flex items-center justify-between text-sm text-white/70">
                    <span>{item.label}</span>
                    <span className="text-[#FFB86C]">{item.value.toFixed(2)}%</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Root Cause + Ranking */}
          <div className="grid gap-4 responsive-grid-2">
            <div className="rounded-2xl bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-xl border border-white/20 shadow-2xl p-5">
              <div className="flex items-center gap-2 mb-4">
                <AlertTriangle className="w-5 h-5 text-[#FF4C4C]" />
                <h3 className="text-white font-semibold">Root Cause Contributors</h3>
              </div>
              <div className="space-y-3">
                {rootCauseInsights.length === 0 && (
                  <div className="text-white/60 text-sm">No dominant root-cause patterns detected yet.</div>
                )}
                {rootCauseInsights.slice(0, 6).map((cause, index) => (
                  <div key={`${cause.machineId}-${index}`} className="p-3 rounded-lg bg-white/5 border border-white/10">
                    <div className="text-white text-sm font-semibold">{cause.category}</div>
                    <div className="text-white/60 text-xs">{cause.machineName} · {cause.evidence}</div>
                  </div>
                ))}
              </div>
            </div>
            <div className="rounded-2xl bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-xl border border-white/20 shadow-2xl p-5">
              <div className="flex items-center gap-2 mb-4">
                <TrendingUp className="w-5 h-5 text-[#34E7F8]" />
                <h3 className="text-white font-semibold">Loss Ranking & Severity</h3>
              </div>
              <div className="space-y-3">
                {lossRanking.slice(0, 6).map((item, index) => (
                  <div key={`${item.machineId}-${item.category}-${index}`} className="p-3 rounded-lg bg-white/5 border border-white/10">
                    <div className="flex items-center justify-between">
                      <div className="text-white text-sm font-semibold">{item.category}</div>
                      <div className="text-[#FFB86C] text-xs">Severity {item.severity}</div>
                    </div>
                    <div className="text-white/60 text-xs">
                      {item.machineName} · Impact {item.impact.toFixed(2)}% · Duration {(item.duration / 60).toFixed(0)} min
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Anomalies */}
          <div className="rounded-2xl bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-xl border border-white/20 shadow-2xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <AlertCircle className="w-5 h-5 text-[#FFB86C]" />
              <h3 className="text-white font-semibold">Anomaly Detection</h3>
            </div>
            {lossAnomalies.length === 0 ? (
              <div className="text-white/60 text-sm">No loss anomalies detected in the current window.</div>
            ) : (
              <div className="grid gap-3 responsive-grid-3">
                {lossAnomalies.map((anomaly) => (
                  <div key={anomaly.category} className="p-3 rounded-lg bg-white/5 border border-white/10">
                    <div className="text-white text-sm font-semibold">{anomaly.category}</div>
                    <div className="text-white/60 text-xs">
                      Latest {anomaly.latestValue.toFixed(2)}% · Baseline {anomaly.mean.toFixed(2)}%
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Action Plan Mapping */}
          <div className="rounded-2xl bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-xl border border-white/20 shadow-2xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <Target className="w-5 h-5 text-[#34E7F8]" />
              <h3 className="text-white font-semibold">Six Big Losses → OEE → Action Plan</h3>
            </div>
            <div className="grid gap-3 responsive-grid-2">
              {lossActionPlanMap.map((item) => (
                <div key={item.category} className="p-3 rounded-lg bg-white/5 border border-white/10">
                  <div className="text-white text-sm font-semibold">{item.category}</div>
                  <div className="text-white/60 text-xs">OEE: {item.oeeComponent}</div>
                  <div className="text-white/60 text-xs">Action: {item.action}</div>
                  <div className="text-[#FFB86C] text-xs">Priority: {item.priority}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

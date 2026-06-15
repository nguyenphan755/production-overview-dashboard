import { useMemo, useState, useEffect, useRef, useCallback } from 'react';
import { ArrowLeft, User, Package, Activity, Target, TrendingUp, Gauge, Zap, Thermometer, Circle, Flame, Battery, History, Clock, CheckCircle, XCircle, AlertCircle, Layers, FileDown, ChevronDown, ChevronUp } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, Tooltip, Area, AreaChart, Legend, ComposedChart, Bar, BarChart, ReferenceLine } from 'recharts';
import { useMachineDetail } from '../../hooks/useProductionData';
import { useMachineDetailTrends } from '../../hooks/useMachineDetailTrends';
import { useEquipmentSpeedHistory } from '../../hooks/useEquipmentSpeedHistory';
import { useBobbinCutDetector, mergeCutsForOrder } from '../../hooks/useBobbinCutRecordsFixed';
import { effectiveProducedLengthOkM } from '../../utils/effectiveProducedLength';
import { apiClient } from '../../services/api';
import type { ProductionOrder, OrderBobbinRecord } from '../../types';
import { EquipmentOeeToolbar } from '../EquipmentOeeToolbar';
import {
  equipmentOeeModeLabelVi,
  pickMachineOee,
  type EquipmentOeeAnalyticsScope,
  type EquipmentOeeMode,
  type MachineOeeRollupRow,
} from '../../utils/equipmentOeeDisplay';
import { isUnknownLikeProductName, unknownLikeProductInlineStyle } from '../../utils/productNameDisplay';
import {
  buildOperationalStatesTimeline,
  type OperationalStatesGanttRow,
} from '../../utils/equipment-operational-states-timeline';
import { buildEquipmentSpeedHistoryQuery } from '../../utils/equipment-speed-history-query';
import {
  allocateEnergyByOrderOverlap,
  buildMeterDeltaBarChartFromTrend,
  resolveEnergyChartContext,
} from '../../utils/equipment-energy-chart';
import {
  buildSpeedChartRows,
  calculateSpeedTrendYDomain,
  findStableRunningSegments,
  formatSpeedDuration,
  resolveSpeedReferenceLines,
  speedUnitForArea,
  SPEED_PHASE_LEGEND,
} from '../../utils/equipment-speed-analysis-chart';
import { EquipmentSpeedTrendChart } from '../EquipmentSpeedTrendChart';
import { EquipmentSpeedProductNotes } from '../EquipmentSpeedProductNotes';
import '../../styles/equipment-speed-panel.css';

function isSameLocalDay(isoOrDate: string | Date, ref = new Date()) {
  const d = typeof isoOrDate === 'string' ? new Date(isoOrDate) : isoOrDate;
  return (
    d.getFullYear() === ref.getFullYear() &&
    d.getMonth() === ref.getMonth() &&
    d.getDate() === ref.getDate()
  );
}

function isOrderOnToday(order: ProductionOrder): boolean {
  if (order.status === 'running') return true;
  if (isSameLocalDay(order.startTime)) return true;
  if (order.endTime && isSameLocalDay(order.endTime)) return true;
  return false;
}

function filterBobbinCutsToday(cuts: OrderBobbinRecord[]) {
  return cuts.filter((cut) => isSameLocalDay(cut.recordedAt));
}

interface EquipmentDetailProps {
  machineId: string;
  onBack: () => void;
  equipmentOeeMode: EquipmentOeeMode;
  onEquipmentOeeModeChange: (mode: EquipmentOeeMode) => void;
  equipmentOeeRollupByMachine: Record<string, MachineOeeRollupRow>;
  equipmentOeeScope: EquipmentOeeAnalyticsScope;
  equipmentOeeRollupLoading: boolean;
  equipmentOeeRollupError: string | null;
  referenceDate: string;
  onReferenceDateChange: (isoDate: string) => void;
  pastIsoShiftNumber: 1 | 2 | 3;
  onPastIsoShiftNumberChange: (n: 1 | 2 | 3) => void;
  authToken?: string;
}

export function EquipmentDetail({
  machineId,
  onBack,
  equipmentOeeMode,
  onEquipmentOeeModeChange,
  equipmentOeeRollupByMachine,
  equipmentOeeScope,
  equipmentOeeRollupLoading,
  equipmentOeeRollupError,
  referenceDate,
  onReferenceDateChange,
  pastIsoShiftNumber,
  onPastIsoShiftNumberChange,
  authToken,
}: EquipmentDetailProps) {
  const { machine, loading } = useMachineDetail(machineId);
  const [exportHtmlBusy, setExportHtmlBusy] = useState(false);
  /** Ngày dùng cho xuất HTML (mặc định theo toolbar OEE; có thể đổi riêng cho báo cáo) */
  const [htmlReportLocalDate, setHtmlReportLocalDate] = useState(referenceDate);
  useEffect(() => {
    setHtmlReportLocalDate(referenceDate);
  }, [referenceDate]);

  // Dev helper: auto simulate 1 bobbin on LHT-1 for UI verification.
  // It only runs once per tab session (sessionStorage) when opening EquipmentDetail.
  const [simProducedLengthOk, setSimProducedLengthOk] = useState<number | null>(null);
  const machineForOkSimulation = useMemo(() => {
    if (!machine) return machine;
    if (simProducedLengthOk === null) return machine;
    return { ...machine, producedLengthOk: simProducedLengthOk };
  }, [machine, simProducedLengthOk]);

  useEffect(() => {
    if (!import.meta.env.DEV) return;
    if (!machine) return;
    if (!machine.name?.includes('LHT-1')) return;
    const key = `sim-bobbin-once:${machine.id}`;
    if (typeof sessionStorage !== 'undefined' && sessionStorage.getItem(key)) return;
    if (typeof sessionStorage !== 'undefined') sessionStorage.setItem(key, '1');

    // Kick: force producedLengthOk to <= 2m then restore.
    // This should trigger bobbin recording if EquipmentDetail bobbin detector is mounted.
    const t1 = setTimeout(() => setSimProducedLengthOk(1), 1000);
    const t2 = setTimeout(() => setSimProducedLengthOk(null), 2500);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [machine?.id, machine?.name]);

  const handleExportLineProcessingHtml = useCallback(async () => {
    if (!authToken) {
      window.alert('Cần đăng nhập để xuất báo cáo.');
      return;
    }
    setExportHtmlBusy(true);
    const res = await apiClient.downloadLineProcessingHtmlReport(
      { localDate: htmlReportLocalDate, machineIds: machineId },
      authToken
    );
    setExportHtmlBusy(false);
    if (!res.ok) window.alert(res.message);
  }, [authToken, htmlReportLocalDate, machineId]);

  const handleExportFactoryLineProcessingHtml = useCallback(async () => {
    if (!authToken) {
      window.alert('Cần đăng nhập để xuất báo cáo.');
      return;
    }
    const ok = window.confirm(
      'Xuất báo cáo HTML Processing cho toàn bộ máy trong nhà máy (4 cụm), 3 ca trong ngày đã chọn. File có thể lớn và tốn thời gian. Tiếp tục?'
    );
    if (!ok) return;
    setExportHtmlBusy(true);
    const res = await apiClient.downloadLineProcessingHtmlReport(
      { localDate: htmlReportLocalDate, factory: true },
      authToken
    );
    setExportHtmlBusy(false);
    if (!res.ok) window.alert(res.message);
  }, [authToken, htmlReportLocalDate]);

  const { cutsVersion } = useBobbinCutDetector(
    machineId,
    machineForOkSimulation ?? undefined,
    machine?.productionOrder?.bobbinCountPlanned
  );
  const [showAllOrderHistory, setShowAllOrderHistory] = useState(false);
  const [expandedBobbinOrderIds, setExpandedBobbinOrderIds] = useState<Set<string>>(
    () => new Set()
  );
  const realTimeTrends = useMachineDetailTrends(machine);
  const [statusHistory, setStatusHistory] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const hasDataRef = useRef(false);
  const statusFetchKeyRef = useRef<string>('');
  const statusHistoryAbortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    setStatusHistory([]);
    hasDataRef.current = false;
    statusFetchKeyRef.current = '';
    statusHistoryAbortRef.current?.abort();
  }, [machineId]);

  const rollingTimelineModes =
    equipmentOeeMode === 'realtime' || equipmentOeeMode === 'shift_live';
  const [timelineMinuteKey, setTimelineMinuteKey] = useState(() =>
    Math.floor(Date.now() / 60_000)
  );
  useEffect(() => {
    if (!rollingTimelineModes) return;
    const id = setInterval(() => setTimelineMinuteKey(Math.floor(Date.now() / 60_000)), 60_000);
    return () => clearInterval(id);
  }, [rollingTimelineModes]);

  const operationalTimeline = useMemo(() => {
    const anchorNow = rollingTimelineModes
      ? new Date(timelineMinuteKey * 60_000)
      : new Date();
    return buildOperationalStatesTimeline(
      equipmentOeeMode,
      referenceDate,
      pastIsoShiftNumber,
      equipmentOeeScope,
      anchorNow
    );
  }, [
    equipmentOeeMode,
    referenceDate,
    pastIsoShiftNumber,
    equipmentOeeScope?.start,
    equipmentOeeScope?.end,
    equipmentOeeScope?.dayDate,
    rollingTimelineModes,
    timelineMinuteKey,
  ]);

  const speedHistoryQuery = useMemo(() => {
    const anchorNow = rollingTimelineModes
      ? new Date(timelineMinuteKey * 60_000)
      : new Date();
    return buildEquipmentSpeedHistoryQuery(
      equipmentOeeMode,
      referenceDate,
      pastIsoShiftNumber,
      equipmentOeeScope,
      anchorNow
    );
  }, [
    equipmentOeeMode,
    referenceDate,
    pastIsoShiftNumber,
    equipmentOeeScope?.start,
    equipmentOeeScope?.end,
    equipmentOeeScope?.dayDate,
    rollingTimelineModes,
    timelineMinuteKey,
  ]);

  const speedHistory = useEquipmentSpeedHistory({
    machineId,
    queryStart: speedHistoryQuery.queryStart,
    queryEnd: speedHistoryQuery.queryEnd,
    pollMs: speedHistoryQuery.pollMs,
    bucketSec: speedHistoryQuery.bucketSec,
    pointLimit: speedHistoryQuery.pointLimit,
  });

  const energyAnchorNow = useMemo(() => {
    if (rollingTimelineModes) return new Date(timelineMinuteKey * 60_000);
    return new Date();
  }, [
    rollingTimelineModes,
    timelineMinuteKey,
    referenceDate,
    equipmentOeeMode,
    equipmentOeeScope?.start,
    equipmentOeeScope?.end,
    equipmentOeeScope?.dayDate,
  ]);

  const statusHistoryRangeKey = useMemo(
    () =>
      `${operationalTimeline.queryStart.toISOString()}|${operationalTimeline.queryEnd.toISOString()}`,
    [operationalTimeline.queryStart, operationalTimeline.queryEnd]
  );

  // Status history for Gantt — range follows OEE filter; polling only while window touches "now"
  useEffect(() => {
    if (!machineId) return;

    const fetchKey = `${machineId}|${statusHistoryRangeKey}`;
    if (statusFetchKeyRef.current !== fetchKey) {
      statusFetchKeyRef.current = fetchKey;
    }

    statusHistoryAbortRef.current?.abort();
    const ac = new AbortController();
    statusHistoryAbortRef.current = ac;

    const fetchStatusHistory = async () => {
      const blockingLoader = !hasDataRef.current;
      if (blockingLoader) {
        setLoadingHistory(true);
      }

      try {
        const response = await apiClient.getMachineStatusHistory(
          machineId,
          {
            start: operationalTimeline.queryStart.toISOString(),
            end: operationalTimeline.queryEnd.toISOString(),
          },
          { signal: ac.signal }
        );
        if (ac.signal.aborted) return;
        if (response.success && response.data) {
          setStatusHistory(response.data);
          if (response.data.length > 0) {
            hasDataRef.current = true;
          }
        }
      } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') {
          return;
        }
        console.error('Error fetching status history:', error);
      } finally {
        if (!ac.signal.aborted && blockingLoader) {
          setLoadingHistory(false);
        }
      }
    };

    fetchStatusHistory();
    if (operationalTimeline.pollMs == null) {
      return () => {
        ac.abort();
      };
    }
    const interval = setInterval(fetchStatusHistory, operationalTimeline.pollMs);
    return () => {
      clearInterval(interval);
      ac.abort();
    };
  }, [machineId, statusHistoryRangeKey, operationalTimeline.pollMs]);

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

  const speedAnalysisChartRows = useMemo(() => {
    if (!speedHistory.data?.points.length) return [];
    return buildSpeedChartRows(
      speedHistory.data.points,
      speedHistoryQuery.queryStart,
      speedHistoryQuery.queryEnd
    );
  }, [
    speedHistory.data?.points,
    speedHistoryQuery.queryStart,
    speedHistoryQuery.queryEnd,
  ]);

  const speedChartXDomain = useMemo((): [number, number] => {
    return [
      speedHistoryQuery.queryStart.getTime(),
      speedHistoryQuery.queryEnd.getTime(),
    ];
  }, [speedHistoryQuery.queryStart, speedHistoryQuery.queryEnd]);

  const speedAnalysisRefs = useMemo(
    () =>
      resolveSpeedReferenceLines(
        speedHistory.data?.points ?? [],
        speedHistory.data?.summary.currentTargetSpeed ?? null
      ),
    [speedHistory.data?.points, speedHistory.data?.summary.currentTargetSpeed]
  );

  const speedStableSegments = useMemo(
    () => findStableRunningSegments(speedHistory.data?.points ?? [], speedHistory.data?.meta.bucketSec ?? 60),
    [speedHistory.data?.points, speedHistory.data?.meta.bucketSec]
  );

  const speedTrendYDomain = useMemo(() => {
    const isDrawing = machine?.area === 'drawing';
    return calculateSpeedTrendYDomain(
      speedHistory.data?.points ?? [],
      speedAnalysisRefs,
      isDrawing
    );
  }, [machine?.area, speedHistory.data?.points, speedAnalysisRefs]);

  const speedAnalysisUnit = speedUnitForArea(speedHistory.data?.meta.area ?? machine?.area);

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

  const energyChartContext = useMemo(() => {
    if (!machine) return null;
    return resolveEnergyChartContext(
      equipmentOeeMode,
      referenceDate,
      pastIsoShiftNumber,
      equipmentOeeScope,
      energyAnchorNow
    );
  }, [
    machine,
    equipmentOeeMode,
    referenceDate,
    pastIsoShiftNumber,
    equipmentOeeScope,
    energyAnchorNow,
  ]);

  const energyBarDisplay = useMemo(() => {
    if (!machine || !energyChartContext) {
      return {
        rows: [] as { label: string; energy: number; bucketStart: string; bucketEnd: string }[],
        source: 'empty' as const,
        powerFill: 'none' as const,
        meterStatus: 'no_points' as const,
      };
    }
    const tk =
      machine.energyMeterKwh != null && Number.isFinite(machine.energyMeterKwh)
        ? machine.energyMeterKwh
        : undefined;
    const built = buildMeterDeltaBarChartFromTrend(
      machine.energyMeterTrend as unknown[] | undefined,
      energyChartContext,
      { terminalKwh: tk, terminalAtMs: Date.now() }
    );
    const source = built.status === 'no_points' ? ('empty' as const) : ('meter_delta' as const);
    return {
      rows: built.rows,
      source,
      powerFill: 'none' as const,
      meterStatus: built.status,
    };
  }, [machine, energyChartContext, machine?.energyMeterTrend, machine?.energyMeterKwh]);

  const energyBarRows = energyBarDisplay.rows;

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

  // Order list for history + bobbin (must run every render — never after early return)
  const displayOrders: ProductionOrder[] = useMemo(() => {
    if (!machine) return [];
    const history = [...(machine.orderHistory || [])];
    const current = machine.productionOrder;
    if (!current) return history;
    if (!history.some((o) => o.id === current.id)) {
      history.unshift({
        ...current,
        status: machine.status === 'running' ? 'running' : current.status || 'interrupted',
        producedLengthOk: effectiveProducedLengthOkM(machineForOkSimulation),
      });
    }
    return history;
  }, [machine, machineForOkSimulation]);

  const visibleOrders = useMemo(() => {
    if (showAllOrderHistory) return displayOrders;
    return displayOrders.filter(isOrderOnToday);
  }, [displayOrders, showAllOrderHistory]);

  const hiddenOrderCount = displayOrders.length - visibleOrders.length;

  const toggleBobbinExpand = useCallback((orderId: string) => {
    setExpandedBobbinOrderIds((prev) => {
      const next = new Set(prev);
      if (next.has(orderId)) next.delete(orderId);
      else next.add(orderId);
      return next;
    });
  }, []);

  const energyProductRows = useMemo(() => {
    if (!machine || !energyChartContext) return [];
    const total = energyBarRows.reduce((s, r) => s + r.energy, 0);
    return allocateEnergyByOrderOverlap({
      totalKwh: total,
      windowStart: energyChartContext.windowStart,
      windowEnd: energyChartContext.windowEnd,
      orders: displayOrders.map((o) => ({
        id: o.id,
        productName: o.productName,
        name: o.name,
        startTime: o.startTime,
        endTime: o.endTime,
        producedLengthOk: o.producedLengthOk,
      })),
    });
  }, [machine, energyChartContext, energyBarRows, displayOrders]);

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
    productName: machine.productName || 'N/A',
    customer: machine.productionOrder?.customer || 'N/A'
  };

  // Check if this is a Drawing machine (uses m/s instead of m/min)
  const isDrawingMachine = machine.area === 'drawing';
  
  // Production metrics
  // Use total produced length for stable display.
  // producedLengthOk can reset/jitter when the OK counter is reset.
  const currentLength = effectiveProducedLengthOkM(machineForOkSimulation);
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

  const resolvedOee = pickMachineOee(machine, equipmentOeeMode, equipmentOeeRollupByMachine);
  const oeeMetrics = {
    availability: resolvedOee.availability,
    performance: resolvedOee.performance,
    quality: resolvedOee.quality,
    oee: resolvedOee.oee,
  };
  const availabilityLabel =
    resolvedOee.source === 'settled'
      ? 'AVAILABILITY (SNAPSHOT CA)'
      : resolvedOee.source === 'rollup' && equipmentOeeMode === 'past_shift'
        ? 'AVAILABILITY (ROLLUP CA)'
        : resolvedOee.source === 'rollup'
          ? 'AVAILABILITY (ROLLUP)'
          : machine.availabilityIsPreliminary
            ? 'AVAILABILITY (PREV SHIFT)'
            : 'AVAILABILITY';
  const performanceLabel =
    resolvedOee.source === 'settled'
      ? 'PERFORMANCE (SNAPSHOT CA)'
      : resolvedOee.source === 'rollup' && equipmentOeeMode === 'past_shift'
        ? 'PERFORMANCE (ROLLUP CA)'
        : resolvedOee.source === 'rollup'
          ? 'PERFORMANCE (ROLLUP)'
          : machine.performanceDataQuality === 'MISSING_TARGET_DEFAULT_100'
            ? 'PERFORMANCE (NO TARGET)'
            : 'PERFORMANCE';
  const qualityFootnote =
    resolvedOee.source === 'realtime'
      ? machine.qualityDataQuality === 'ASSUMED_100_PENDING_NG_INTEGRATION'
        ? 'Giả định 100% — chưa trừ NG'
        : machine.qualityDataQuality === 'NO_PRODUCTION'
          ? 'Chưa có sản lượng trong ca'
          : null
      : null;
  const rollupModeFootnote =
    resolvedOee.source === 'settled'
      ? 'Snapshot immutable trong oee_shift_settlements (rollup_v1). OEE = A×P×Q — định nghĩa báo cáo TPM / ISO 22400.'
      : resolvedOee.source === 'rollup' && equipmentOeeMode === 'past_shift'
        ? 'Rollup ca đã đóng — cùng công thức settlement nhưng chưa có POST settle hoặc snapshot chưa đủ máy.'
        : resolvedOee.source === 'rollup'
          ? `Số liệu rollup Analytics — ${equipmentOeeModeLabelVi(equipmentOeeMode)} (theo máy này trong cửa sổ phía trên).`
          : null;

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
        <div className="flex items-start gap-6 flex-wrap mobile-stack">
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
            <div className="grid gap-2 lg:gap-4 responsive-grid-3">
              <div className="min-w-0">
                <div className="text-white/60 text-xs mb-0.5">ORDER ID</div>
                <div className="text-sm lg:text-base text-white tracking-tight truncate">{machineInfo.currentOrder || 'N/A'}</div>
              </div>
              <div className="min-w-0">
                <div className="text-white/60 text-xs mb-0.5">PRODUCT</div>
                <div className="text-sm lg:text-base text-white tracking-tight truncate">
                  {(() => {
                    const productName = machine.productName?.trim();
                    if (!productName) {
                      const isInvalid = !!machine.materialCode;
                      return (
                        <span className={isInvalid ? 'text-[#EF4444]' : 'text-[#F59E0B]'}>
                          {isInvalid ? 'Invalid production name' : 'Not entered yet'}
                        </span>
                      );
                    }
                    return (
                      <span
                        className={
                          isUnknownLikeProductName(productName) ? '' : 'text-[#22C55E]'
                        }
                        style={unknownLikeProductInlineStyle(productName)}
                      >
                        {productName}
                      </span>
                    );
                  })()}
                </div>
              </div>
              <div className="min-w-0">
                <div className="text-white/60 text-xs mb-0.5">EST. COMPLETION</div>
                <div className="text-sm lg:text-base text-[#4FFFBC] tracking-tight truncate">{productionData.estimatedCompletion}</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* OEE time filter — drives Gantt, speed trend, energy, and OEE KPIs */}
      <div className="mb-4">
        <EquipmentOeeToolbar
          mode={equipmentOeeMode}
          onModeChange={onEquipmentOeeModeChange}
          scope={equipmentOeeScope}
          loading={equipmentOeeRollupLoading}
          error={equipmentOeeRollupError}
          compact
          referenceDate={referenceDate}
          onReferenceDateChange={onReferenceDateChange}
          pastIsoShiftNumber={pastIsoShiftNumber}
          onPastIsoShiftNumberChange={onPastIsoShiftNumberChange}
        />
      </div>

      {/* Gantt Chart: Operational States */}
      <div className="mb-4 rounded-xl bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-xl border border-white/20 shadow-2xl p-4">
        <div className="flex items-start gap-2 mb-4 flex-wrap">
          <Activity className="w-5 h-5 text-[#34E7F8] shrink-0 mt-0.5" strokeWidth={2.5} />
          <div className="min-w-0">
            <h2 className="text-xl text-white">Operational States by Shift</h2>
            {operationalTimeline.sectionSubtitle ? (
              <p className="text-sm text-white/55 mt-1">{operationalTimeline.sectionSubtitle}</p>
            ) : null}
          </div>
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
          <ShiftGanttChart data={statusHistory.length > 0 ? statusHistory : []} rows={operationalTimeline.rows} />
        )}
      </div>

      {/* Speed Analysis — oee_calculations time-series (OEE filter window) */}
      <div className="equipment-speed-panel mb-4 rounded-xl bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-xl border border-white/20 shadow-2xl p-4">
        <div className="flex items-start gap-2 mb-4 flex-wrap">
          <Gauge className="w-5 h-5 text-[#4FFFBC] shrink-0 mt-0.5" strokeWidth={2.5} />
          <div className="min-w-0">
            <h2 className="text-xl text-white">Trend tốc độ</h2>
            {speedHistoryQuery.sectionSubtitle ? (
              <p className="text-sm speed-text-muted mt-1">
                {speedHistoryQuery.sectionSubtitle}
                {speedHistory.data?.meta ? (
                  <span className="speed-text-subtle">
                    {' '}
                    — bucket {speedHistory.data.meta.bucketSec}s · {speedHistory.data.meta.pointCount} điểm
                    · {speedHistory.data.meta.source}
                  </span>
                ) : null}
              </p>
            ) : null}
          </div>
        </div>

        {speedHistory.loading && speedAnalysisChartRows.length === 0 ? (
          <div className="flex items-center justify-center h-40 text-white/60">
            Đang tải lịch sử tốc độ…
          </div>
        ) : speedHistory.error && speedAnalysisChartRows.length === 0 ? (
          <div className="flex items-center justify-center h-40 text-[#EF4444]/90 text-sm">
            {speedHistory.error}
          </div>
        ) : speedAnalysisChartRows.length === 0 ? (
          <div className="flex items-center justify-center h-40 text-white/60 text-sm text-center px-4">
            Chưa có dữ liệu tốc độ trong cửa sổ đã chọn (oee_calculations).
          </div>
        ) : (
          <>
            <div className="grid gap-3 mb-4 responsive-grid-4">
              <div className="p-3 rounded-lg bg-white/5 border border-white/10">
                <div className="speed-text-muted text-xs mb-1">Tốc độ ổn định (median)</div>
                <div className="text-xl speed-accent-green">
                  {speedHistory.data?.summary.stableRunningMedian != null
                    ? `${speedHistory.data.summary.stableRunningMedian.toFixed(2)} ${speedAnalysisUnit}`
                    : '—'}
                </div>
              </div>
              <div className="p-3 rounded-lg bg-white/5 border border-white/10">
                <div className="speed-text-muted text-xs mb-1">TB tốc độ setup</div>
                <div className="text-xl speed-accent-orange">
                  {speedHistory.data?.summary.setupAvgSpeed != null
                    ? `${speedHistory.data.summary.setupAvgSpeed.toFixed(2)} ${speedAnalysisUnit}`
                    : '—'}
                </div>
              </div>
              <div className="p-3 rounded-lg bg-white/5 border border-white/10">
                <div className="speed-text-muted text-xs mb-1">Thời gian dừng</div>
                <div className="text-xl speed-accent-cyan">
                  {formatSpeedDuration(speedHistory.data?.summary.stoppedDurationSec ?? 0)}
                </div>
              </div>
              <div className="p-3 rounded-lg bg-white/5 border border-[#F59E0B]/30">
                <div className="speed-text-muted text-xs mb-1">ICT đề xuất (read-only)</div>
                <div className="text-xl speed-accent-ict">
                  {speedHistory.data?.summary.proposedTargetSpeed != null
                    ? `${speedHistory.data.summary.proposedTargetSpeed.toFixed(2)} ${speedAnalysisUnit}`
                    : '—'}
                </div>
                {speedHistory.data?.summary.deltaVsTargetPct != null ? (
                  <div className="text-xs text-white/50 mt-1">
                    vs ICT hiện tại ({speedHistory.data.summary.currentTargetSpeed?.toFixed(2) ?? '—'}):{' '}
                    {speedHistory.data.summary.deltaVsTargetPct > 0 ? '+' : ''}
                    {speedHistory.data.summary.deltaVsTargetPct}%
                  </div>
                ) : null}
              </div>
            </div>

            {speedHistory.data?.productNotes ? (
              <EquipmentSpeedProductNotes
                notes={speedHistory.data.productNotes}
                unit={speedAnalysisUnit}
                longSpan={
                  speedAnalysisChartRows.length >= 2
                    ? speedAnalysisChartRows[speedAnalysisChartRows.length - 1].timestampMs -
                        speedAnalysisChartRows[0].timestampMs >
                      36 * 3600 * 1000
                    : false
                }
              />
            ) : null}

            {speedHistory.data ? (
              <EquipmentSpeedTrendChart
                rows={speedAnalysisChartRows}
                data={speedHistory.data}
                yDomain={speedTrendYDomain}
                xDomain={speedChartXDomain}
                stableSegments={speedStableSegments}
                refs={speedAnalysisRefs}
              />
            ) : null}

            <div className="flex flex-wrap gap-3 pt-2 border-t border-white/10">
              {SPEED_PHASE_LEGEND.map((item) => (
                <div key={item.phase} className="flex items-center gap-1.5 text-xs speed-text-soft">
                  <span
                    className="inline-block w-2.5 h-2.5 rounded-full"
                    style={{ backgroundColor: item.color }}
                  />
                  {item.label}
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Production Metrics */}
      <div className="mb-4 grid gap-3 responsive-grid-2">
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
          <div className="pt-2 border-t border-white/10 grid gap-2 responsive-grid-2">
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
          <div className="pt-2 border-t border-white/10 grid gap-2 responsive-grid-2">
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
      <div className="mb-4 space-y-3">
        {authToken ? (
          <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:flex-wrap sm:items-end sm:justify-end mt-2">
            <label className="inline-flex flex-col gap-1 text-left sm:mr-1">
              <span className="text-[10px] uppercase tracking-wide text-white/50">Ngày báo cáo xuất</span>
              <input
                type="date"
                value={htmlReportLocalDate}
                onChange={(e) => setHtmlReportLocalDate(e.target.value)}
                disabled={exportHtmlBusy}
                className="min-h-[38px] rounded-lg border border-white/20 bg-white/10 px-2.5 py-1.5 text-sm text-white outline-none focus:border-[#34E7F8]/60 focus:ring-1 focus:ring-[#34E7F8]/30 disabled:opacity-50 [color-scheme:dark]"
                title="Áp dụng cho cả xuất máy này và xuất toàn nhà máy (3 ca trong ngày đã chọn)"
              />
            </label>
            <div className="flex flex-wrap gap-2 justify-end">
              <button
                type="button"
                title="Xuất báo cáo HTML Processing (3 ca) — chỉ máy đang xem — theo ngày đã chọn"
                onClick={() => void handleExportLineProcessingHtml()}
                disabled={exportHtmlBusy}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-white/10 hover:bg-white/20 text-[#34E7F8] border border-[#34E7F8]/40 disabled:opacity-50"
              >
                <FileDown className="w-3.5 h-3.5" strokeWidth={2} />
                {exportHtmlBusy ? 'Đang xuất…' : 'Xuất HTML (máy này)'}
              </button>
              <button
                type="button"
                title="Xuất báo cáo HTML Processing (3 ca) cho tất cả máy các cụm — minh bạch toàn nhà máy"
                onClick={() => void handleExportFactoryLineProcessingHtml()}
                disabled={exportHtmlBusy}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-[#34E7F8]/15 hover:bg-[#34E7F8]/25 text-white border border-[#34E7F8]/50 disabled:opacity-50"
              >
                <Layers className="w-3.5 h-3.5" strokeWidth={2} />
                {exportHtmlBusy ? 'Đang xuất…' : 'Xuất HTML (toàn nhà máy)'}
              </button>
            </div>
          </div>
        ) : null}

      <div className="desktop-only rounded-xl bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-xl border border-white/20 shadow-2xl p-3">
        <div className="flex items-center gap-2 mb-3">
          <Target className="w-4 h-4 text-[#34E7F8]" strokeWidth={2.5} />
          <h3 className="text-base text-white">Overall Equipment Effectiveness (OEE)</h3>
        </div>
        <div className="grid gap-3 responsive-grid-4">
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
            <div className="text-white/60 text-xs mb-1.5 tracking-wider">{availabilityLabel}</div>
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
            <div className="text-white/60 text-xs mb-1.5 tracking-wider">{performanceLabel}</div>
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
            {qualityFootnote ? (
              <p className="text-[10px] text-amber-200/90 mb-2 leading-snug">{qualityFootnote}</p>
            ) : null}
            <div className="h-1 bg-white/10 rounded-full overflow-hidden">
              <div 
                className="h-full rounded-full bg-[#34E7F8]"
                style={{ width: `${oeeMetrics.quality}%` }}
              />
            </div>
          </div>
        </div>
        {rollupModeFootnote ? (
          <p className="text-[11px] text-white/45 mt-2 leading-snug">{rollupModeFootnote}</p>
        ) : null}
      </div>

      <div className="mobile-only rounded-xl bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-xl border border-white/20 shadow-2xl p-3">
        <details className="mobile-accordion">
          <summary className="flex items-center justify-between gap-2 text-white">
            <div className="flex items-center gap-2">
              <Target className="w-4 h-4 text-[#34E7F8]" strokeWidth={2.5} />
              <span>OEE Summary</span>
            </div>
            <span className="text-white/60 text-xs">Tap to expand</span>
          </summary>
          <div className="mt-4 space-y-3">
            <div className="p-3 rounded-lg bg-gradient-to-br from-white/8 to-white/3 border border-white/10">
              <div className="text-white/60 text-xs mb-1.5 tracking-wider">OEE</div>
              <div className="text-3xl tracking-tight mb-2" style={{ color: getOEEColor(oeeMetrics.oee) }}>
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
            <div className="grid gap-3 responsive-grid-2">
              <div className="p-3 rounded-lg bg-gradient-to-br from-white/8 to-white/3 border border-white/10">
                <div className="text-white/60 text-xs mb-1.5 tracking-wider">{availabilityLabel}</div>
                <div className="text-2xl text-[#4FFFBC] tracking-tight mb-2">{oeeMetrics.availability}%</div>
                <div className="h-1 bg-white/10 rounded-full overflow-hidden">
                  <div className="h-full rounded-full bg-[#4FFFBC]" style={{ width: `${oeeMetrics.availability}%` }} />
                </div>
              </div>
              <div className="p-3 rounded-lg bg-gradient-to-br from-white/8 to-white/3 border border-white/10">
                <div className="text-white/60 text-xs mb-1.5 tracking-wider">{performanceLabel}</div>
                <div className="text-2xl text-[#FFB86C] tracking-tight mb-2">{oeeMetrics.performance}%</div>
                <div className="h-1 bg-white/10 rounded-full overflow-hidden">
                  <div className="h-full rounded-full bg-[#FFB86C]" style={{ width: `${oeeMetrics.performance}%` }} />
                </div>
              </div>
              <div className="p-3 rounded-lg bg-gradient-to-br from-white/8 to-white/3 border border-white/10">
                <div className="text-white/60 text-xs mb-1.5 tracking-wider">QUALITY</div>
                <div className="text-2xl text-[#34E7F8] tracking-tight mb-2">{oeeMetrics.quality}%</div>
                {qualityFootnote ? (
                  <p className="text-[10px] text-amber-200/90 mb-2 leading-snug">{qualityFootnote}</p>
                ) : null}
                <div className="h-1 bg-white/10 rounded-full overflow-hidden">
                  <div className="h-full rounded-full bg-[#34E7F8]" style={{ width: `${oeeMetrics.quality}%` }} />
                </div>
              </div>
            </div>
            {rollupModeFootnote ? (
              <p className="text-[11px] text-white/45 mt-2 leading-snug">{rollupModeFootnote}</p>
            ) : null}
          </div>
        </details>
      </div>
      </div>

      {/* Real-time Charts */}
      <div className="grid gap-4 responsive-grid-3">
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
          <div className="grid gap-2 mb-4 responsive-grid-10">
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
          <div className="grid gap-3 mb-4 responsive-grid-4">
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

      {/* Công suất (kW) | chỉ số đồng hồ (energyMeterKwh) | kWh theo bucket đồng hồ */}
      <div className="mt-4 grid gap-4 responsive-grid-2">
        {/* Real-time Power + cumulative meter reading (energyMeterKwh) */}
        <div className="rounded-xl bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-xl border border-white/20 shadow-2xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <Zap className="w-4 h-4 text-[#FFB86C]" strokeWidth={2.5} />
            <h3 className="text-base text-white">Power Trend</h3>
          </div>
          <div className="mb-3">
            <div className="text-3xl text-[#FFB86C] tracking-tight">
              {machine.power ? `${machine.power.toFixed(1)} kW` : 'N/A'}
            </div>
            <div className="text-white/60 text-xs">Công suất hiện tại</div>
            <div className="mt-2 text-white/55 text-xs">
              Đồng hồ tích lũy{' '}
              <span className="text-white/45">(energyMeterKwh)</span>{' '}
              <span className="text-[#FFB86C]/90 font-medium tabular-nums">
                {machine.energyMeterKwh != null && Number.isFinite(machine.energyMeterKwh)
                  ? `${machine.energyMeterKwh.toLocaleString(undefined, { maximumFractionDigits: 2 })} kWh`
                  : '—'}
              </span>
            </div>
            <div className="text-white/40 text-[10px] mt-0.5 leading-snug">
              Khác với biểu đồ kWh theo bucket (delta đồng hồ). Gửi chỉ số qua PATCH{' '}
              <span className="text-white/55">energyMeterKwh</span> hoặc POST metrics{' '}
              <span className="text-white/55">metricType = energy_meter_kwh</span>. kWh/ca ≈ chỉ số cuối trừ
              đầu ca.
            </div>
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

        {/* kWh theo bucket — delta từ lịch sử đồng hồ (machine_metrics energy_meter_kwh + snapshot) */}
        <div className="rounded-xl bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-xl border border-white/20 shadow-2xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <Battery className="w-4 h-4 text-[#4FFFBC]" strokeWidth={2.5} />
            <div>
              <h3 className="text-base text-white">kWh theo bucket (đồng hồ)</h3>
              <p className="text-white/45 text-[10px] mt-0.5">
                Theo cửa sổ ca/ngày/phạm vi OEE — tổng kWh = chỉ số tích lũy trong khung; cột chia theo thời gian
                giữa các mẫu <span className="text-white/55">energy_meter_kwh</span> và{' '}
                <span className="text-white/55">energyMeterKwh</span> hiện tại (PLC thưa vẫn hiển thị).
              </p>
            </div>
          </div>
          
          <div className="mb-3">
            <div className="text-3xl text-[#4FFFBC] tracking-tight">
              {energyBarRows.reduce((sum, d) => sum + d.energy, 0).toFixed(1)} kWh
            </div>
            <div className="text-white/60 text-xs leading-snug">
              {energyChartContext?.kpiSubtitle ?? '—'}
            </div>
            {energyBarDisplay.meterStatus === 'no_points' && (
              <p className="text-white/50 text-xs mt-1.5 leading-snug">
                Chưa đủ dữ liệu đồng hồ trong khung (cần ít nhất hai mốc: lịch sử{' '}
                <span className="text-white/55">energy_meter_kwh</span> hoặc cùng snapshot{' '}
                <span className="text-white/55">energyMeterKwh</span>).
              </p>
            )}
            {energyBarDisplay.meterStatus === 'outside_window' && (
              <p className="text-amber-200/90 text-xs mt-1.5 leading-snug">
                Có lịch sử đồng hồ nhưng không trùng cửa sổ đang chọn — kiểm tra mốc thời gian hoặc chọn ca/ngày khác.
              </p>
            )}
          </div>

          <div className="h-40">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart 
                data={energyBarRows} 
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
                  dataKey="label" 
                  stroke="#ffffff40" 
                  tick={{ fill: '#ffffff60', fontSize: 9 }}
                  angle={-45}
                  textAnchor="end"
                  height={60}
                  interval="preserveStartEnd"
                  label={{
                    value: energyChartContext?.xAxisLabel ?? 'Time',
                    position: 'insideBottom',
                    offset: -5,
                    fill: '#ffffff60',
                    fontSize: 10,
                  }}
                />
                <YAxis 
                  stroke="#ffffff40" 
                  tick={{ fill: '#ffffff60', fontSize: 10 }}
                  label={{ value: 'kWh / bucket (đồng hồ)', angle: -90, position: 'insideLeft', fill: '#ffffff60', fontSize: 10, style: { textAnchor: 'middle' } }}
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
                    return [`${numValue.toFixed(2)} kWh`, 'Bucket (đồng hồ)'];
                  }}
                  labelFormatter={(label) => `Bucket: ${label}`}
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

      {energyProductRows.length > 0 && (
        <div className="mt-4 rounded-xl bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-xl border border-white/20 shadow-2xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <Layers className="w-4 h-4 text-[#7DD3FC]" strokeWidth={2.5} />
            <h3 className="text-base text-white">kWh theo đơn (ước lượng)</h3>
          </div>
          <p className="text-white/50 text-xs mb-3">
            Phân bổ kWh của biểu đồ “theo bucket (đồng hồ)” theo thời gian chồng lấn từng đơn — cùng tổng kWh trong cửa sổ ca/ngày đã chọn.
          </p>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                layout="vertical"
                data={energyProductRows}
                margin={{ top: 8, right: 24, left: 8, bottom: 8 }}
                isAnimationActive={false}
              >
                <XAxis
                  type="number"
                  stroke="#ffffff40"
                  tick={{ fill: '#ffffff60', fontSize: 10 }}
                  tickFormatter={(v) => `${Number(v).toFixed(1)}`}
                  label={{
                    value: 'kWh (allocated)',
                    position: 'insideBottom',
                    offset: -2,
                    fill: '#ffffff60',
                    fontSize: 10,
                  }}
                />
                <YAxis
                  type="category"
                  dataKey="label"
                  stroke="#ffffff40"
                  tick={{ fill: '#ffffff60', fontSize: 10 }}
                  width={148}
                  tickFormatter={(v) =>
                    String(v).length > 22 ? `${String(v).slice(0, 20)}…` : String(v)
                  }
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#0E2F4F',
                    border: '1px solid rgba(255,255,255,0.2)',
                    borderRadius: '8px',
                    fontSize: '11px',
                    color: '#ffffff',
                  }}
                  formatter={(value: unknown, _label: string, item: { payload?: { kwhPerKm?: number | null } }) => {
                    const kwh = typeof value === 'number' ? value : parseFloat(String(value)) || 0;
                    const per = item?.payload?.kwhPerKm;
                    if (typeof per === 'number' && Number.isFinite(per)) {
                      return [`${kwh.toFixed(2)} kWh · ${per.toFixed(2)} kWh/km`, 'Allocated'];
                    }
                    return [`${kwh.toFixed(2)} kWh`, 'Allocated'];
                  }}
                />
                <Bar
                  dataKey="kwh"
                  fill="#7DD3FC"
                  radius={[0, 4, 4, 0]}
                  isAnimationActive={false}
                  stroke="#38BDF8"
                  strokeWidth={1}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Production Order History */}
      <div className="mt-4 rounded-xl bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-xl border border-white/20 shadow-2xl p-4">
        <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
          <div className="flex items-center gap-2">
            <History className="w-5 h-5 text-[#34E7F8]" strokeWidth={2.5} />
            <h2 className="text-xl text-white">Production Order History</h2>
            <span className="mes-kpi-label text-sm">— hôm nay</span>
          </div>
          {hiddenOrderCount > 0 && (
            <button
              type="button"
              onClick={() => setShowAllOrderHistory((v) => !v)}
              className="flex items-center gap-1.5 rounded-lg border border-white/20 bg-white/5 px-3 py-1.5 text-sm text-white/85 hover:bg-white/10 transition-colors"
            >
              {showAllOrderHistory ? (
                <>
                  <ChevronUp className="w-4 h-4" />
                  Thu gọn (chỉ hôm nay)
                </>
              ) : (
                <>
                  <ChevronDown className="w-4 h-4" />
                  Xem thêm {hiddenOrderCount} lệnh các ngày trước
                </>
              )}
            </button>
          )}
        </div>
        <p className="mes-data-muted text-sm mb-4" data-bobbin-sync={cutsVersion}>
          Bobbin IDs use <strong className="text-white/80">producedLengthOk</strong> (mét đạt): when OK length goes from above 2 m to ≤ 2 m on the same production order, one bobbin cut is recorded and saved to the database. Planned bobbin count comes from the order.
        </p>

        <div className="space-y-2">
          {visibleOrders.length === 0 ? (
            <div className="mes-data-muted text-sm py-4 text-center rounded-lg border border-white/10">
              Không có lệnh sản xuất trong ngày hôm nay.
            </div>
          ) : (
          visibleOrders.map((order, index) => {
            const StatusIcon = getOrderStatusIcon(order.status);
            const statusColor = getOrderStatusColor(order.status);
              const producedForDisplay = effectiveProducedLengthOkM(order);
              const completionPercentage = (producedForDisplay / order.targetLength) * 100;
            const bobbinCuts = mergeCutsForOrder(machine.id, order.id, order.bobbinCuts);
            const todayBobbinCuts = filterBobbinCutsToday(bobbinCuts);
            const showAllBobbinCuts = expandedBobbinOrderIds.has(order.id);
            const visibleBobbinCuts = showAllBobbinCuts ? bobbinCuts : todayBobbinCuts;
            const hiddenBobbinCount = bobbinCuts.length - todayBobbinCuts.length;
            
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

                <div className="grid gap-4 mb-3 responsive-grid-4">
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
                    <div className="text-base text-[#4FFFBC]">
                      {producedForDisplay.toLocaleString()} m
                    </div>
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
                <div className="mb-3">
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

                {/* Bobbin cuts — ID tự động khi mét về 0 */}
                <div className="pt-3 border-t border-white/10">
                  <div className="flex items-center justify-between gap-2 flex-wrap mb-2">
                    <div className="flex items-center gap-2">
                      <Layers className="w-4 h-4 text-[#A78BFA]" strokeWidth={2.5} />
                      <span className="text-white font-medium text-sm">Bobbin (order)</span>
                    </div>
                    {order.bobbinCountPlanned != null && order.bobbinCountPlanned > 0 && (
                      <span className="text-white/60 text-xs">
                        Planned bobbins:{' '}
                        <span className="text-[#A78BFA] font-semibold">{order.bobbinCountPlanned}</span>
                      </span>
                    )}
                  </div>
                  {bobbinCuts.length === 0 ? (
                    <div className="mes-data-muted text-xs py-1">
                      No bobbin cuts recorded yet (cuts appear when producedLengthOk goes to ≤ 2 m during this order).
                    </div>
                  ) : visibleBobbinCuts.length === 0 ? (
                    <div className="mes-data-muted text-xs py-1">
                      Không có bobbin cắt trong ngày hôm nay cho lệnh này.
                      {hiddenBobbinCount > 0 && (
                        <button
                          type="button"
                          onClick={() => toggleBobbinExpand(order.id)}
                          className="ml-2 text-[#34E7F8] hover:underline"
                        >
                          Xem {hiddenBobbinCount} bobbin trước đó
                        </button>
                      )}
                    </div>
                  ) : (
                    <>
                    {hiddenBobbinCount > 0 && (
                      <button
                        type="button"
                        onClick={() => toggleBobbinExpand(order.id)}
                        className="mb-2 flex items-center gap-1.5 text-xs text-[#34E7F8] hover:text-[#4FFFBC] transition-colors"
                      >
                        {showAllBobbinCuts ? (
                          <>
                            <ChevronUp className="w-3.5 h-3.5" />
                            Thu gọn — chỉ hiện hôm nay ({todayBobbinCuts.length})
                          </>
                        ) : (
                          <>
                            <ChevronDown className="w-3.5 h-3.5" />
                            Xem thêm {hiddenBobbinCount} bobbin các ngày trước
                          </>
                        )}
                      </button>
                    )}
                    <div className="overflow-x-auto rounded-lg border border-white/10 bg-gradient-to-br from-white/[0.05] to-white/[0.02]">
                      <table className="w-full text-left text-sm border-separate border-spacing-0">
                        <thead>
                          <tr className="mes-kpi-label text-[11px] uppercase tracking-wider border-b border-white/10">
                            <th className="py-2 px-2 font-semibold">ID order bobbin</th>
                            <th className="py-2 px-2 font-semibold text-right">Cut OK (m)</th>
                            <th className="py-2 px-2 font-semibold hidden sm:table-cell text-right">Bobbin qty (order)</th>
                            <th className="py-2 px-2 font-semibold hidden md:table-cell text-left whitespace-nowrap">Recorded</th>
                          </tr>
                        </thead>
                        <tbody>
                          {visibleBobbinCuts.map((row) => (
                            <tr
                              key={row.id}
                              className="border-b border-white/10 last:border-0 text-white/90 hover:bg-white/[0.03] transition-colors"
                            >
                              <td className="py-2 px-2 font-mono text-[#4FFFBC] whitespace-nowrap max-w-[260px] overflow-hidden text-ellipsis align-middle">
                                {row.id}
                              </td>
                              <td className="py-2 px-2 text-right tabular-nums text-[#34E7F8] font-medium align-middle">
                                {row.cutLengthM.toLocaleString(undefined, { maximumFractionDigits: 1 })}
                              </td>
                              <td className="py-2 px-2 hidden sm:table-cell text-right tabular-nums text-white/70 font-medium align-middle">
                                {row.bobbinCountPlanned ?? order.bobbinCountPlanned ?? '—'}
                              </td>
                              <td className="py-2 px-2 hidden md:table-cell text-white/50 text-xs whitespace-nowrap align-middle">
                                {new Date(row.recordedAt).toLocaleString()}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    </>
                  )}
                </div>
              </div>
            );
          })
          )}
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

// Shift-based Gantt Chart Component for Operational States
interface GanttChartProps {
  data: Array<{
    id: number;
    status: string;
    startTime: string;
    endTime: string | null;
    durationSeconds: number | null;
  }>;
  rows: OperationalStatesGanttRow[];
}

function ShiftGanttChart({ data, rows }: GanttChartProps) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(id);
  }, []);

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

  const buildSegments = useMemo(
    () => (windowStart: Date, windowEnd: Date) => {
      if (!data || data.length === 0) return [];

      const windowMs = windowEnd.getTime() - windowStart.getTime();
      if (windowMs <= 0) return [];

      const windowMinutes = windowMs / (1000 * 60);

      return data.reduce((segments, item) => {
        const itemStart = new Date(item.startTime);
        const itemEnd = item.endTime ? new Date(item.endTime) : now;
        if (itemEnd <= windowStart || itemStart >= windowEnd) {
          return segments;
        }

        const actualStart = itemStart < windowStart ? windowStart : itemStart;
        const actualEnd = itemEnd > windowEnd ? windowEnd : itemEnd;
        if (actualEnd <= actualStart) {
          return segments;
        }

        const startMinutes = Math.max(0, (actualStart.getTime() - windowStart.getTime()) / (1000 * 60));
        const endMinutes = Math.min(windowMinutes, (actualEnd.getTime() - windowStart.getTime()) / (1000 * 60));
        if (endMinutes > startMinutes) {
          segments.push({
            status: item.status,
            startPercent: ((actualStart.getTime() - windowStart.getTime()) / windowMs) * 100,
            endPercent: ((actualEnd.getTime() - windowStart.getTime()) / windowMs) * 100,
            duration: endMinutes - startMinutes,
            startTime: actualStart,
            endTime: actualEnd,
          });
        }
        return segments;
      }, [] as Array<{
        status: string;
        startPercent: number;
        endPercent: number;
        duration: number;
        startTime: Date;
        endTime: Date;
      }>).sort((a, b) => a.startTime.getTime() - b.startTime.getTime());
    },
    [data, now]
  );

  const getTimeLabels = (windowStart: Date, windowEnd: Date) => {
    const totalMs = windowEnd.getTime() - windowStart.getTime();
    if (totalMs <= 0) return [];
    const count = 4;
    const longSpan = totalMs > 36 * 3600 * 1000;
    const labels: Array<{ time: string; percent: number }> = [];
    for (let i = 0; i <= count; i++) {
      const t = new Date(windowStart.getTime() + (totalMs * i) / count);
      const time = longSpan
        ? t.toLocaleString('en-GB', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
        : t.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
      labels.push({ time, percent: (i / count) * 100 });
    }
    return labels;
  };

  const statusOrder = ['running', 'idle', 'setup', 'warning', 'stopped', 'error', 'alarm'];

  const statusGroups = useMemo(() => {
    const groups: Record<string, Array<{ duration: number }>> = {};
    rows.forEach((shift) => {
      buildSegments(shift.start, shift.end).forEach((segment) => {
        const statusKey = segment.status.toLowerCase();
        if (!groups[statusKey]) {
          groups[statusKey] = [];
        }
        groups[statusKey].push(segment);
      });
    });
    return groups;
  }, [rows, buildSegments]);

  const formatDuration = (minutesTotal: number) => {
    const hours = Math.floor(minutesTotal / 60);
    const minutes = Math.floor(minutesTotal % 60);
    return `${hours}h ${minutes}m`;
  };

  const getShiftStatusSummary = (shiftStart: Date, shiftEnd: Date) => {
    const segments = buildSegments(shiftStart, shiftEnd);
    const runningMinutes = segments
      .filter((segment) => segment.status.toLowerCase() === 'running')
      .reduce((sum, segment) => sum + segment.duration, 0);
    const idleMinutes = segments
      .filter((segment) => segment.status.toLowerCase() === 'idle')
      .reduce((sum, segment) => sum + segment.duration, 0);
    return { runningMinutes, idleMinutes };
  };

  const anyRowContainsNow = useMemo(
    () => rows.some((shift) => now >= shift.start && now < shift.end),
    [rows, now]
  );

  const currentRowKey = useMemo(() => {
    const active = rows.find((shift) => now >= shift.start && now < shift.end);
    return active?.key ?? null;
  }, [rows, now]);

  return (
    <div className="space-y-6">
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

      {/* Shift Gantt Rows */}
      {rows.map((shift) => {
        const timelineSegments = buildSegments(shift.start, shift.end);
        const timeLabels = getTimeLabels(shift.start, shift.end);
        const spanMs = shift.end.getTime() - shift.start.getTime();
        const currentTimePercent =
          spanMs > 0 ? ((now.getTime() - shift.start.getTime()) / spanMs) * 100 : 0;
        const isActiveRow = anyRowContainsNow ? shift.key === currentRowKey : true;
        const { runningMinutes, idleMinutes } = getShiftStatusSummary(shift.start, shift.end);

        return (
          <div
            key={shift.key}
            className="space-y-2 transition-opacity"
            style={{ opacity: isActiveRow ? 1 : 0.6 }}
          >
            <div className="flex items-center justify-between gap-4 text-white/80 font-semibold flex-wrap">
              <div className="min-w-0 text-sm sm:text-base leading-snug">{shift.label}</div>
              <div className="flex items-center gap-3 text-sm text-white/70 shrink-0">
                <span>Running ({formatDuration(runningMinutes)})</span>
                <span>Idle ({formatDuration(idleMinutes)})</span>
              </div>
            </div>
            <div className="relative h-20 bg-white/5 rounded-lg overflow-hidden border border-white/10">
              {/* Time grid lines */}
              <div className="absolute inset-0">
                {timeLabels.map((label, index) => (
                  <div
                    key={index}
                    className="absolute top-0 bottom-0 border-l border-white/10"
                    style={{ left: `${label.percent}%` }}
                  />
                ))}
              </div>

              {/* Status segments */}
              <div className="relative h-full flex items-center pt-4">
                {timelineSegments.map((segment, index) => {
                  const width = segment.endPercent - segment.startPercent;
                  const statusLower = segment.status.toLowerCase();
                  return (
                    <div
                      key={`${segment.status}-${index}`}
                      className="absolute h-12 rounded transition-all hover:opacity-90 hover:shadow-lg cursor-pointer border border-white/20"
                      style={{
                        left: `${segment.startPercent}%`,
                        width: `${width}%`,
                        backgroundColor: getStatusColor(statusLower),
                        minWidth: '3px',
                      }}
                      title={`${segment.status.toUpperCase()}\nStart: ${segment.startTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}\nEnd: ${segment.endTime?.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) || 'Now'}\nDuration: ${Math.round(segment.duration)} min (${(segment.duration / 60).toFixed(1)}h)`}
                    >
                      {width > 6 && (
                        <div className="absolute inset-0 flex items-center justify-center">
                          <span className="text-[10px] text-white font-semibold drop-shadow-lg uppercase">
                            {segment.status}
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Current time indicator */}
              {currentTimePercent > 0 && currentTimePercent < 100 && now >= shift.start && now < shift.end && (
                <div
                  className="absolute top-0 bottom-0 w-0.5 bg-[#34E7F8] z-20 pointer-events-none"
                  style={{ left: `${currentTimePercent}%` }}
                >
                  <div className="absolute -top-2 left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-[#34E7F8]" />
                  <div className="absolute -bottom-2 left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-b-4 border-transparent border-b-[#34E7F8]" />
                </div>
              )}
            </div>

            <div className="flex justify-between text-xs text-white/50 gap-1 flex-wrap">
              {timeLabels.map((label, index) => (
                <span key={index}>{label.time}</span>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Database, RefreshCw } from 'lucide-react';
import { EquipmentOeeToolbar } from '../EquipmentOeeToolbar';
import { EquipmentSpeedProductNotes } from '../EquipmentSpeedProductNotes';
import {
  DetailSpeedTrendChart,
  RunningTimeTrendChart,
} from '../speed-lab/MultiMachineSpeedChart';
import { SpeedLabGanttLegend, SpeedLabGanttTrack } from '../speed-lab/SpeedLabGanttTrack';
import { useEquipmentSpeedHistory } from '../../hooks/useEquipmentSpeedHistory';
import { useSpeedLabQuery } from '../../hooks/useSpeedLabQuery';
import { buildSpeedLabQuery } from '../../utils/equipment-speed-history-query';
import {
  formatSpeedDuration,
  resolveSpeedReferenceLines,
  speedUnitForArea,
} from '../../utils/equipment-speed-analysis-chart';
import { hasSpeedLabChartOverlay } from '../../utils/speed-reference-chart-annotations';
import {
  bucketFromApiBuckets,
  bucketFromRawRows,
  filterChartBucketsInWindow,
  filterRawRowsInWindow,
} from '../../utils/multi-machine-speed-bucket';
import type { Machine, ProductionArea } from '../../types';
import type { EquipmentOeeAnalyticsScope, EquipmentOeeMode } from '../../utils/equipmentOeeDisplay';
import {
  fmtDur,
  fmtIctFull,
  fmtIctHour,
  machineDisplayName,
  totalSegmentDuration,
} from '../../utils/speed-lab-format';
import '../../styles/speed-lab.css';
import '../../styles/equipment-speed-panel.css';

const AREA_LABELS: Record<ProductionArea, string> = {
  drawing: 'Drawing',
  stranding: 'Stranding',
  armoring: 'Armoring',
  sheathing: 'Sheathing',
};

const AREA_ORDER: ProductionArea[] = ['drawing', 'stranding', 'armoring', 'sheathing'];

type SpeedLabProps = {
  machines: Machine[];
  machinesLoading?: boolean;
  equipmentOeeMode: EquipmentOeeMode;
  onEquipmentOeeModeChange: (mode: EquipmentOeeMode) => void;
  equipmentOeeScope: EquipmentOeeAnalyticsScope;
  equipmentOeeRollupLoading: boolean;
  equipmentOeeRollupError: string | null;
  referenceDate: string;
  onReferenceDateChange: (isoDate: string) => void;
  pastIsoShiftNumber: 1 | 2 | 3;
  onPastIsoShiftNumberChange: (n: 1 | 2 | 3) => void;
};

export function SpeedLab({
  machines,
  machinesLoading = false,
  equipmentOeeMode,
  onEquipmentOeeModeChange,
  equipmentOeeScope,
  equipmentOeeRollupLoading,
  equipmentOeeRollupError,
  referenceDate,
  onReferenceDateChange,
  pastIsoShiftNumber,
  onPastIsoShiftNumberChange,
}: SpeedLabProps) {
  const [bucketSec, setBucketSec] = useState(30);
  const [selectedMachineId, setSelectedMachineId] = useState<string | null>(null);

  const machineNameById = useMemo(() => {
    const map: Record<string, string> = {};
    for (const m of machines) {
      if (m.id && m.name) map[m.id] = m.name;
    }
    return map;
  }, [machines]);

  const machineLabel = useCallback(
    (id: string) => machineDisplayName(id, machineNameById),
    [machineNameById]
  );

  const machinesByArea = useMemo(() => {
    const grouped = new Map<ProductionArea, Machine[]>();
    for (const area of AREA_ORDER) grouped.set(area, []);
    for (const m of machines) {
      const list = grouped.get(m.area);
      if (list) list.push(m);
    }
    for (const list of grouped.values()) {
      list.sort((a, b) => machineLabel(a.id).localeCompare(machineLabel(b.id), 'vi'));
    }
    return grouped;
  }, [machines, machineLabel]);

  useEffect(() => {
    if (!selectedMachineId && machines.length > 0) {
      setSelectedMachineId(machines[0].id);
    }
  }, [machines, selectedMachineId]);

  const speedQuery = useMemo(
    () => buildSpeedLabQuery(equipmentOeeMode, referenceDate, pastIsoShiftNumber, new Date()),
    [equipmentOeeMode, referenceDate, pastIsoShiftNumber]
  );

  const windowStartMs = speedQuery.chartWindowStart.getTime();
  const windowEndMs = speedQuery.chartWindowEnd.getTime();

  const rangeKey = useMemo(
    () =>
      `${equipmentOeeMode}|${referenceDate}|${pastIsoShiftNumber}|${speedQuery.queryStart.toISOString()}|${speedQuery.queryEnd.toISOString()}|${bucketSec}|${selectedMachineId}`,
    [
      equipmentOeeMode,
      referenceDate,
      pastIsoShiftNumber,
      speedQuery.queryStart,
      speedQuery.queryEnd,
      bucketSec,
      selectedMachineId,
    ]
  );

  const {
    data: detailData,
    loading: detailLoading,
    error: detailError,
    refetch: refetchDetail,
  } = useSpeedLabQuery({
    machineId: selectedMachineId,
    queryStart: speedQuery.queryStart,
    queryEnd: speedQuery.queryEnd,
    bucketSec,
    rangeKey,
    enabled: !machinesLoading && Boolean(selectedMachineId),
  });

  const speedHistoryFetchKey = useMemo(
    () =>
      `${equipmentOeeMode}|${referenceDate}|${pastIsoShiftNumber}|${speedQuery.queryStart.toISOString()}|${speedQuery.chartWindowEnd.toISOString()}|${speedQuery.bucketSec}|refs|${selectedMachineId}`,
    [
      equipmentOeeMode,
      referenceDate,
      pastIsoShiftNumber,
      speedQuery.queryStart,
      speedQuery.chartWindowEnd,
      speedQuery.bucketSec,
      selectedMachineId,
    ]
  );

  const speedHistory = useEquipmentSpeedHistory({
    machineId: selectedMachineId,
    queryStart: speedQuery.queryStart,
    queryEnd: speedQuery.queryEnd,
    chartWindowEnd: speedQuery.chartWindowEnd,
    pollMs: speedQuery.pollMs,
    bucketSec: speedQuery.bucketSec,
    rangeKey: speedHistoryFetchKey,
  });

  const activeSpeedHistory = useMemo(() => {
    if (!speedHistory.data || speedHistory.data.rangeKey !== speedHistoryFetchKey) return null;
    return speedHistory.data.response;
  }, [speedHistory.data, speedHistoryFetchKey]);

  const detailMachine = machines.find((m) => m.id === selectedMachineId) ?? null;

  const speedReferenceLines = useMemo(
    () =>
      resolveSpeedReferenceLines(
        activeSpeedHistory?.points ?? [],
        activeSpeedHistory?.summary.currentTargetSpeed ?? detailMachine?.targetSpeed ?? null
      ),
    [
      activeSpeedHistory?.points,
      activeSpeedHistory?.summary.currentTargetSpeed,
      detailMachine?.targetSpeed,
    ]
  );

  const unit = speedUnitForArea(detailMachine?.area);

  const detailRawInWin = useMemo(() => {
    if (!detailData?.rawRows?.length) return [];
    return filterRawRowsInWindow(detailData.rawRows, windowStartMs, windowEndMs);
  }, [detailData?.rawRows, windowStartMs, windowEndMs]);

  const detailTrendBuckets = useMemo(() => {
    const sqlBuckets = detailData?.buckets?.length
      ? filterChartBucketsInWindow(
          bucketFromApiBuckets(detailData.buckets),
          windowStartMs,
          windowEndMs
        )
      : [];

    const singleCaModes: EquipmentOeeMode[] = [
      'realtime',
      'shift_live',
      'shift_1',
      'shift_2',
      'shift_3',
      'past_shift',
    ];
    const isSingleCa = singleCaModes.includes(equipmentOeeMode);

    if (!isSingleCa && sqlBuckets.length) return sqlBuckets;
    if (detailRawInWin.length) return bucketFromRawRows(detailRawInWin, bucketSec);
    return sqlBuckets;
  }, [
    detailData?.buckets,
    detailRawInWin,
    bucketSec,
    windowStartMs,
    windowEndMs,
    equipmentOeeMode,
  ]);

  const speedSegs = detailData?.inferredSegments?.fromActualSpeed ?? [];
  const oeeSegs = detailData?.inferredSegments?.fromRunningTime ?? [];

  const detailRunningRows = useMemo(() => {
    const singleCaModes: EquipmentOeeMode[] = [
      'realtime',
      'shift_live',
      'shift_1',
      'shift_2',
      'shift_3',
      'past_shift',
    ];
    if (!singleCaModes.includes(equipmentOeeMode) && detailData?.buckets?.length) {
      return detailData.buckets.map((b) => ({
        timestamp: b.timestamp,
        actualSpeed: b.actualSpeed,
        targetSpeed: b.targetSpeed,
        runningTimeSeconds: b.runningTimeSeconds,
        plannedTimeSeconds: detailData.summary.plannedTimeSec,
        performance: b.performance,
        availability: null,
        quality: null,
        oee: null,
        productionOrderId: null,
      }));
    }
    if (detailRawInWin.length) return detailRawInWin;
    return detailData?.rawRows ?? [];
  }, [detailData, detailRawInWin, equipmentOeeMode]);

  const hasSpeedReferenceLines =
    speedReferenceLines.vKtcn != null || speedReferenceLines.vDesign != null;

  const speedChartOverlay = useMemo(
    () => ({
      referenceLines: hasSpeedReferenceLines ? speedReferenceLines : null,
      proposedTargetSpeed: activeSpeedHistory?.summary.proposedTargetSpeed ?? null,
      productNotes: activeSpeedHistory?.productNotes ?? [],
    }),
    [
      hasSpeedReferenceLines,
      speedReferenceLines,
      activeSpeedHistory?.summary.proposedTargetSpeed,
      activeSpeedHistory?.productNotes,
    ]
  );

  const hasChartOverlay = hasSpeedLabChartOverlay(speedChartOverlay);
  const speedNotesLongSpan = windowEndMs - windowStartMs > 36 * 3600 * 1000;

  const shiftLabel = speedQuery.sectionSubtitle ?? `Ca ${pastIsoShiftNumber} · ${referenceDate}`;
  const windowHours = ((windowEndMs - windowStartMs) / 3_600_000).toFixed(1);
  const selectedName = selectedMachineId ? machineLabel(selectedMachineId) : '—';
  const hasData = (detailData?.meta.rawRowCount ?? 0) > 0;

  return (
    <div className="speed-lab-root max-w-[1280px] mx-auto">
      <header className="speed-lab-header">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-lg font-semibold text-white m-0 mb-1">
              Phân tích tốc độ máy (SQL live)
            </h1>
            <p className="speed-lab-sub m-0">
              Truy vấn <code className="text-[#4fffbc]">oee_calculations</code> theo máy · bucket{' '}
              {bucketSec}s · ICT (+07)
            </p>
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium bg-[#4FFFBC]/15 text-[#4FFFBC] border border-[#4FFFBC]/30">
            <Database size={14} />
            SQL live
          </span>
        </div>
      </header>

      <EquipmentOeeToolbar
        mode={equipmentOeeMode}
        onModeChange={onEquipmentOeeModeChange}
        scope={equipmentOeeScope}
        loading={equipmentOeeRollupLoading}
        error={equipmentOeeRollupError}
        referenceDate={referenceDate}
        onReferenceDateChange={onReferenceDateChange}
        pastIsoShiftNumber={pastIsoShiftNumber}
        onPastIsoShiftNumberChange={onPastIsoShiftNumberChange}
      />

      <div className="speed-lab-controls">
        <label className="speed-lab-control">
          <span className="speed-lab-field-label">Máy / dây chuyền</span>
          <select
            value={selectedMachineId ?? ''}
            onChange={(e) => setSelectedMachineId(e.target.value || null)}
            disabled={machinesLoading || machines.length === 0}
            className="speed-lab-select"
          >
            {AREA_ORDER.map((area) => {
              const list = machinesByArea.get(area) ?? [];
              if (!list.length) return null;
              return (
                <optgroup key={area} label={AREA_LABELS[area]}>
                  {list.map((m) => (
                    <option key={m.id} value={m.id}>
                      {machineLabel(m.id)}
                    </option>
                  ))}
                </optgroup>
              );
            })}
          </select>
        </label>

        <label className="speed-lab-control">
          <span className="speed-lab-field-label">Bucket (giây)</span>
          <input
            type="number"
            min={5}
            max={300}
            step={5}
            value={bucketSec}
            onChange={(e) => setBucketSec(Number(e.target.value) || 30)}
            className="speed-lab-input-narrow"
          />
        </label>

        <button
          type="button"
          className="speed-lab-btn inline-flex items-center gap-2"
          onClick={() => refetchDetail()}
          disabled={detailLoading || !selectedMachineId}
        >
          <RefreshCw size={16} className={detailLoading ? 'animate-spin' : ''} />
          Phân tích
        </button>
      </div>

      <p className="speed-lab-sub mb-3">
        <strong>{selectedName}</strong>
        {detailMachine?.area ? ` · ${AREA_LABELS[detailMachine.area]}` : ''} · Khung:{' '}
        <strong>{shiftLabel}</strong> · {fmtIctHour(windowStartMs)} → {fmtIctHour(windowEndMs)} ICT (
        {windowHours}h)
      </p>

      <p id="speed-lab-status" className="speed-lab-sub min-h-[1.25rem] mb-3">
        {machinesLoading ? (
          'Đang tải danh sách máy…'
        ) : detailLoading && !detailData ? (
          `Đang truy vấn oee_calculations cho ${selectedName}…`
        ) : detailError ? (
          <span className="speed-lab-err">{detailError}</span>
        ) : detailData ? (
          hasData ? (
            <span className="speed-lab-ok">
              {detailData.meta.rawRowCount.toLocaleString('vi-VN')} dòng · peak{' '}
              {detailData.summary.peakSpeed.toFixed(1)} {unit} · dừng{' '}
              {detailData.summary.zeroSpeedPct.toFixed(1)}%
            </span>
          ) : (
            <span className="speed-lab-warn-text">
              Không có dữ liệu trong khung ca đã chọn — thử đổi ngày/ca hoặc máy khác.
            </span>
          )
        ) : (
          'Chọn máy, ngày/ca và bấm Phân tích.'
        )}
      </p>

      {selectedMachineId && (
        <section>
          {detailLoading && !detailData ? (
            <div className="speed-lab-panel text-center speed-lab-sub py-12">
              Đang tải dữ liệu tốc độ…
            </div>
          ) : (
            <>
              <div className="speed-lab-cards">
                <div className="speed-lab-card">
                  <div className="k">Dòng raw</div>
                  <div className="v">{(detailData?.meta.rawRowCount ?? 0).toLocaleString('vi-VN')}</div>
                </div>
                <div className="speed-lab-card">
                  <div className="k">Peak speed</div>
                  <div className="v">
                    {(detailData?.summary.peakSpeed ?? 0).toFixed(1)} {unit}
                  </div>
                </div>
                <div className="speed-lab-card">
                  <div className="k">Dừng (speed=0)</div>
                  <div className="v">
                    {(detailData?.summary.zeroSpeedPct ?? 0).toFixed(1)}% (
                    {fmtDur(detailData?.summary.stoppedDurationSec ?? 0)})
                  </div>
                </div>
                <div className="speed-lab-card">
                  <div className="k">OEE chạy cuối ca</div>
                  <div className="v">
                    {fmtDur(detailData?.summary.finalRunningTimeSec ?? 0)} /{' '}
                    {fmtDur(detailData?.summary.plannedTimeSec ?? 0)}
                  </div>
                </div>
                <div className="speed-lab-card">
                  <div className="k">Đoạn dừng ≥2p</div>
                  <div className="v">{detailData?.summary.stopSegmentCount ?? 0}</div>
                </div>
              </div>

              <div className="speed-lab-panel equipment-speed-panel mb-4">
                <div className="grid gap-3 mb-4 responsive-grid-4">
                  <div className="p-3 rounded-lg bg-white/5 border border-white/10">
                    <div className="speed-text-muted text-xs mb-1">Tốc độ ổn định (median)</div>
                    <div className="text-xl speed-accent-green">
                      {activeSpeedHistory?.summary.stableRunningMedian != null
                        ? `${activeSpeedHistory.summary.stableRunningMedian.toFixed(2)} ${unit}`
                        : '—'}
                    </div>
                  </div>
                  <div className="p-3 rounded-lg bg-white/5 border border-white/10">
                    <div className="speed-text-muted text-xs mb-1">ICT hiện tại</div>
                    <div className="text-xl speed-accent-green">
                      {activeSpeedHistory?.summary.currentTargetSpeed != null
                        ? `${activeSpeedHistory.summary.currentTargetSpeed.toFixed(2)} ${unit}`
                        : detailMachine?.targetSpeed != null
                          ? `${detailMachine.targetSpeed.toFixed(2)} ${unit}`
                          : '—'}
                    </div>
                  </div>
                  <div className="p-3 rounded-lg bg-white/5 border border-white/10">
                    <div className="speed-text-muted text-xs mb-1">Thời gian dừng (speed analysis)</div>
                    <div className="text-xl speed-accent-cyan">
                      {formatSpeedDuration(activeSpeedHistory?.summary.stoppedDurationSec ?? 0)}
                    </div>
                  </div>
                  <div className="p-3 rounded-lg bg-white/5 border border-[#F59E0B]/30">
                    <div className="speed-text-muted text-xs mb-1">ICT đề xuất (read-only)</div>
                    <div className="text-xl speed-accent-ict">
                      {activeSpeedHistory?.summary.proposedTargetSpeed != null
                        ? `${activeSpeedHistory.summary.proposedTargetSpeed.toFixed(2)} ${unit}`
                        : '—'}
                    </div>
                    {activeSpeedHistory?.summary.deltaVsTargetPct != null ? (
                      <div className="text-xs text-white/50 mt-1">
                        vs ICT hiện tại (
                        {activeSpeedHistory.summary.currentTargetSpeed?.toFixed(2) ?? '—'}):{' '}
                        {activeSpeedHistory.summary.deltaVsTargetPct > 0 ? '+' : ''}
                        {activeSpeedHistory.summary.deltaVsTargetPct}%
                      </div>
                    ) : null}
                  </div>
                </div>

                {activeSpeedHistory?.productNotes ? (
                  <EquipmentSpeedProductNotes
                    notes={activeSpeedHistory.productNotes}
                    unit={unit}
                    longSpan={speedNotesLongSpan}
                  />
                ) : speedHistory.loading ? (
                  <p className="speed-lab-sub text-xs mb-0">Đang tải sản phẩm &amp; tốc độ chuyên môn…</p>
                ) : null}
              </div>

              <h2 className="speed-lab-section-title">Trend tốc độ</h2>
              {(hasSpeedReferenceLines ||
                activeSpeedHistory?.summary.proposedTargetSpeed != null) && (
                <p className="speed-lab-sub mb-2 text-xs">
                  Đường gióng (Equipment Details):{' '}
                  {speedReferenceLines.vKtcn != null && (
                    <span className="text-[#4FFFBC] font-semibold">
                      V_KTCN {speedReferenceLines.vKtcn.toFixed(2)} {unit}
                    </span>
                  )}
                  {speedReferenceLines.vKtcn != null && speedReferenceLines.vDesign != null && ' · '}
                  {speedReferenceLines.vDesign != null && (
                    <span className="text-white font-semibold">
                      V_design {speedReferenceLines.vDesign.toFixed(2)} {unit}
                    </span>
                  )}
                  {activeSpeedHistory?.summary.proposedTargetSpeed != null && (
                    <>
                      {(hasSpeedReferenceLines ? ' · ' : '')}
                      <span className="text-[#FFB86C] font-semibold">
                        ICT đề xuất {activeSpeedHistory.summary.proposedTargetSpeed.toFixed(2)} {unit}
                      </span>
                    </>
                  )}
                </p>
              )}
              <div className="speed-lab-panel p-4">
                {detailTrendBuckets.length > 0 ? (
                  <>
                    <DetailSpeedTrendChart
                      buckets={detailTrendBuckets}
                      winStartMs={windowStartMs}
                      winEndMs={windowEndMs}
                      unit={unit}
                      chartOverlay={hasChartOverlay ? speedChartOverlay : null}
                      isDrawingArea={detailMachine?.area === 'drawing'}
                    />
                    {hasChartOverlay && (
                      <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-[10px] text-white/50">
                        {hasSpeedReferenceLines && (
                          <>
                            <span>
                              <span
                                className="inline-block w-3 h-2 rounded-sm mr-1 align-middle"
                                style={{ backgroundColor: 'rgba(79, 255, 188, 0.35)' }}
                              />
                              Vùng tốc độ chuẩn (0 → V_KTCN)
                            </span>
                            <span>
                              <span className="inline-block w-3 h-2 rounded-sm bg-[#EF4444]/30 mr-1 align-middle" />
                              Vùng tối ưu (V_KTCN → V_design)
                            </span>
                          </>
                        )}
                        {activeSpeedHistory?.summary.proposedTargetSpeed != null && (
                          <span>
                            <span className="inline-block w-4 h-0 border-t-2 border-dashed border-[#FFB86C] mr-1 align-middle" />
                            ICT đề xuất
                          </span>
                        )}
                        {(activeSpeedHistory?.productNotes?.length ?? 0) > 0 && (
                          <span className="text-white/40">Dải màu = PO / sản phẩm</span>
                        )}
                      </div>
                    )}
                  </>
                ) : (
                  <p className="speed-lab-sub text-center py-8">
                    {detailLoading ? 'Đang tải…' : 'Không có dữ liệu bucket trong ca.'}
                  </p>
                )}
              </div>

              {speedSegs.length > 0 && (
                <>
                  <h2 className="speed-lab-section-title">Timeline chạy / dừng</h2>
                  <div className="speed-lab-gantt-panel">
                    <div className="speed-lab-gantt-row">
                      <div className="speed-lab-gantt-label">
                        <span>
                          Theo <strong>actual_speed</strong>
                        </span>
                        <span>
                          Chạy {fmtDur(totalSegmentDuration(speedSegs, ['running']))} · Dừng{' '}
                          {fmtDur(totalSegmentDuration(speedSegs, ['stopped']))} · Ramp{' '}
                          {fmtDur(totalSegmentDuration(speedSegs, ['creep']))}
                        </span>
                      </div>
                      <SpeedLabGanttTrack
                        segments={speedSegs}
                        windowStartMs={windowStartMs}
                        windowEndMs={windowEndMs}
                        labels={{ running: 'Chạy', creep: 'Ramp', stopped: 'Dừng' }}
                      />
                    </div>
                    <div className="speed-lab-gantt-row">
                      <div className="speed-lab-gantt-label">
                        <span>
                          Theo <strong>running_time_seconds</strong>
                        </span>
                        <span>
                          Cộng {fmtDur(totalSegmentDuration(oeeSegs, ['oee_accum']))} · Đóng băng{' '}
                          {fmtDur(totalSegmentDuration(oeeSegs, ['oee_frozen']))}
                        </span>
                      </div>
                      <SpeedLabGanttTrack
                        segments={oeeSegs}
                        windowStartMs={windowStartMs}
                        windowEndMs={windowEndMs}
                        labels={{
                          oee_accum: 'OEE cộng dồn',
                          oee_frozen: 'OEE đóng băng',
                        }}
                      />
                    </div>
                    <SpeedLabGanttLegend />
                  </div>
                </>
              )}

              {detailRunningRows.length > 0 ? (
                <>
                  <h2 className="speed-lab-section-title">running_time_seconds tích lũy</h2>
                  <div className="speed-lab-panel p-4">
                    <RunningTimeTrendChart
                      rawRows={detailRunningRows}
                      winStartMs={windowStartMs}
                      winEndMs={windowEndMs}
                      plannedSec={detailData?.summary.plannedTimeSec ?? 28800}
                    />
                  </div>
                </>
              ) : null}

              {(detailData?.stopBlocks.length ?? 0) > 0 && (
                <>
                  <h2 className="speed-lab-section-title">Đoạn dừng (≥2 phút)</h2>
                  <table className="speed-lab-table speed-lab-panel">
                    <thead>
                      <tr>
                        <th>#</th>
                        <th>Bắt đầu (ICT)</th>
                        <th>Kết thúc</th>
                        <th>Thời lượng</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detailData!.stopBlocks.slice(0, 15).map((seg, i) => (
                        <tr key={`${seg.startMs}-${i}`}>
                          <td>{i + 1}</td>
                          <td>{fmtIctFull(seg.startMs)}</td>
                          <td>{fmtIctFull(seg.endMs)}</td>
                          <td>{fmtDur(seg.durationSec)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </>
              )}
            </>
          )}
        </section>
      )}

      <div className="speed-lab-note">
        <strong>Cách dùng:</strong> Chọn máy và ngày/ca trên toolbar · bấm <strong>Phân tích</strong>{' '}
        để truy vấn SQL trực tiếp. Đổi máy hoặc ca sẽ tự tải lại dữ liệu.
      </div>
    </div>
  );
}

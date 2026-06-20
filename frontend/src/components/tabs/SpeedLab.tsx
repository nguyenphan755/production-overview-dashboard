import { useCallback, useEffect, useMemo, useState } from 'react';
import { Database, RefreshCw } from 'lucide-react';
import { EquipmentOeeToolbar } from '../EquipmentOeeToolbar';
import {
  CompareOverlayChart,
  DetailSpeedTrendChart,
  RunningTimeTrendChart,
} from '../speed-lab/MultiMachineSpeedChart';
import { SpeedLabGanttLegend, SpeedLabGanttTrack } from '../speed-lab/SpeedLabGanttTrack';
import { SpeedLabMiniGrid } from '../speed-lab/SpeedLabMiniGrid';
import { useSpeedLabMultiQuery } from '../../hooks/useSpeedLabMultiQuery';
import { useSpeedLabQuery } from '../../hooks/useSpeedLabQuery';
import { buildEquipmentSpeedHistoryQuery } from '../../utils/equipment-speed-history-query';
import { speedUnitForArea } from '../../utils/equipment-speed-analysis-chart';
import {
  bucketFromApiBuckets,
  bucketFromRawRows,
  filterRawRowsInWindow,
} from '../../utils/multi-machine-speed-bucket';
import type { Machine } from '../../types';
import type { EquipmentOeeAnalyticsScope, EquipmentOeeMode } from '../../utils/equipmentOeeDisplay';
import {
  fmtDur,
  fmtIctFull,
  fmtIctHour,
  machineColor,
  totalSegmentDuration,
} from '../../utils/speed-lab-format';
import '../../styles/speed-lab.css';

type SpeedLabView = 'compare' | 'mini' | 'detail';

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
  const [activeView, setActiveView] = useState<SpeedLabView>('compare');
  const [selectedDetailMachine, setSelectedDetailMachine] = useState<string | null>(null);
  const [compareSelected, setCompareSelected] = useState<Set<string>>(new Set());

  const speedQuery = useMemo(
    () =>
      buildEquipmentSpeedHistoryQuery(
        equipmentOeeMode,
        referenceDate,
        pastIsoShiftNumber,
        equipmentOeeScope,
        new Date()
      ),
    [
      equipmentOeeMode,
      referenceDate,
      pastIsoShiftNumber,
      equipmentOeeScope?.start,
      equipmentOeeScope?.end,
      equipmentOeeScope?.dayDate,
    ]
  );

  const windowStartMs = speedQuery.chartWindowStart.getTime();
  const windowEndMs = speedQuery.chartWindowEnd.getTime();

  const rangeKey = useMemo(
    () =>
      `${equipmentOeeMode}|${referenceDate}|${pastIsoShiftNumber}|${speedQuery.queryStart.toISOString()}|${speedQuery.queryEnd.toISOString()}|${bucketSec}`,
    [
      equipmentOeeMode,
      referenceDate,
      pastIsoShiftNumber,
      speedQuery.queryStart,
      speedQuery.queryEnd,
      bucketSec,
    ]
  );

  const {
    data: multiData,
    loading: multiLoading,
    error: multiError,
    refetch: refetchMulti,
  } = useSpeedLabMultiQuery({
    queryStart: speedQuery.queryStart,
    queryEnd: speedQuery.queryEnd,
    bucketSec,
    rangeKey,
    enabled: !machinesLoading,
  });

  const detailMachineId = selectedDetailMachine ?? multiData?.machineIds.find(
    (id) => (multiData.machines[id]?.meta.rawRowCount ?? 0) > 0
  ) ?? multiData?.machineIds[0] ?? null;

  const { data: detailData, loading: detailLoading } = useSpeedLabQuery({
    machineId: activeView === 'detail' && detailMachineId ? detailMachineId : null,
    queryStart: speedQuery.queryStart,
    queryEnd: speedQuery.queryEnd,
    bucketSec,
    rangeKey: `${rangeKey}|detail|${detailMachineId}`,
    enabled: activeView === 'detail' && Boolean(detailMachineId),
  });

  const machineList = useMemo(() => {
    if (!multiData) return [];
    return multiData.machineIds
      .map((id) => {
        const m = multiData.machines[id];
        if (!m) return null;
        return {
          id,
          apiBuckets: m.buckets,
          rawRowCount: m.meta.rawRowCount,
          peak: m.summary.peakSpeed,
          zeroPct: m.summary.zeroSpeedPct,
          stopSec: m.summary.stoppedDurationSec,
          finalOeeRun: m.summary.finalRunningTimeSec,
          planned: m.summary.plannedTimeSec,
          stopBlocks: m.summary.stopSegmentCount,
        };
      })
      .filter((x): x is NonNullable<typeof x> => x != null);
  }, [multiData]);

  const withData = machineList.filter((m) => m.rawRowCount > 0).map((m) => m.id);

  useEffect(() => {
    if (multiData) {
      setCompareSelected(new Set(withData));
    }
  }, [multiData?.meta.windowStart, multiData?.meta.windowEnd, multiData?.meta.bucketSec, withData.join(',')]);

  const compareIds = useMemo(() => [...compareSelected], [compareSelected]);

  const selectMachine = useCallback((id: string) => {
    setSelectedDetailMachine(id);
    setActiveView('detail');
  }, []);

  const toggleCompare = useCallback((id: string, checked: boolean) => {
    setCompareSelected((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }, []);

  const compareSeries = useMemo(
    () =>
      machineList.map((m) => ({
        id: m.id,
        buckets: bucketFromApiBuckets(m.apiBuckets),
      })),
    [machineList]
  );

  /** Detail trend: bucket from same raw rows as Gantt (HTML analyzeMachine pipeline) */
  const detailRawInWin = useMemo(() => {
    if (!detailData?.rawRows?.length) return [];
    return filterRawRowsInWindow(detailData.rawRows, windowStartMs, windowEndMs);
  }, [detailData?.rawRows, windowStartMs, windowEndMs]);

  const detailTrendBuckets = useMemo(() => {
    if (!detailRawInWin.length) return [];
    return bucketFromRawRows(detailRawInWin, bucketSec);
  }, [detailRawInWin, bucketSec]);

  const miniGridMachines = useMemo(
    () =>
      machineList.map((m) => ({
        id: m.id,
        buckets: bucketFromApiBuckets(m.apiBuckets),
        rawRowCount: m.rawRowCount,
        peak: m.peak,
        zeroPct: m.zeroPct,
      })),
    [machineList]
  );

  const detailMachine = machines.find((m) => m.id === detailMachineId) ?? null;
  const unit = speedUnitForArea(detailMachine?.area);

  const speedSegs = detailData?.inferredSegments?.fromActualSpeed ?? [];
  const oeeSegs = detailData?.inferredSegments?.fromRunningTime ?? [];

  const shiftLabel = speedQuery.sectionSubtitle ?? `Ca ${pastIsoShiftNumber} · ${referenceDate}`;

  return (
    <div className="speed-lab-root max-w-[1280px] mx-auto">
      <header className="speed-lab-header">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-lg font-semibold text-white m-0 mb-1">
              Đối chiếu tốc độ — nhiều máy (SQL live)
            </h1>
            <p className="speed-lab-sub m-0">
              Truy vấn trực tiếp <code className="text-[#4fffbc]">oee_calculations</code> · bucket{' '}
              {bucketSec}s · trục X cố định full ca · ICT (+07)
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

      <div className="flex flex-wrap items-end gap-4 mb-4">
        <label className="block">
          <span className="speed-lab-sub text-xs block mb-1">Bucket (giây)</span>
          <input
            type="number"
            min={5}
            max={300}
            step={5}
            value={bucketSec}
            onChange={(e) => setBucketSec(Number(e.target.value) || 30)}
            className="w-20 rounded-lg bg-white/10 border border-white/25 px-2 py-2 text-white text-sm"
          />
        </label>

        <button
          type="button"
          className="speed-lab-btn inline-flex items-center gap-2"
          onClick={() => refetchMulti()}
          disabled={multiLoading}
        >
          <RefreshCw size={16} className={multiLoading ? 'animate-spin' : ''} />
          Phân tích
        </button>
      </div>

      <p id="speed-lab-status" className="speed-lab-sub min-h-[1.25rem] mb-3">
        {multiLoading && !multiData ? (
          'Đang truy vấn oee_calculations…'
        ) : multiError ? (
          <span className="speed-lab-err">{multiError}</span>
        ) : multiData ? (
          <>
            <span className="speed-lab-ok">Đã phân tích {multiData.meta.machineCount} máy</span>
            {' — '}
            {withData.length > 0 ? (
              `${withData.join(', ')} có dữ liệu trong ca.`
            ) : (
              <span className="speed-lab-warn-text">
                Không có dòng nào trong khung ca đã chọn — thử đổi ngày/ca.
              </span>
            )}
          </>
        ) : (
          'Chọn ngày/ca và bấm Phân tích để truy vấn SQL.'
        )}
      </p>

      {multiData && (
        <section>
          <h2 className="speed-lab-section-title">Tổng quan máy trong ca</h2>
          <div className="speed-lab-panel">
            <p className="speed-lab-sub m-0 mb-2">
              Nguồn: <strong>PostgreSQL oee_calculations</strong> ·{' '}
              <span>
                {machineList.reduce((a, m) => a + m.rawRowCount, 0).toLocaleString('vi-VN')} dòng ·{' '}
                {multiData.meta.machineCount} máy ({multiData.meta.machinesWithData} có dữ liệu trong ca)
              </span>{' '}
              · Khung: <strong>{shiftLabel}</strong> · {fmtIctHour(windowStartMs)} →{' '}
              {fmtIctHour(windowEndMs)}
            </p>
            <table className="speed-lab-table">
              <thead>
                <tr>
                  <th>Máy</th>
                  <th>Dòng raw</th>
                  <th>Peak speed</th>
                  <th>Dừng (speed=0)</th>
                  <th>OEE chạy cuối</th>
                  <th>Đoạn dừng ≥2p</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {machineList.map((m, idx) => (
                  <tr
                    key={m.id}
                    className={`clickable${m.id === detailMachineId && activeView === 'detail' ? ' active' : ''}`}
                    onClick={() => selectMachine(m.id)}
                  >
                    <td>
                      <span
                        className="speed-lab-dot align-middle mr-1.5"
                        style={{ background: machineColor(idx) }}
                      />
                      <strong>{m.id}</strong>
                    </td>
                    <td>{m.rawRowCount.toLocaleString('vi-VN')}</td>
                    <td>
                      {m.peak.toFixed(1)} {unit}
                    </td>
                    <td>
                      {m.zeroPct.toFixed(1)}% ({fmtDur(m.stopSec)})
                    </td>
                    <td>
                      {fmtDur(m.finalOeeRun)} / {fmtDur(m.planned)}
                    </td>
                    <td>{m.stopBlocks}</td>
                    <td>
                      <button
                        type="button"
                        className="speed-lab-btn secondary text-xs py-1 px-2"
                        onClick={(e) => {
                          e.stopPropagation();
                          selectMachine(m.id);
                        }}
                      >
                        Chi tiết
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="speed-lab-tabs">
            {(
              [
                ['compare', 'So sánh overlay'],
                ['mini', 'Lưới mini chart'],
                ['detail', 'Chi tiết 1 máy'],
              ] as const
            ).map(([view, label]) => (
              <button
                key={view}
                type="button"
                className={`speed-lab-tab${activeView === view ? ' active' : ''}`}
                onClick={() => setActiveView(view)}
              >
                {label}
              </button>
            ))}
          </div>

          {activeView === 'compare' && (
            <div>
              <div className="speed-lab-panel">
                <h3 className="speed-lab-section-subtitle">Chọn máy hiển thị trên 1 chart</h3>
                <div className="speed-lab-chips">
                  {machineList.map((m, idx) => {
                    const hasData = m.rawRowCount > 0;
                    const checked = compareSelected.has(m.id);
                    return (
                      <label key={m.id} className="speed-lab-chip">
                        <input
                          type="checkbox"
                          checked={checked}
                          disabled={!hasData}
                          onChange={(e) => toggleCompare(m.id, e.target.checked)}
                        />
                        <span className="speed-lab-dot" style={{ background: machineColor(idx) }} />
                        {m.id}
                        {hasData ? '' : ' (không có dữ liệu ca)'}
                      </label>
                    );
                  })}
                </div>
                <div className="mt-2 flex gap-2">
                  <button
                    type="button"
                    className="speed-lab-btn secondary text-sm"
                    onClick={() =>
                      setCompareSelected(new Set(machineList.filter((m) => m.rawRowCount > 0).map((m) => m.id)))
                    }
                  >
                    Chọn tất cả
                  </button>
                  <button
                    type="button"
                    className="speed-lab-btn secondary text-sm"
                    onClick={() => setCompareSelected(new Set())}
                  >
                    Bỏ chọn
                  </button>
                </div>
              </div>
              <div className="speed-lab-panel p-4">
                <CompareOverlayChart
                  series={compareSeries}
                  selectedIds={compareIds}
                  winStartMs={windowStartMs}
                  winEndMs={windowEndMs}
                  unit={unit}
                />
              </div>
            </div>
          )}

          {activeView === 'mini' && (
            <SpeedLabMiniGrid
              machines={miniGridMachines}
              windowStartMs={windowStartMs}
              windowEndMs={windowEndMs}
              onSelect={selectMachine}
            />
          )}

          {activeView === 'detail' && detailMachineId && (
            <div>
              <div className="flex flex-wrap items-end gap-4 mb-3">
                <label className="block">
                  <span className="speed-lab-sub text-xs block mb-1">Máy chi tiết</span>
                  <select
                    value={detailMachineId}
                    onChange={(e) => setSelectedDetailMachine(e.target.value)}
                    className="min-w-[160px] rounded-lg bg-white/10 border border-white/25 px-3 py-2 text-white text-sm"
                    style={{ colorScheme: 'dark' }}
                  >
                    {machineList.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.id} ({m.rawRowCount.toLocaleString('vi-VN')} dòng)
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              {detailLoading && !detailData ? (
                <div className="speed-lab-panel text-center speed-lab-sub py-8">
                  Đang tải chi tiết (raw rows + Gantt)…
                </div>
              ) : (
                <>
                  <div className="speed-lab-cards">
                    <div className="speed-lab-card">
                      <div className="k">Máy</div>
                      <div className="v">{detailMachineId}</div>
                    </div>
                    <div className="speed-lab-card">
                      <div className="k">Dòng raw</div>
                      <div className="v">
                        {(detailData?.meta.rawRowCount ?? 0).toLocaleString('vi-VN')}
                      </div>
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
                      <div className="k">Đoạn dừng (≥2 phút)</div>
                      <div className="v">{detailData?.summary.stopSegmentCount ?? 0}</div>
                    </div>
                  </div>

                  <h2 className="speed-lab-section-title">1. Trend tốc độ (bucket)</h2>
                  <div className="speed-lab-panel p-4">
                    {detailTrendBuckets.length > 0 ? (
                      <DetailSpeedTrendChart
                        buckets={detailTrendBuckets}
                        winStartMs={windowStartMs}
                        winEndMs={windowEndMs}
                        unit={unit}
                      />
                    ) : (
                      <p className="speed-lab-sub text-center py-8">
                        {detailLoading ? 'Đang tải raw rows…' : 'Không có dữ liệu bucket trong ca.'}
                      </p>
                    )}
                  </div>

                  {speedSegs.length > 0 && (
                    <>
                      <h2 className="speed-lab-section-title">2. Timeline chạy / dừng</h2>
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

                  {detailRawInWin.length > 0 ? (
                    <>
                      <h2 className="speed-lab-section-title">3. running_time_seconds tích lũy</h2>
                      <div className="speed-lab-panel p-4">
                        <RunningTimeTrendChart
                          rawRows={detailRawInWin}
                          winStartMs={windowStartMs}
                          winEndMs={windowEndMs}
                          plannedSec={detailData?.summary.plannedTimeSec ?? 28800}
                        />
                      </div>
                    </>
                  ) : null}

                  {(detailData?.stopBlocks.length ?? 0) > 0 && (
                    <table className="speed-lab-table speed-lab-panel">
                      <thead>
                        <tr>
                          <th>#</th>
                          <th>Bắt đầu (ICT)</th>
                          <th>Kết thúc</th>
                          <th>Thời lượng</th>
                          <th>Nguồn</th>
                        </tr>
                      </thead>
                      <tbody>
                        {detailData!.stopBlocks.slice(0, 15).map((seg, i) => (
                          <tr key={`${seg.startMs}-${i}`}>
                            <td>{i + 1}</td>
                            <td>{fmtIctFull(seg.startMs)}</td>
                            <td>{fmtIctFull(seg.endMs)}</td>
                            <td>{fmtDur(seg.durationSec)}</td>
                            <td>actual_speed = 0</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </>
              )}
            </div>
          )}
        </section>
      )}

      <div className="speed-lab-note">
        <strong>Cách dùng:</strong>
        <ul>
          <li>
            Chọn ngày/ca trên toolbar OEE · bấm <strong>Phân tích</strong> để truy vấn SQL trực tiếp (không
            cần export CSV).
          </li>
          <li>
            Tab <strong>So sánh overlay</strong>: nhiều đường tốc độ trên 1 chart ·{' '}
            <strong>Lưới mini</strong>: xem nhanh từng máy · <strong>Chi tiết</strong>: Gantt +
            running_time như file HTML mẫu.
          </li>
        </ul>
      </div>
    </div>
  );
}

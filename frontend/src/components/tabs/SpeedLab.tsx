import { useMemo, useState, useCallback } from 'react';
import { Gauge, Upload, Database, RefreshCw } from 'lucide-react';
import { EquipmentOeeToolbar } from '../EquipmentOeeToolbar';
import { SpeedLabTrendChart } from '../speed-lab/SpeedLabTrendChart';
import { useSpeedLabQuery } from '../../hooks/useSpeedLabQuery';
import { buildEquipmentSpeedHistoryQuery } from '../../utils/equipment-speed-history-query';
import { formatSpeedDuration } from '../../utils/equipment-speed-analysis-chart';
import { speedUnitForArea } from '../../utils/equipment-speed-analysis-chart';
import type { Machine } from '../../types';
import type { EquipmentOeeAnalyticsScope, EquipmentOeeMode } from '../../utils/equipmentOeeDisplay';
import {
  bucketCsvRows,
  csvSummary,
  filterCsvRowsInWindow,
  formatIctMs,
  parseOeeCsvText,
  type CsvOeeRow,
  type CsvSpeedBucket,
} from '../../utils/speed-lab-csv';
import '../../styles/equipment-speed-panel.css';

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
  const [machineId, setMachineId] = useState<string>('');
  const [bucketSec, setBucketSec] = useState(30);
  const [csvRows, setCsvRows] = useState<CsvOeeRow[] | null>(null);
  const [csvFileName, setCsvFileName] = useState<string | null>(null);

  const selectedMachine = useMemo(
    () => machines.find((m) => m.id === machineId) ?? null,
    [machines, machineId]
  );

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

  const rangeKey = useMemo(
    () =>
      `${machineId}|${equipmentOeeMode}|${referenceDate}|${pastIsoShiftNumber}|${speedQuery.chartWindowStart.toISOString()}|${speedQuery.chartWindowEnd.toISOString()}|${bucketSec}`,
    [
      machineId,
      equipmentOeeMode,
      referenceDate,
      pastIsoShiftNumber,
      speedQuery.chartWindowStart,
      speedQuery.chartWindowEnd,
      bucketSec,
    ]
  );

  const { data, loading, error, refetch } = useSpeedLabQuery({
    machineId: machineId || null,
    queryStart: speedQuery.queryStart,
    queryEnd: speedQuery.queryEnd,
    bucketSec,
    rangeKey,
    enabled: Boolean(machineId),
  });

  const windowStartMs = speedQuery.chartWindowStart.getTime();
  const windowEndMs = speedQuery.chartWindowEnd.getTime();
  const unit = speedUnitForArea(selectedMachine?.area);

  const sqlChartPoints = useMemo(() => {
    if (!data?.buckets.length) return [];
    return data.buckets.map((b) => ({
      timestampMs: new Date(b.timestamp).getTime(),
      actualSpeed: b.actualSpeed,
      targetSpeed: b.targetSpeed,
    }));
  }, [data?.buckets]);

  const csvInWindow = useMemo(() => {
    if (!csvRows?.length) return null;
    return filterCsvRowsInWindow(csvRows, windowStartMs, windowEndMs);
  }, [csvRows, windowStartMs, windowEndMs]);

  const csvBuckets: CsvSpeedBucket[] | null = useMemo(() => {
    if (!csvInWindow?.length) return null;
    return bucketCsvRows(csvInWindow, bucketSec);
  }, [csvInWindow, bucketSec]);

  const csvSum = useMemo(
    () => (csvInWindow ? csvSummary(csvInWindow) : null),
    [csvInWindow]
  );

  const onCsvFile = useCallback((file: File | null) => {
    if (!file) {
      setCsvRows(null);
      setCsvFileName(null);
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result ?? '');
      const parsed = parseOeeCsvText(text);
      setCsvRows(parsed);
      setCsvFileName(file.name);
      if (parsed.length && !machineId) {
        setMachineId(parsed[0].machineId);
      }
    };
    reader.readAsText(file);
  }, [machineId]);

  const sortedMachines = useMemo(
    () => [...machines].sort((a, b) => a.id.localeCompare(b.id)),
    [machines]
  );

  return (
    <div className="max-w-[1400px] mx-auto">
      <div className="mb-4 flex flex-wrap items-start gap-3">
        <div className="flex items-center gap-2">
          <Gauge className="w-6 h-6 text-[#4FFFBC]" strokeWidth={2.5} />
          <div>
            <h1 className="text-xl text-white font-semibold">Speed Lab</h1>
            <p className="text-sm speed-text-muted">
              Truy vấn tốc độ từ <code className="text-[#4FFFBC]/80">oee_calculations</code> — đối chiếu
              với CSV (sh04-speed-compare.html)
            </p>
          </div>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium bg-[#4FFFBC]/15 text-[#4FFFBC] border border-[#4FFFBC]/30">
          <Database size={14} />
          Phase 1 · SQL strict
        </span>
      </div>

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

      <div className="mb-4 rounded-xl bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-xl border border-white/20 p-4">
        <div className="flex flex-wrap items-end gap-4">
          <label className="block min-w-[200px]">
            <span className="speed-text-muted text-xs block mb-1">Máy</span>
            <select
              value={machineId}
              onChange={(e) => setMachineId(e.target.value)}
              disabled={machinesLoading}
              className="w-full rounded-lg bg-white/10 border border-white/25 px-3 py-2 text-white text-sm"
              style={{ colorScheme: 'dark' }}
            >
              <option value="">— Chọn máy —</option>
              {sortedMachines.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.id} {m.name ? `(${m.name})` : ''}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="speed-text-muted text-xs block mb-1">Bucket (giây)</span>
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
            onClick={() => refetch()}
            disabled={!machineId || loading}
            className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold bg-[#4FFFBC] text-[#0A1E3A] hover:brightness-110 disabled:opacity-40"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            Truy vấn SQL
          </button>

          <label className="inline-flex items-center gap-2 cursor-pointer rounded-lg border border-dashed border-white/25 px-3 py-2 text-sm speed-text-soft hover:bg-white/5">
            <Upload size={16} />
            <span>{csvFileName ?? 'Upload CSV đối chiếu'}</span>
            <input
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(e) => onCsvFile(e.target.files?.[0] ?? null)}
            />
          </label>
          {csvFileName ? (
            <button
              type="button"
              className="text-xs speed-text-subtle underline"
              onClick={() => onCsvFile(null)}
            >
              Xóa CSV
            </button>
          ) : null}
        </div>

        {speedQuery.sectionSubtitle ? (
          <p className="mt-3 text-sm speed-text-muted">{speedQuery.sectionSubtitle}</p>
        ) : null}
        <p className="mt-1 text-xs speed-text-subtle">
          Khung chart (ICT): {formatIctMs(windowStartMs)} → {formatIctMs(windowEndMs)}
          {data?.meta ? (
            <>
              {' '}
              · API fetch đến {formatIctMs(new Date(speedQuery.queryEnd).getTime())}
            </>
          ) : null}
        </p>
      </div>

      {!machineId ? (
        <div className="rounded-xl border border-white/15 bg-white/5 p-8 text-center speed-text-muted">
          Chọn máy và khung OEE để truy vấn SQL.
        </div>
      ) : loading && !data ? (
        <div className="rounded-xl border border-white/15 bg-white/5 p-8 text-center speed-text-muted">
          Đang truy vấn oee_calculations…
        </div>
      ) : error && !data?.buckets.length ? (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-6 text-center text-red-300 text-sm">
          {error}
        </div>
      ) : data && data.buckets.length === 0 ? (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-6 text-center text-amber-200 text-sm">
          Không có dữ liệu trong <code>oee_calculations</code> cho khung đã chọn (strict — không fallback
          telemetry).
        </div>
      ) : data ? (
        <>
          <div className="grid gap-3 mb-4 grid-cols-2 md:grid-cols-3 lg:grid-cols-6">
            <SummaryCard label="Nguồn" value={data.meta.source} accent />
            <SummaryCard label="Bucket SQL" value={`${data.meta.bucketCount} điểm`} />
            <SummaryCard label="Raw SQL" value={String(data.meta.rawRowCount)} />
            <SummaryCard
              label="Peak speed"
              value={`${data.summary.peakSpeed.toFixed(2)} ${unit}`}
              highlight
            />
            <SummaryCard label="Dừng (speed=0)" value={`${data.summary.zeroSpeedPct}%`} />
            <SummaryCard
              label="OEE chạy cuối"
              value={`${formatSpeedDuration(data.summary.finalRunningTimeSec)} / ${formatSpeedDuration(data.summary.plannedTimeSec)}`}
            />
          </div>

          {csvSum ? (
            <div className="mb-4 rounded-xl border border-[#FFB86C]/30 bg-[#FFB86C]/5 p-4">
              <h3 className="text-sm font-medium text-[#FFB86C] mb-2">Đối chiếu CSV vs SQL</h3>
              <div className="grid gap-2 text-xs md:grid-cols-2 lg:grid-cols-4 speed-text-soft">
                <CompareRow
                  label="Số dòng / bucket"
                  sql={`${data.meta.bucketCount} bucket · ${data.meta.rawRowCount} raw`}
                  csv={`${csvSum.rowCount} raw · ${csvBuckets?.length ?? 0} bucket`}
                />
                <CompareRow
                  label="Peak speed"
                  sql={data.summary.peakSpeed.toFixed(2)}
                  csv={csvSum.peak.toFixed(2)}
                />
                <CompareRow
                  label="% speed = 0"
                  sql={`${data.summary.zeroSpeedPct}%`}
                  csv={`${csvSum.zeroPct.toFixed(1)}%`}
                />
                <CompareRow
                  label="running_time cuối"
                  sql={String(data.summary.finalRunningTimeSec)}
                  csv={String(csvSum.finalRunning)}
                />
              </div>
              {csvFileName ? (
                <p className="mt-2 text-[10px] speed-text-subtle">File: {csvFileName}</p>
              ) : null}
            </div>
          ) : null}

          <div className="equipment-speed-panel mb-4 rounded-xl bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-xl border border-[#4FFFBC]/30 shadow-2xl p-4">
            <h2 className="text-lg text-white font-medium mb-1">1. Trend tốc độ (bucket {bucketSec}s)</h2>
            <p className="text-xs speed-text-subtle mb-3">
              Trục X cố định full ca · đường trắng = SQL · đường cam nét đứt = CSV (nếu có)
            </p>
            <SpeedLabTrendChart
              sqlPoints={sqlChartPoints}
              windowStartMs={windowStartMs}
              windowEndMs={windowEndMs}
              unit={unit}
              csvBuckets={csvBuckets}
            />
          </div>

          {data.stopBlocks.length > 0 ? (
            <div className="rounded-xl border border-white/15 bg-white/5 p-4 mb-4">
              <h3 className="text-sm text-white font-medium mb-2">
                Đoạn dừng (speed=0, ≥2 phút) — {data.summary.stopSegmentCount} đoạn
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="speed-text-muted text-left border-b border-white/10">
                      <th className="py-2 pr-3">#</th>
                      <th className="py-2 pr-3">Bắt đầu (ICT)</th>
                      <th className="py-2 pr-3">Kết thúc</th>
                      <th className="py-2">Thời lượng</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.stopBlocks.map((b, i) => (
                      <tr key={`${b.startMs}-${i}`} className="border-b border-white/5 speed-text-soft">
                        <td className="py-2 pr-3">{i + 1}</td>
                        <td className="py-2 pr-3">{formatIctMs(b.startMs)}</td>
                        <td className="py-2 pr-3">{formatIctMs(b.endMs)}</td>
                        <td className="py-2">{formatSpeedDuration(b.durationSec)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}

          <p className="text-[11px] speed-text-subtle">
            Phase 2 sẽ thêm Gantt (speed + running_time + machine_status_history) và chart running_time
            tích lũy.
          </p>
        </>
      ) : null}
    </div>
  );
}

function SummaryCard({
  label,
  value,
  highlight,
  accent,
}: {
  label: string;
  value: string;
  highlight?: boolean;
  accent?: boolean;
}) {
  return (
    <div className="p-3 rounded-lg bg-white/5 border border-white/10">
      <div className="speed-text-muted text-[10px] uppercase tracking-wide mb-1">{label}</div>
      <div
        className={`text-base font-semibold ${highlight ? 'speed-accent-green' : accent ? 'text-[#4FFFBC]' : 'text-white'}`}
      >
        {value}
      </div>
    </div>
  );
}

function CompareRow({ label, sql, csv }: { label: string; sql: string; csv: string }) {
  const match = sql === csv;
  return (
    <div className="rounded-lg bg-black/20 p-2">
      <div className="speed-text-muted mb-1">{label}</div>
      <div>
        SQL: <span className="text-white">{sql}</span>
      </div>
      <div>
        CSV: <span className={match ? 'text-[#4FFFBC]' : 'text-[#FFB86C]'}>{csv}</span>
      </div>
    </div>
  );
}

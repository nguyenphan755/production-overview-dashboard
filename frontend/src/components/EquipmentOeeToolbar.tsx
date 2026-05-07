import type { EquipmentOeeAnalyticsScope, EquipmentOeeMode } from '../utils/equipmentOeeDisplay';
import { equipmentOeeModeLabelVi } from '../utils/equipmentOeeDisplay';

type EquipmentOeeToolbarProps = {
  mode: EquipmentOeeMode;
  onModeChange: (mode: EquipmentOeeMode) => void;
  scope: EquipmentOeeAnalyticsScope;
  loading: boolean;
  error: string | null;
  compact?: boolean;
  referenceDate: string;
  onReferenceDateChange: (isoDate: string) => void;
  pastIsoShiftNumber: 1 | 2 | 3;
  onPastIsoShiftNumberChange: (n: 1 | 2 | 3) => void;
};

const modes: EquipmentOeeMode[] = [
  'realtime',
  'shift_live',
  'shift_1',
  'shift_2',
  'shift_3',
  'day',
  'yesterday',
  'week',
  'calendar_day',
  'past_shift',
];

function formatTodayYmd(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function reportTierLabelVi(tier: NonNullable<EquipmentOeeAnalyticsScope>['reportTier']): string {
  switch (tier) {
    case 'settled_only':
      return 'Toàn bộ từ snapshot đã khóa';
    case 'settled_partial':
      return 'Một phần snapshot + rollup (thiếu POST settle hoặc thiếu máy)';
    case 'rollup_only':
      return 'Chưa có snapshot — chỉ rollup ca đã đóng';
    default:
      return '';
  }
}

function formatScopeHint(scope: EquipmentOeeAnalyticsScope, mode: EquipmentOeeMode): string | null {
  if (!scope || mode === 'realtime') return null;
  try {
    const a = new Date(scope.start);
    const b = new Date(scope.end);
    const df = new Intl.DateTimeFormat('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
    if (mode === 'calendar_day' && scope.dayDate) {
      return `Ngày ${scope.dayDate} (00:00–${scope.dayDate === formatTodayYmd() ? 'hiện tại' : '24:00'}) · ${df.format(a)} → ${df.format(b)}`;
    }
    const shiftLike: EquipmentOeeMode[] = ['shift_live', 'shift_1', 'shift_2', 'shift_3', 'past_shift'];
    if (shiftLike.includes(mode) && scope.shiftId) {
      const sid = scope.shiftId || '';
      const m = /^shift-(\d+)-(\d{4})-(\d{2})-(\d{2})$/.exec(sid);
      const shiftVi = m ? `Ca ${m[1]} (${m[4]}/${m[3]}/${m[2]})` : sid.replace(/^shift-/, 'Ca ');
      const tier =
        mode === 'past_shift' && scope.reportTier ? ` · ${reportTierLabelVi(scope.reportTier)}` : '';
      return `${shiftVi} · ${df.format(a)} → ${df.format(b)}${tier}`;
    }
    return `${df.format(a)} → ${df.format(b)}`;
  } catch {
    return null;
  }
}

export function EquipmentOeeToolbar({
  mode,
  onModeChange,
  scope,
  loading,
  error,
  compact,
  referenceDate,
  onReferenceDateChange,
  pastIsoShiftNumber,
  onPastIsoShiftNumberChange,
}: EquipmentOeeToolbarProps) {
  const hint = formatScopeHint(scope, mode);

  const showDatePicker =
    mode === 'shift_1' ||
    mode === 'shift_2' ||
    mode === 'shift_3' ||
    mode === 'calendar_day' ||
    mode === 'past_shift';

  return (
    <div
      className={
        compact
          ? 'rounded-lg bg-white/5 border border-white/15 px-3 py-2'
          : 'rounded-xl bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-xl border border-white/20 px-4 py-3 mb-6'
      }
    >
      <div className="flex flex-col gap-y-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-white/90 text-sm font-medium tracking-wide">
          Overall Equipment Effectiveness (OEE){' '}
          <span className="text-white/50 font-normal">— chọn khung thời gian</span>
        </div>
        <div className="flex flex-wrap items-center gap-1.5 max-w-full">
          {modes.map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => onModeChange(m)}
              className={`px-2.5 py-1.5 rounded-lg text-[11px] sm:text-xs font-semibold tracking-wide border transition-all ${
                mode === m
                  ? 'bg-[#34E7F8]/25 border-[#34E7F8]/60 text-[#34E7F8]'
                  : 'bg-white/5 border-white/15 text-white/70 hover:bg-white/10 hover:text-white'
              }`}
            >
              {equipmentOeeModeLabelVi(m)}
            </button>
          ))}
          {loading && mode !== 'realtime' ? (
            <span className="text-white/40 text-xs ml-1">Đang tải…</span>
          ) : null}
        </div>
      </div>

      {showDatePicker ? (
        <div className="mt-3 flex flex-wrap items-center gap-3 border-t border-white/10 pt-3">
          <label className="flex flex-wrap items-center gap-2 text-white/70 text-xs">
            <span className="text-white/55 shrink-0">Chọn ngày</span>
            <input
              type="date"
              value={referenceDate}
              onChange={(e) => onReferenceDateChange(e.target.value)}
              className="rounded-md bg-white/10 border border-white/20 px-2 py-1 text-white text-xs min-w-0"
            />
            <span className="text-white/40 text-[10px] max-w-[220px] leading-snug">
              Dùng cho Ca 1–3, &quot;Cả ngày&quot;, và Ca đã qua (ISO).
            </span>
          </label>
        </div>
      ) : null}

      {mode === 'past_shift' ? (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <span className="text-white/50 text-xs">Ca (ISO):</span>
          {([1, 2, 3] as const).map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => onPastIsoShiftNumberChange(n)}
              className={`px-2.5 py-1 rounded-md text-xs font-semibold border ${
                pastIsoShiftNumber === n
                  ? 'bg-[#34E7F8]/20 border-[#34E7F8]/50 text-[#34E7F8]'
                  : 'bg-white/5 border-white/15 text-white/70 hover:bg-white/10'
              }`}
            >
              {n}
            </button>
          ))}
        </div>
      ) : null}

      {hint ? (
        <div className="mt-2 text-white/45 text-xs">
          {mode === 'past_shift' ? 'Báo cáo ca đã khóa:' : 'Cửa sổ analytics:'} {hint}
        </div>
      ) : null}
      {error ? (
        <div className="mt-2 text-amber-300/90 text-xs">{error}</div>
      ) : null}

      {mode === 'past_shift' ? (
        <div className="mt-2 text-white/40 text-[11px] leading-snug space-y-1">
          <p>
            <strong className="text-white/55">Chuẩn báo cáo (TPM / ISO 22400):</strong> OEE = Availability × Performance ×
            Quality trên ca đã hoàn thành. Ưu tiên{' '}
            <code className="text-white/45 bg-black/20 px-1 rounded">oee_shift_settlements</code>; thiếu snapshot thì
            rollup cùng công thức.
          </p>
        </div>
      ) : mode === 'shift_live' ? (
        <div className="mt-2 text-white/40 text-[11px] leading-snug">
          Ca đang chạy — rollup đến phút hiện tại (cửa sổ chưa khóa hoàn toàn). Ca 1–3 theo ngày chọn là cửa sổ đủ 8h đã
          định nghĩa.
        </div>
      ) : mode !== 'realtime' ? (
        <div className="mt-2 text-white/40 text-[11px] leading-snug">
          A/P/Q theo rollup máy trong cửa sổ đã chọn. Khác snapshot realtime PLC/MES.
        </div>
      ) : null}
    </div>
  );
}

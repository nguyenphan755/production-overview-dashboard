import type { EquipmentOeeAnalyticsScope, EquipmentOeeMode } from '../utils/equipmentOeeDisplay';
import { equipmentOeeModeLabelVi } from '../utils/equipmentOeeDisplay';
import type { LucideIcon } from 'lucide-react';
import { Activity, BarChart3, CalendarDays, Clock3, History, Radio, TimerReset } from 'lucide-react';

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

const modeIcons: Record<EquipmentOeeMode, LucideIcon> = {
  realtime: Radio,
  shift_live: TimerReset,
  shift_1: Clock3,
  shift_2: Clock3,
  shift_3: Clock3,
  day: Activity,
  yesterday: History,
  week: BarChart3,
  calendar_day: CalendarDays,
  past_shift: CalendarDays,
};

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
      return `Ngày sản xuất ${scope.dayDate} (3 ca · 06:00→06:00) · ${df.format(a)} → ${df.format(b)}`;
    }
    if ((mode === 'day' || mode === 'yesterday') && scope.dayDate) {
      const label = mode === 'day' ? 'Hôm nay' : 'Hôm qua';
      return `${label} — ngày sản xuất ${scope.dayDate} (3 ca) · ${df.format(a)} → ${df.format(b)}`;
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
      <div className="flex flex-col items-center gap-y-2 text-center sm:flex-row sm:items-center sm:justify-between sm:text-left">
        <div className="flex flex-nowrap items-center justify-center gap-2 sm:justify-start overflow-x-auto">
          <span
            className="inline-flex items-center rounded-md px-2.5 py-1 text-xs sm:text-sm font-semibold tracking-wide shadow-sm"
            style={{
              color: '#E0F7FF',
              background: 'rgba(14, 165, 233, 0.28)',
              border: '1px solid rgba(125, 211, 252, 0.85)',
              boxShadow: '0 0 0 1px rgba(14,165,233,0.18) inset',
            }}
          >
            Overall Equipment Effectiveness (OEE)
          </span>
          <span
            className="inline-flex items-center px-2 py-1 text-[11px] sm:text-xs font-medium tracking-wide whitespace-nowrap shrink-0"
            style={{
              color: '#9FD6FF',
            }}
          >
            Chọn khung thời gian
          </span>
        </div>
        <div className="flex items-start sm:items-center justify-center gap-2 w-full sm:w-auto">
          <span className="px-1 text-sm font-semibold select-none" style={{ color: '#8FA7C2' }}>
            |
          </span>
          <div className="flex items-center gap-2 flex-nowrap overflow-x-auto pb-1 flex-1 sm:flex-none">
            {modes.map((m) => {
              const isActive = mode === m;
              const Icon = modeIcons[m];
              return (
                <button
                  key={m}
                  type="button"
                  onClick={() => onModeChange(m)}
                  className="inline-flex items-center justify-start gap-2 w-[128px] h-9 rounded-lg text-[11px] sm:text-xs font-semibold tracking-wide border transition-all hover:brightness-110 whitespace-nowrap px-3 shrink-0 leading-none"
                  style={
                    isActive
                      ? {
                          color: '#EAFEFF',
                          background: 'rgba(34, 211, 238, 0.34)',
                          borderColor: 'rgba(103, 232, 249, 0.95)',
                          boxShadow: '0 0 0 1px rgba(34,211,238,0.25) inset',
                        }
                      : {
                          color: '#E2ECFA',
                          background: 'rgba(15, 27, 43, 0.92)',
                          borderColor: 'rgba(76, 103, 131, 0.95)',
                        }
                  }
                >
                  <Icon
                    size={13}
                    strokeWidth={2.2}
                    style={{
                      opacity: isActive ? 1 : 0.82,
                      flexShrink: 0,
                      color: isActive ? '#EAFEFF' : '#D9E8FB',
                    }}
                  />
                  <span
                    className="truncate"
                    style={{
                      color: isActive ? '#EAFEFF' : '#E2ECFA',
                      textShadow: isActive
                        ? '0 0 8px rgba(125, 211, 252, 0.35)'
                        : '0 0 6px rgba(148, 163, 184, 0.25)',
                    }}
                  >
                    {equipmentOeeModeLabelVi(m)}
                  </span>
                </button>
              );
            })}
          </div>
          {loading && mode !== 'realtime' ? (
            <span className="text-xs ml-1" style={{ color: '#B8C8DA' }}>
              Đang tải…
            </span>
          ) : null}
        </div>
      </div>

      {showDatePicker ? (
        <div className="mt-3 flex flex-wrap items-center gap-3 border-t border-white/10 pt-3">
          <label className="flex flex-wrap items-center gap-2 text-sm" style={{ color: '#CFE8FF' }}>
            <span className="font-medium shrink-0" style={{ color: '#C7E2FF' }}>
              Chọn ngày
            </span>
            <input
              type="date"
              value={referenceDate}
              onChange={(e) => onReferenceDateChange(e.target.value)}
              className="rounded-md bg-white/10 border border-white/30 px-2.5 py-1.5 text-[#EAF4FF] text-sm min-w-0"
              style={{ colorScheme: 'dark', color: '#EAF4FF' }}
            />
            <span className="text-xs max-w-[260px] leading-snug" style={{ color: '#AFC5DE' }}>
              Dùng cho Ca 1–3, &quot;OEE theo ngày&quot;, và Ca đã qua (ISO).
            </span>
          </label>
        </div>
      ) : null}

      {mode === 'past_shift' ? (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium" style={{ color: '#CBE3FF' }}>
            Ca (ISO):
          </span>
          {([1, 2, 3] as const).map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => onPastIsoShiftNumberChange(n)}
              className="inline-flex items-center justify-center min-w-[42px] h-8 px-3 rounded-md text-xs font-semibold border hover:brightness-110"
              style={
                pastIsoShiftNumber === n
                  ? {
                      color: '#EAFEFF',
                      background: 'rgba(34, 211, 238, 0.34)',
                      borderColor: 'rgba(103, 232, 249, 0.95)',
                      boxShadow: '0 0 0 1px rgba(34,211,238,0.25) inset',
                    }
                  : {
                      color: '#E2ECFA',
                      background: 'rgba(15, 27, 43, 0.92)',
                      borderColor: 'rgba(76, 103, 131, 0.95)',
                    }
              }
            >
              {n}
            </button>
          ))}
        </div>
      ) : null}

      {hint ? (
        <div className="mt-2 text-sm font-medium" style={{ color: '#CAE0F6' }}>
          {mode === 'past_shift' ? 'Báo cáo ca đã khóa:' : 'Cửa sổ analytics:'} {hint}
        </div>
      ) : null}
      {error ? (
        <div className="mt-2 text-xs font-medium" style={{ color: '#FCD34D' }}>
          {error}
        </div>
      ) : null}

      {mode === 'past_shift' ? (
        <div className="mt-2 mes-data-muted text-[11px] leading-snug space-y-1">
          <p>
            <strong className="text-white/55">Chuẩn báo cáo (TPM / ISO 22400):</strong> OEE = Availability × Performance ×
            Quality trên ca đã hoàn thành. Ưu tiên{' '}
            <code className="text-white/45 bg-black/20 px-1 rounded">oee_shift_settlements</code>; thiếu snapshot thì
            rollup cùng công thức.
          </p>
        </div>
      ) : mode === 'shift_live' ? (
        <div className="mt-2 mes-data-muted text-[11px] leading-snug">
          Ca đang chạy — rollup đến phút hiện tại (cửa sổ chưa khóa hoàn toàn). Ca 1–3 theo ngày chọn là cửa sổ đủ 8h đã
          định nghĩa.
        </div>
      ) : mode !== 'realtime' ? (
        <div className="mt-2 mes-data-muted text-[11px] leading-snug">
          A/P/Q theo rollup máy trong cửa sổ đã chọn. Khác snapshot realtime PLC/MES.
        </div>
      ) : null}
    </div>
  );
}

import { useMemo } from 'react';
import type { OeeWaterfallQueryResponse } from '../../types/oee-analytics-lab';
import { fmtDur } from '../../utils/speed-lab-format';
import { CollapsibleLabSection } from './CollapsibleLabSection';

const BUCKET_COLORS: Record<string, string> = {
  pot_sec: '#3b82f6',
  pst_sec: '#6b7280',
  ppt_sec: '#2563eb',
  dtl_sec: '#f59e0b',
  ot_sec: '#10b981',
  speed_loss_plan_sec: '#eab308',
  not_plan_sec: '#059669',
  quality_loss_sec: '#ef4444',
  fpt_sec: '#22c55e',
};

const BUCKET_ROWS = [
  { key: 'pot_sec', label: 'POT', name: 'Plant Operating Time' },
  { key: 'pst_sec', label: 'PST', name: 'Planned Shutdown', loss: true },
  { key: 'ppt_sec', label: 'PPT', name: 'Planned Production Time' },
  { key: 'dtl_sec', label: 'DTL', name: 'Downtime >5ph', loss: true },
  { key: 'ot_sec', label: 'OT', name: 'Operating Time' },
  { key: 'speed_loss_plan_sec', label: 'Speed↓', name: 'Speed Loss (OT−NOT)', loss: true },
  { key: 'not_plan_sec', label: 'NOT', name: 'Net Operating Time' },
  { key: 'quality_loss_sec', label: 'Qual↓', name: 'Quality Loss', loss: true },
  { key: 'fpt_sec', label: 'FPT', name: 'Fully Productive Time' },
] as const;

type OeeWaterfallPanelProps = {
  data: OeeWaterfallQueryResponse | null;
  loading: boolean;
  error: string | null;
  unit: string;
  windowLabel: string;
};

function fmtPct(v: number | null | undefined): string {
  if (v == null || Number.isNaN(v)) return '—';
  return `${v.toFixed(1)}%`;
}

function fmtNum(n: number | null | undefined, d = 1): string {
  if (n == null || Number.isNaN(n)) return '—';
  return n.toLocaleString('vi-VN', { maximumFractionDigits: d });
}

export function OeeWaterfallPanel({ data, loading, error, unit, windowLabel }: OeeWaterfallPanelProps) {
  const pot = data?.buckets.pot_sec ?? 1;
  const maxBarSec = pot;

  const barHeights = useMemo(() => {
    if (!data) return [];
    return BUCKET_ROWS.map((row) => {
      const sec = (data.buckets as Record<string, number | null>)[row.key] ?? 0;
      const pct = maxBarSec > 0 ? ((sec ?? 0) / maxBarSec) * 100 : 0;
      const displayPct = Math.min(100, pct);
      return { ...row, sec: sec ?? 0, pct, displayPct, color: BUCKET_COLORS[row.key] ?? '#64748b' };
    });
  }, [data, maxBarSec]);

  if (loading && !data) {
    return (
      <div className="speed-lab-panel oee-waterfall-panel py-10 text-center speed-lab-sub">
        Đang tính OEE waterfall…
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="speed-lab-panel oee-waterfall-panel py-6 text-center speed-lab-err text-sm">
        {error}
      </div>
    );
  }

  if (!data) return null;

  const { apq, buckets, performance: perf, compare, processing: pr } = data;

  return (
    <div className="oee-waterfall-panel">
      <div className="speed-lab-panel oee-waterfall-hero-card mb-3">
        <div className="flex flex-wrap items-start justify-between gap-2 mb-3">
          <div>
            <div className="text-[0.7rem] uppercase tracking-wider text-white/45 mb-1">
              OEE Waterfall · {data.meta.methodology}
            </div>
            <div className="text-sm text-white/70">{windowLabel}</div>
          </div>
          <span className="speed-lab-chip text-[0.65rem]">
            DTL &gt; {data.meta.dtl_threshold_sec}s
          </span>
        </div>

        <div className="oee-hero-split">
          <div className="oee-hero-metrics">
            <div className="oee-metrics-row-1">
              <div className="oee-apq-item oee-main">
                <div className="v oee-main-value">{fmtPct(apq.oee_plan_pct)}</div>
                <div className="l">OEE (P_plan)</div>
              </div>
            </div>

            <div className="oee-metrics-row-2 oee-apq-row">
              <div className="oee-apq-item a">
                <div className="v">{fmtPct(apq.availability_pct)}</div>
                <div className="l">A · OT/PPT</div>
              </div>
              <div className="oee-apq-item p">
                <div className="v">{fmtPct(apq.performance_plan_pct)}</div>
                <div className="l">P_plan · NOT/OT</div>
              </div>
              <div className="oee-apq-item p2">
                <div className="v">{fmtPct(apq.performance_study_pct)}</div>
                <div className="l">P_study</div>
              </div>
              <div className="oee-apq-item q">
                <div className="v">{fmtPct(apq.quality_pct)}</div>
                <div className="l">Q</div>
              </div>
            </div>

            <p className="speed-lab-sub text-xs mb-0 oee-metrics-footnote oee-hero-footnote">
              Speed Loss = OT − NOT = {fmtDur(buckets.speed_loss_plan_sec)} · NOT ={' '}
              {fmtDur(buckets.not_plan_sec ?? 0)} · L = {fmtNum(perf.l_total_m)} m (
              {data.data_quality.l_total_source})
            </p>
          </div>

          <div className="oee-hero-chart">
            <div className="oee-chart-title">Waterfall · % POT</div>
            <div className="oee-waterfall-bars">
              {barHeights.map((row) => (
                <div key={row.key} className="oee-wf-col" title={`${row.name}: ${fmtDur(row.sec)}`}>
                  <div className="oee-wf-bar-wrap">
                    <div
                      className={`oee-wf-bar${row.loss ? ' loss' : ''}`}
                      style={{
                        height: `${Math.max(3, row.displayPct)}%`,
                        backgroundColor: row.color,
                      }}
                    />
                  </div>
                  <div className="oee-wf-label">{row.label}</div>
                  <div className="oee-wf-pct">{row.pct.toFixed(0)}%</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="speed-lab-cards oee-kpi-row">
        <div className="speed-lab-card compact">
          <div className="k">ILS plan</div>
          <div className="v text-base">
            {perf.ils_plan != null ? `${fmtNum(perf.ils_plan)} ${unit}` : '—'}
          </div>
        </div>
        <div className="speed-lab-card compact">
          <div className="k">ILS study</div>
          <div className="v text-base">
            {perf.ils_study != null ? `${fmtNum(perf.ils_study)} ${unit}` : '—'}
          </div>
        </div>
        <div className="speed-lab-card compact">
          <div className="k">Chạy (status)</div>
          <div className="v text-base">{fmtDur(pr.running_sec)}</div>
        </div>
        <div className="speed-lab-card compact">
          <div className="k">OEE study</div>
          <div className="v text-base">{fmtPct(apq.oee_study_pct)}</div>
        </div>
      </div>

      <CollapsibleLabSection
        title="Chi tiết bucket thời gian"
        subtitle="POT → FPT · phút & % POT"
      >
        <table className="speed-lab-table">
          <thead>
            <tr>
              <th>Bucket</th>
              <th>Phút</th>
              <th>Thời lượng</th>
              <th>% POT</th>
            </tr>
          </thead>
          <tbody>
            {BUCKET_ROWS.map((row) => {
              const sec = (buckets as Record<string, number | null>)[row.key] ?? 0;
              const pct = pot > 0 ? ((sec ?? 0) / pot) * 100 : 0;
              return (
                <tr key={row.key} className={row.key === 'not_plan_sec' ? 'highlight-row' : ''}>
                  <td>
                    <span
                      className="inline-block w-2 h-2 rounded-full mr-1.5 align-middle"
                      style={{ background: BUCKET_COLORS[row.key] }}
                    />
                    <b>{row.label}</b> — {row.name}
                  </td>
                  <td>{fmtNum((sec ?? 0) / 60, 1)}</td>
                  <td>{fmtDur(sec ?? 0)}</td>
                  <td>{pct.toFixed(1)}%</td>
                </tr>
              );
            })}
            <tr className="formula-row">
              <td colSpan={4}>
                <b>A</b> = {buckets.ot_sec}/{buckets.ppt_sec} = {fmtPct(apq.availability_pct)}
                {' · '}
                <b>P_plan</b> = {Math.round(buckets.not_plan_sec ?? 0)}/{buckets.ot_sec} ={' '}
                {fmtPct(apq.performance_plan_pct)}
                {' · '}
                <b>OEE</b> = {fmtPct(apq.oee_plan_pct)} (study: {fmtPct(apq.oee_study_pct)})
              </td>
            </tr>
          </tbody>
        </table>
      </CollapsibleLabSection>

      <CollapsibleLabSection
        title="Công thức & so sánh Performance"
        subtitle="P_v2 vs P_proxy vs P_snapshot"
      >
        <div className="grid gap-3 md:grid-cols-3 mb-3">
          <div className="oee-formula-card">
            <div className="oee-formula-title">P_proxy (cũ)</div>
            <div className="oee-formula-body">
              running / OT = {pr.running_sec.toLocaleString('vi-VN')} / {buckets.ot_sec.toLocaleString('vi-VN')}
            </div>
            <div className="oee-formula-result">{fmtPct(compare.p_proxy_pct)}</div>
            <div className="oee-formula-note">Giả định mọi giây chạy = 100% ILS</div>
          </div>
          <div className="oee-formula-card">
            <div className="oee-formula-title">P_snapshot (MES)</div>
            <div className="oee-formula-body">
              v / target = {fmtNum(perf.snapshot_actual_speed)} / {fmtNum(perf.snapshot_target_speed)}{' '}
              {unit}
            </div>
            <div className="oee-formula-result">{fmtPct(compare.p_snapshot_pct)}</div>
            <div className="oee-formula-note">Một điểm tức thời (oeeCalculator hiện tại)</div>
          </div>
          <div className="oee-formula-card accent">
            <div className="oee-formula-title">P_plan (v2)</div>
            <div className="oee-formula-body">
              NOT = L / ILS × 60 = {fmtNum(buckets.not_plan_sec, 0)} s
              <br />
              L {fmtNum(perf.l_total_m)} m ÷ ILS {fmtNum(perf.ils_plan)}
            </div>
            <div className="oee-formula-result">{fmtPct(apq.performance_plan_pct)}</div>
            <div className="oee-formula-note">
              P_study {fmtPct(apq.performance_study_pct)} (ILS {fmtNum(perf.ils_study)})
            </div>
          </div>
        </div>
        <table className="speed-lab-table">
          <thead>
            <tr>
              <th>Chỉ số</th>
              <th>Giá trị</th>
              <th>Đơn vị</th>
              <th>Nguồn</th>
            </tr>
          </thead>
          <tbody>
            {[
              ['L_total (OK+NG)', fmtNum(perf.l_total_m), 'm', data.data_quality.l_total_source],
              ['ILS_plan', fmtNum(perf.ils_plan), unit, 'target_speed'],
              ['ILS_study', fmtNum(perf.ils_study), unit, 'median stable running'],
              ['ILS gap', perf.ils_gap_pct != null ? `${perf.ils_gap_pct}%` : '—', '—', 'study − plan'],
              ['NOT_plan', fmtNum(buckets.not_plan_sec, 0), 's', 'L / ILS_plan × 60'],
              ['NOT_study', fmtNum(buckets.not_study_sec, 0), 's', 'L / ILS_study × 60'],
              ['Tốc độ TB khi chạy', fmtNum(compare.avg_speed_running_m_min), unit, 'L / (running/60)'],
              ['Speed loss (plan)', fmtDur(buckets.speed_loss_plan_sec), '—', 'OT − NOT_plan'],
              ['P snapshot', fmtPct(compare.p_snapshot_pct), '—', 'v/target tức thời'],
            ].map(([k, v, u, src]) => (
              <tr key={String(k)}>
                <td>{k}</td>
                <td>
                  <b>{v}</b>
                </td>
                <td>{u}</td>
                <td className="text-white/45 text-xs">{src}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {data.note ? <p className="speed-lab-sub text-xs mt-2 mb-0">{data.note}</p> : null}
      </CollapsibleLabSection>

      {(data.breakdown_summary?.length ?? 0) > 0 && (
        <CollapsibleLabSection
          title="Phân rã tổn thất (heuristic)"
          subtitle={`${data.breakdown_summary.length} nhóm từ status history`}
        >
          <table className="speed-lab-table">
            <thead>
              <tr>
                <th>Bucket</th>
                <th>Lý do</th>
                <th>Status</th>
                <th>Phút</th>
                <th>% POT</th>
              </tr>
            </thead>
            <tbody>
              {data.breakdown_summary.slice(0, 12).map((row, i) => (
                <tr key={`${row.bucket}-${row.reason}-${i}`}>
                  <td>{row.bucket}</td>
                  <td>{row.reason}</td>
                  <td>{row.status}</td>
                  <td>{fmtNum(row.seconds / 60, 1)}</td>
                  <td>{row.pct_of_pot.toFixed(1)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CollapsibleLabSection>
      )}
    </div>
  );
}

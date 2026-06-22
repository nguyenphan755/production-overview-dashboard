/**
 * Speed Lab charts — linear X (UTC epoch ms) + ICT tick labels.
 * Must match Gantt positioning (percent from windowStart/windowEnd).
 * Chart.js time scale + date-fns zone adapter shifts data ~7h vs Gantt.
 */
import {
  Chart as ChartJS,
  LineController,
  LineElement,
  PointElement,
  LinearScale,
  Filler,
  Tooltip,
  Legend,
} from 'chart.js';
import { fmtIctFull, fmtIctHour } from './speed-lab-format';
import type { SpeedLabChartOverlay } from './speed-reference-chart-annotations';
import { findProductNoteAtTime } from './equipment-speed-analysis-chart';
import type { SpeedChartBucket } from './multi-machine-speed-bucket';

let registered = false;

export function ensureMultiMachineSpeedChartRegistered(): void {
  if (registered) return;
  ChartJS.register(
    LineController,
    LineElement,
    PointElement,
    LinearScale,
    Filler,
    Tooltip,
    Legend
  );
  registered = true;
}

export function multiMachineChartTimeOpts(
  winStartMs: number,
  winEndMs: number,
  yLabel: string,
  yMax?: number | null,
  tooltipContext?: {
    unit: string;
    buckets: SpeedChartBucket[];
    chartOverlay?: SpeedLabChartOverlay | null;
  }
): import('chart.js').ChartOptions<'line'> {
  const endMs = Math.max(winEndMs, winStartMs + 60_000);
  const unit = tooltipContext?.unit ?? '';
  const buckets = tooltipContext?.buckets ?? [];
  const overlay = tooltipContext?.chartOverlay;

  return {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'index', intersect: false, axis: 'x' },
    animation: false,
    plugins: {
      legend: { labels: { color: '#94a3b8', boxWidth: 12 } },
      tooltip: {
        enabled: true,
        mode: 'index',
        intersect: false,
        backgroundColor: '#0e2f4f',
        titleColor: '#ffffff',
        bodyColor: 'rgba(255,255,255,0.92)',
        borderColor: 'rgba(255,255,255,0.2)',
        borderWidth: 1,
        padding: 10,
        callbacks: {
          title: (items) => (items[0] ? fmtIctFull(Number(items[0].parsed.x)) : ''),
          label: (ctx) => {
            const y = ctx.parsed.y;
            if (y == null || Number.isNaN(Number(y))) return '';
            const suffix = unit ? ` ${unit}` : '';
            return `${ctx.dataset.label}: ${Number(y).toFixed(2)}${suffix}`;
          },
          afterBody: (items) => {
            if (!items.length) return [];
            const xMs = Number(items[0].parsed.x);
            if (!Number.isFinite(xMs)) return [];

            const lines: string[] = [];
            const refs = overlay?.referenceLines;
            const note = findProductNoteAtTime(overlay?.productNotes, xMs);
            if (note) {
              lines.push(`Sản phẩm: ${note.productName}`);
              if (note.orderName) lines.push(`PO: ${note.orderName}`);
            }
            if (refs?.vKtcn != null) {
              lines.push(`V_KTCN: ${refs.vKtcn.toFixed(2)} ${unit}`.trim());
            }
            if (refs?.vDesign != null) {
              lines.push(`V_design: ${refs.vDesign.toFixed(2)} ${unit}`.trim());
            }
            if (overlay?.proposedTargetSpeed != null) {
              lines.push(`ICT đề xuất: ${overlay.proposedTargetSpeed.toFixed(2)} ${unit}`.trim());
            }

            const bucket =
              buckets.find((b) => Math.abs(b.x - xMs) < 500) ??
              buckets[items[0].dataIndex ?? -1];
            if (bucket && bucket.target > 0) {
              const delta = ((bucket.actual - bucket.target) / bucket.target) * 100;
              lines.push(`Δ vs target: ${delta > 0 ? '+' : ''}${delta.toFixed(1)}%`);
            }
            return lines;
          },
        },
      },
    },
    scales: {
      x: {
        type: 'linear',
        min: winStartMs,
        max: endMs,
        ticks: {
          color: '#94a3b8',
          maxTicksLimit: 12,
          callback: (value) => fmtIctHour(Number(value)),
        },
        grid: { color: 'rgba(255,255,255,0.06)' },
        title: { display: true, text: 'Thời gian (ICT)', color: '#64748b' },
      },
      y: {
        min: 0,
        ...(yMax != null && yMax > 0 ? { max: yMax } : {}),
        ticks: { color: '#94a3b8' },
        grid: { color: 'rgba(255,255,255,0.06)' },
        title: { display: true, text: yLabel, color: '#64748b' },
      },
    },
  };
}

export function multiMachineMiniChartOpts(
  winStartMs: number,
  winEndMs: number
): import('chart.js').ChartOptions<'line'> {
  const endMs = Math.max(winEndMs, winStartMs + 60_000);
  return {
    responsive: true,
    maintainAspectRatio: false,
    animation: false,
    plugins: { legend: { display: false } },
    scales: {
      x: { type: 'linear', min: winStartMs, max: endMs, display: false },
      y: { min: 0, display: false },
    },
  };
}

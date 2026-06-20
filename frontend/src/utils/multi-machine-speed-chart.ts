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
  yMax?: number | null
): import('chart.js').ChartOptions<'line'> {
  const endMs = Math.max(winEndMs, winStartMs + 60_000);

  return {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'index', intersect: false },
    animation: false,
    plugins: {
      legend: { labels: { color: '#94a3b8', boxWidth: 12 } },
      tooltip: {
        backgroundColor: '#0e2f4f',
        callbacks: {
          title: (items) => (items[0] ? fmtIctFull(Number(items[0].parsed.x)) : ''),
          label: (ctx) => {
            const y = ctx.parsed.y;
            if (y == null || Number.isNaN(Number(y))) return '';
            return `${ctx.dataset.label}: ${Number(y).toFixed(2)}`;
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

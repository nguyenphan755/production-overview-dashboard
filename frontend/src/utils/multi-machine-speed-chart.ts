/**
 * Chart.js config — exact mirror of chartTimeOpts() in multi-machine-speed-compare.html
 */
import {
  Chart as ChartJS,
  LineController,
  LineElement,
  PointElement,
  LinearScale,
  TimeScale,
  Filler,
  Tooltip,
  Legend,
} from 'chart.js';
import 'chartjs-adapter-date-fns';
import { FACTORY_TIME_ZONE } from './shiftCalculator';
import { fmtIctFull } from './speed-lab-format';

let registered = false;

export function ensureMultiMachineSpeedChartRegistered(): void {
  if (registered) return;
  ChartJS.register(
    LineController,
    LineElement,
    PointElement,
    LinearScale,
    TimeScale,
    Filler,
    Tooltip,
    Legend
  );
  registered = true;
}

/** Same signature & options as HTML chartTimeOpts(yLabel, y2Max) */
export function multiMachineChartTimeOpts(
  winStartMs: number,
  winEndMs: number,
  yLabel: string,
  y2Max?: number | null
): import('chart.js').ChartOptions<'line'> {
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
        },
      },
    },
    scales: {
      x: {
        type: 'time',
        min: winStartMs,
        max: winEndMs,
        time: { unit: 'hour', displayFormats: { hour: 'HH:mm' } },
        adapters: { date: { zone: FACTORY_TIME_ZONE } },
        ticks: { color: '#94a3b8', maxTicksLimit: 10 },
        grid: { color: 'rgba(255,255,255,0.06)' },
        title: { display: true, text: 'Thời gian (ICT)', color: '#64748b' },
      },
      y: {
        min: 0,
        ticks: { color: '#94a3b8' },
        grid: { color: 'rgba(255,255,255,0.06)' },
        title: { display: true, text: yLabel, color: '#64748b' },
      },
      ...(y2Max != null
        ? {
            y1: {
              position: 'right' as const,
              min: 0,
              max: y2Max,
              ticks: { color: '#34e7f8' },
              grid: { drawOnChartArea: false },
              title: { display: true, text: 'running_time (s)', color: '#34e7f8' },
            },
          }
        : {}),
    },
  };
}

/** Mini chart X scale — same as HTML renderMiniGrid */
export function multiMachineMiniChartOpts(
  winStartMs: number,
  winEndMs: number
): import('chart.js').ChartOptions<'line'> {
  return {
    responsive: true,
    maintainAspectRatio: false,
    animation: false,
    plugins: { legend: { display: false } },
    scales: {
      x: { type: 'time', min: winStartMs, max: winEndMs, display: false },
      y: { min: 0, display: false },
    },
  };
}

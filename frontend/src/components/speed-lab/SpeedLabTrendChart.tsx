import { useEffect, useRef } from 'react';
import {
  Chart,
  LineController,
  LineElement,
  PointElement,
  LinearScale,
  Filler,
  Tooltip,
  Legend,
} from 'chart.js';
import type { CsvSpeedBucket } from '../../utils/speed-lab-csv';
import { FACTORY_TIME_ZONE } from '../../utils/shiftCalculator';

let registered = false;

function ensureRegistered() {
  if (registered) return;
  Chart.register(LineController, LineElement, PointElement, LinearScale, Filler, Tooltip, Legend);
  registered = true;
}

export type SpeedLabChartPoint = {
  timestampMs: number;
  actualSpeed: number;
  targetSpeed: number;
};

type SpeedLabTrendChartProps = {
  sqlPoints: SpeedLabChartPoint[];
  windowStartMs: number;
  windowEndMs: number;
  unit: string;
  csvBuckets?: CsvSpeedBucket[] | null;
};

function fmtIct(ms: number): string {
  return new Date(ms).toLocaleTimeString('vi-VN', {
    timeZone: FACTORY_TIME_ZONE,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

function fmtIctFull(ms: number): string {
  return new Date(ms).toLocaleString('vi-VN', {
    timeZone: FACTORY_TIME_ZONE,
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
}

export function SpeedLabTrendChart({
  sqlPoints,
  windowStartMs,
  windowEndMs,
  unit,
  csvBuckets,
}: SpeedLabTrendChartProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartRef = useRef<Chart<'line'> | null>(null);
  const endMs = Math.max(windowEndMs, windowStartMs + 60_000);

  useEffect(() => {
    ensureRegistered();
    const canvas = canvasRef.current;
    if (!canvas || sqlPoints.length === 0) {
      chartRef.current?.destroy();
      chartRef.current = null;
      return;
    }

    chartRef.current?.destroy();

    const allY = [
      ...sqlPoints.map((p) => p.actualSpeed),
      ...sqlPoints.map((p) => p.targetSpeed),
      ...(csvBuckets?.map((b) => b.actual) ?? []),
    ].filter((v) => Number.isFinite(v));
    const peak = allY.length ? Math.max(...allY) : 10;
    const yMax = peak > 0 ? Math.ceil(peak * 1.12) : 10;

    const datasets: import('chart.js').ChartDataset<'line', { x: number; y: number | null }[]>[] = [
      {
        label: `SQL — tốc độ thực (${unit})`,
        data: sqlPoints.map((p) => ({ x: p.timestampMs, y: p.actualSpeed })),
        borderColor: '#ffffff',
        backgroundColor: 'rgba(255,255,255,0.1)',
        fill: true,
        tension: 0.1,
        pointRadius: 0,
        borderWidth: 2,
      },
      {
        label: 'SQL — Target TB',
        data: sqlPoints.map((p) => ({
          x: p.timestampMs,
          y: p.targetSpeed > 0 ? p.targetSpeed : null,
        })),
        borderColor: '#4fffbc',
        borderDash: [6, 4],
        pointRadius: 0,
        borderWidth: 1.5,
        spanGaps: true,
        fill: false,
      },
    ];

    if (csvBuckets?.length) {
      datasets.push({
        label: `CSV — tốc độ thực (${unit})`,
        data: csvBuckets.map((b) => ({ x: b.x, y: b.actual })),
        borderColor: '#ffb86c',
        borderDash: [4, 3],
        pointRadius: 0,
        borderWidth: 2,
        fill: false,
      });
    }

    chartRef.current = new Chart(canvas, {
      type: 'line',
      data: { datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        animation: false,
        plugins: {
          legend: {
            labels: { color: '#94a3b8', boxWidth: 12, font: { size: 11 } },
          },
          tooltip: {
            backgroundColor: '#0e2f4f',
            callbacks: {
              title: (items) => {
                const x = items[0]?.parsed.x;
                return x != null ? fmtIctFull(Number(x)) : '';
              },
              label: (ctx) => {
                const y = ctx.parsed.y;
                if (y == null) return '';
                return `${ctx.dataset.label}: ${Number(y).toFixed(2)}`;
              },
            },
          },
        },
        scales: {
          x: {
            type: 'linear',
            min: windowStartMs,
            max: endMs,
            ticks: {
              color: '#94a3b8',
              maxTicksLimit: 10,
              callback: (v) => fmtIct(Number(v)),
            },
            grid: { color: 'rgba(255,255,255,0.06)' },
            title: { display: true, text: 'Thời gian (ICT)', color: '#64748b', font: { size: 11 } },
          },
          y: {
            min: 0,
            max: yMax,
            ticks: { color: '#94a3b8' },
            grid: { color: 'rgba(255,255,255,0.06)' },
            title: { display: true, text: unit, color: '#64748b', font: { size: 11 } },
          },
        },
      },
    });

    return () => {
      chartRef.current?.destroy();
      chartRef.current = null;
    };
  }, [sqlPoints, windowStartMs, endMs, unit, csvBuckets]);

  if (!sqlPoints.length) return null;

  return (
    <div className="speed-lab-chart-canvas h-[360px] relative w-full">
      <canvas ref={canvasRef} aria-label="Speed Lab trend chart" />
    </div>
  );
}

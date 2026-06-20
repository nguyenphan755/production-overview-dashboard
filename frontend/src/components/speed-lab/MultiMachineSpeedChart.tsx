/**
 * Speed trend charts — imperative Chart.js, mirrors multi-machine-speed-compare.html
 * Single module for detail / compare / running / mini (no duplicate chart logic).
 */
import { useEffect, useRef, type RefObject } from 'react';
import { Chart } from 'chart.js';
import type { OeeCalculationRawRow } from '../../types/oee-analytics-lab';
import type { SpeedChartBucket } from '../../utils/multi-machine-speed-bucket';
import {
  ensureMultiMachineSpeedChartRegistered,
  multiMachineChartTimeOpts,
  multiMachineMiniChartOpts,
} from '../../utils/multi-machine-speed-chart';
import { machineColor } from '../../utils/speed-lab-format';

type Win = { startMs: number; endMs: number };

/** Detail tab §1 — renderDetail() speedChart in HTML */
export function DetailSpeedTrendChart({
  buckets,
  winStartMs,
  winEndMs,
  unit = 'm/min',
}: {
  buckets: SpeedChartBucket[];
  winStartMs: number;
  winEndMs: number;
  unit?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartRef = useRef<Chart<'line'> | null>(null);

  useEffect(() => {
    ensureMultiMachineSpeedChartRegistered();
    const canvas = canvasRef.current;
    if (!canvas || !buckets.length) {
      chartRef.current?.destroy();
      chartRef.current = null;
      return;
    }

    chartRef.current?.destroy();
    chartRef.current = new Chart(canvas, {
      type: 'line',
      data: {
        datasets: [
          {
            label: `Tốc độ thực (${unit})`,
            data: buckets.map((b) => ({ x: b.x, y: b.actual })),
            borderColor: '#ffffff',
            backgroundColor: 'rgba(255,255,255,0.1)',
            fill: true,
            tension: 0.1,
            pointRadius: 0,
            borderWidth: 2,
          },
          {
            label: 'Target TB',
            data: buckets.map((b) => ({ x: b.x, y: b.target > 0 ? b.target : null })),
            borderColor: '#4fffbc',
            borderDash: [6, 4],
            pointRadius: 0,
            borderWidth: 1.5,
            spanGaps: true,
          },
        ],
      },
      options: multiMachineChartTimeOpts(winStartMs, winEndMs, unit),
    });

    return () => {
      chartRef.current?.destroy();
      chartRef.current = null;
    };
  }, [buckets, winStartMs, winEndMs, unit]);

  if (!buckets.length) return null;

  return (
    <div className="speed-lab-chart-canvas speed-lab-chart-speed">
      <canvas ref={canvasRef} aria-label="Trend tốc độ" />
    </div>
  );
}

/** Compare overlay — renderCompareChart() in HTML */
export function CompareOverlayChart({
  series,
  selectedIds,
  winStartMs,
  winEndMs,
  unit = 'm/min',
}: {
  series: { id: string; buckets: SpeedChartBucket[] }[];
  selectedIds: string[];
  winStartMs: number;
  winEndMs: number;
  unit?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartRef = useRef<Chart<'line'> | null>(null);
  const sortedIds = series.map((s) => s.id).sort();

  useEffect(() => {
    ensureMultiMachineSpeedChartRegistered();
    const canvas = canvasRef.current;
    if (!canvas || !selectedIds.length) {
      chartRef.current?.destroy();
      chartRef.current = null;
      return;
    }

    chartRef.current?.destroy();
    const datasets = selectedIds.map((id) => {
      const s = series.find((x) => x.id === id);
      const idx = sortedIds.indexOf(id);
      const color = machineColor(idx >= 0 ? idx : 0);
      return {
        label: id,
        data: (s?.buckets ?? []).map((b) => ({ x: b.x, y: b.actual })),
        borderColor: color,
        backgroundColor: `${color}22`,
        fill: false,
        tension: 0.1,
        pointRadius: 0,
        borderWidth: 2,
      };
    });

    chartRef.current = new Chart(canvas, {
      type: 'line',
      data: { datasets },
      options: multiMachineChartTimeOpts(winStartMs, winEndMs, unit),
    });

    return () => {
      chartRef.current?.destroy();
      chartRef.current = null;
    };
  }, [series, selectedIds, winStartMs, winEndMs, unit, sortedIds]);

  return (
    <div className="speed-lab-chart-canvas speed-lab-chart-compare">
      <canvas ref={canvasRef} aria-label="So sánh tốc độ nhiều máy" />
    </div>
  );
}

/** Detail tab §3 — renderDetail() runningChart in HTML */
export function RunningTimeTrendChart({
  rawRows,
  winStartMs,
  winEndMs,
  plannedSec,
}: {
  rawRows: OeeCalculationRawRow[];
  winStartMs: number;
  winEndMs: number;
  plannedSec: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartRef = useRef<Chart<'line'> | null>(null);

  useEffect(() => {
    ensureMultiMachineSpeedChartRegistered();
    const canvas = canvasRef.current;
    if (!canvas || !rawRows.length) {
      chartRef.current?.destroy();
      chartRef.current = null;
      return;
    }

    chartRef.current?.destroy();
    const sampled = rawRows.filter((_, i) => i % 10 === 0 || i === rawRows.length - 1);

    chartRef.current = new Chart(canvas, {
      type: 'line',
      data: {
        datasets: [
          {
            label: 'running_time_seconds',
            data: sampled.map((r) => ({
              x: new Date(r.timestamp).getTime(),
              y: r.runningTimeSeconds,
            })),
            borderColor: '#34e7f8',
            backgroundColor: 'rgba(52,231,248,0.15)',
            fill: true,
            stepped: 'before',
            pointRadius: 0,
            borderWidth: 2,
          },
        ],
      },
      options: multiMachineChartTimeOpts(winStartMs, winEndMs, 'giây', plannedSec),
    });

    return () => {
      chartRef.current?.destroy();
      chartRef.current = null;
    };
  }, [rawRows, winStartMs, winEndMs, plannedSec]);

  if (!rawRows.length) return null;

  return (
    <div className="speed-lab-chart-canvas speed-lab-chart-running">
      <canvas ref={canvasRef} aria-label="running_time_seconds" />
    </div>
  );
}

/** Mini grid cell — renderMiniGrid() in HTML */
export function useMiniSpeedChart(
  canvasRef: RefObject<HTMLCanvasElement | null>,
  buckets: SpeedChartBucket[],
  color: string,
  win: Win
) {
  const chartRef = useRef<Chart<'line'> | null>(null);

  useEffect(() => {
    ensureMultiMachineSpeedChartRegistered();
    const canvas = canvasRef.current;
    if (!canvas || !buckets.length) {
      chartRef.current?.destroy();
      chartRef.current = null;
      return;
    }

    chartRef.current?.destroy();
    chartRef.current = new Chart(canvas, {
      type: 'line',
      data: {
        datasets: [
          {
            label: 'speed',
            data: buckets.map((b) => ({ x: b.x, y: b.actual })),
            borderColor: color,
            pointRadius: 0,
            borderWidth: 1.5,
            tension: 0.1,
          },
        ],
      },
      options: multiMachineMiniChartOpts(win.startMs, win.endMs),
    });

    return () => {
      chartRef.current?.destroy();
      chartRef.current = null;
    };
  }, [canvasRef, buckets, color, win.startMs, win.endMs]);
}

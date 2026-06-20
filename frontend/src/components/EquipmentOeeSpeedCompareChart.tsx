/**
 * Speed trend chart — imperative Chart.js, mirrors scripts/sh04-speed-compare.html exactly.
 * Uses canvas + new Chart() (not Recharts / not react-chartjs-2 wrapper).
 */
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
import type { SpeedChartRow } from '../utils/equipment-speed-analysis-chart';
import { fmtIctFull, fmtIctHour } from '../utils/speed-lab-format';

let chartJsRegistered = false;

function registerChartJs(): void {
  if (chartJsRegistered) return;
  Chart.register(
    LineController,
    LineElement,
    PointElement,
    LinearScale,
    Filler,
    Tooltip,
    Legend
  );
  chartJsRegistered = true;
}

type EquipmentOeeSpeedCompareChartProps = {
  rows: SpeedChartRow[];
  windowStartMs: number;
  windowEndMs: number;
  unit: string;
  bucketSec: number;
  /** Shown under title — OEE filter subtitle */
  windowLabel?: string;
};

export function EquipmentOeeSpeedCompareChart({
  rows,
  windowStartMs,
  windowEndMs,
  unit,
  bucketSec,
  windowLabel,
}: EquipmentOeeSpeedCompareChartProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartRef = useRef<Chart<'line'> | null>(null);

  const endMs = Math.max(windowEndMs, windowStartMs + 60_000);

  useEffect(() => {
    registerChartJs();
    const canvas = canvasRef.current;
    if (!canvas || rows.length === 0) {
      chartRef.current?.destroy();
      chartRef.current = null;
      return;
    }

    chartRef.current?.destroy();

    const peak = rows.reduce((m, r) => Math.max(m, r.actualSpeed), 0);
    const yMax = peak > 0 ? Math.ceil(peak * 1.12) : 10;

    chartRef.current = new Chart(canvas, {
      type: 'line',
      data: {
        datasets: [
          {
            label: `Tốc độ thực (${unit})`,
            data: rows.map((r) => ({ x: r.timestampMs, y: r.actualSpeed })),
            borderColor: '#ffffff',
            backgroundColor: 'rgba(255, 255, 255, 0.1)',
            fill: true,
            tension: 0.1,
            pointRadius: 0,
            pointHoverRadius: 3,
            borderWidth: 2,
            yAxisID: 'y',
          },
          {
            label: 'Target TB',
            data: rows.map((r) => ({
              x: r.timestampMs,
              y: r.targetSpeed > 0 ? r.targetSpeed : null,
            })),
            borderColor: '#4fffbc',
            borderDash: [6, 4],
            pointRadius: 0,
            borderWidth: 1.5,
            spanGaps: true,
            fill: false,
            yAxisID: 'y',
          },
        ],
      },
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
            titleColor: '#e8f0fe',
            bodyColor: '#94a3b8',
            borderColor: 'rgba(255,255,255,0.15)',
            borderWidth: 1,
            callbacks: {
              title: (items) => {
                const x = items[0]?.parsed.x;
                return x != null ? fmtIctFull(Number(x)) : '';
              },
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
            min: windowStartMs,
            max: endMs,
            ticks: {
              color: '#94a3b8',
              maxTicksLimit: 10,
              callback: (value) => fmtIctHour(Number(value)),
            },
            grid: { color: 'rgba(255,255,255,0.06)' },
            title: {
              display: true,
              text: 'Thời gian (ICT)',
              color: '#64748b',
              font: { size: 11 },
            },
          },
          y: {
            min: 0,
            max: yMax,
            ticks: { color: '#94a3b8' },
            grid: { color: 'rgba(255,255,255,0.06)' },
            title: {
              display: true,
              text: unit,
              color: '#64748b',
              font: { size: 11 },
            },
          },
        },
      },
    });

    return () => {
      chartRef.current?.destroy();
      chartRef.current = null;
    };
  }, [rows, windowStartMs, endMs, unit, bucketSec]);

  if (rows.length === 0) {
    return null;
  }

  return (
    <div className="equipment-oee-speed-compare mb-4 rounded-xl bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-xl border border-[#4FFFBC]/30 shadow-2xl p-4">
      <div className="mb-3">
        <h2 className="text-lg text-white font-medium">
          Trend tốc độ (đối chiếu OEE)
        </h2>
        <p className="text-sm speed-text-muted mt-1">
          Cùng nguyên lý{' '}
          <code className="text-[#4FFFBC]/80 text-xs">sh04-speed-compare.html</code>
          — trục X cố định full ca · bucket {bucketSec}s · {rows.length} điểm
        </p>
        {windowLabel ? (
          <p className="text-xs speed-text-subtle mt-0.5">{windowLabel}</p>
        ) : null}
        <p className="text-xs speed-text-subtle mt-1">
          Khung: {fmtIctHour(windowStartMs)} → {fmtIctHour(endMs)} ICT
        </p>
      </div>
      <div className="equipment-oee-speed-compare-canvas h-[360px] relative w-full">
        <canvas ref={canvasRef} aria-label="Biểu đồ tốc độ theo khung OEE" />
      </div>
    </div>
  );
}

import { useMemo } from 'react';
import { Line } from 'react-chartjs-2';
import type { ChartData, ChartOptions } from 'chart.js';
import type { AnnotationOptions } from 'chartjs-plugin-annotation';
import type { SpeedChartRow, SpeedHistoryResponse, StableSpeedSegment } from '../utils/equipment-speed-analysis-chart';
import {
  findProductNoteAtTime,
  productNoteBandColor,
  speedPhaseLabelVi,
  speedUnitForArea,
} from '../utils/equipment-speed-analysis-chart';
import { ensureSpeedTrendChartRegistered } from '../utils/speed-trend-chart-setup';
import { fmtIctFull, fmtIctHour } from '../utils/speed-lab-format';

ensureSpeedTrendChartRegistered();

type SpeedReferenceLines = {
  vKtcn: number | null;
  vDesign: number | null;
};

type EquipmentSpeedTrendChartProps = {
  rows: SpeedChartRow[];
  data: SpeedHistoryResponse;
  yDomain: [number, number];
  windowStartMs: number;
  windowEndMs: number;
  dataEndMs?: number;
  stableSegments: StableSpeedSegment[];
  refs: SpeedReferenceLines;
};

function formatAxisTime(ms: number, longSpan: boolean): string {
  return longSpan ? fmtIctFull(ms) : fmtIctHour(ms);
}

export function EquipmentSpeedTrendChart({
  rows,
  data,
  yDomain,
  windowStartMs,
  windowEndMs,
  dataEndMs,
  stableSegments,
  refs,
}: EquipmentSpeedTrendChartProps) {
  const unit = speedUnitForArea(data.meta.area);
  const productNotes = data.productNotes ?? [];

  const spanMs = Math.max(windowEndMs - windowStartMs, 60_000);
  const longSpan = spanMs > 36 * 3600 * 1000;
  const showDataCutoff =
    dataEndMs != null &&
    dataEndMs < windowEndMs - 120_000 &&
    dataEndMs > windowStartMs;

  const chartData = useMemo((): ChartData<'line'> => {
    if (!rows.length) {
      return { datasets: [] };
    }
    return {
      datasets: [
        {
          label: `Tốc độ thực (${unit})`,
          data: rows.map((r) => ({ x: r.timestampMs, y: r.actualSpeed })),
          borderColor: '#ffffff',
          backgroundColor: 'rgba(255, 255, 255, 0.12)',
          fill: true,
          tension: 0.1,
          pointRadius: 0,
          pointHoverRadius: 4,
          borderWidth: 2,
          yAxisID: 'y',
          order: 2,
        },
        {
          label: 'V_KTCN (ICT)',
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
          order: 1,
        },
      ],
    };
  }, [rows, unit]);

  const chartOptions = useMemo((): ChartOptions<'line'> => {
    const annotations: Record<string, AnnotationOptions> = {};

    if (refs.vKtcn != null && refs.vKtcn > 0) {
      annotations.bandVktcn = {
        type: 'box',
        xMin: windowStartMs,
        xMax: windowEndMs,
        yMin: yDomain[0],
        yMax: refs.vKtcn,
        backgroundColor: 'rgba(79, 255, 188, 0.12)',
        borderWidth: 0,
        drawTime: 'beforeDatasetsDraw',
      };
    }
    if (refs.vKtcn != null && refs.vDesign != null && refs.vDesign > refs.vKtcn) {
      annotations.bandVdesign = {
        type: 'box',
        xMin: windowStartMs,
        xMax: windowEndMs,
        yMin: refs.vKtcn,
        yMax: refs.vDesign,
        backgroundColor: 'rgba(239, 68, 68, 0.08)',
        borderWidth: 0,
        drawTime: 'beforeDatasetsDraw',
      };
    }

    productNotes.forEach((note, i) => {
      const x1 = new Date(note.segmentStart).getTime();
      const x2 = new Date(note.segmentEnd).getTime();
      if (!Number.isFinite(x1) || !Number.isFinite(x2) || x2 <= x1) return;
      const color = productNoteBandColor(i);
      annotations[`product-${i}`] = {
        type: 'box',
        xMin: x1,
        xMax: x2,
        yMin: yDomain[0],
        yMax: yDomain[1],
        backgroundColor: `${color}12`,
        borderColor: `${color}40`,
        borderWidth: 1,
        drawTime: 'beforeDatasetsDraw',
      };
    });

    stableSegments.forEach((seg, i) => {
      annotations[`stable-${i}`] = {
        type: 'box',
        xMin: seg.xStart,
        xMax: seg.xEnd,
        yMin: yDomain[0],
        yMax: yDomain[1],
        backgroundColor: 'rgba(52, 231, 248, 0.1)',
        borderColor: 'rgba(52, 231, 248, 0.25)',
        borderWidth: 1,
        drawTime: 'beforeDatasetsDraw',
      };
    });

    if (refs.vKtcn != null && refs.vKtcn > 0) {
      annotations.lineVktcn = {
        type: 'line',
        yMin: refs.vKtcn,
        yMax: refs.vKtcn,
        borderColor: '#4FFFBC',
        borderWidth: 2,
        drawTime: 'afterDatasetsDraw',
        label: {
          display: true,
          content: 'V_KTCN',
          color: '#4FFFBC',
          position: 'end',
          backgroundColor: 'transparent',
        },
      };
    }
    if (refs.vDesign != null && refs.vDesign > 0 && refs.vDesign <= yDomain[1]) {
      annotations.lineVdesign = {
        type: 'line',
        yMin: refs.vDesign,
        yMax: refs.vDesign,
        borderColor: 'rgba(255,255,255,0.85)',
        borderWidth: 2,
        drawTime: 'afterDatasetsDraw',
        label: {
          display: true,
          content: 'V_design',
          color: '#ffffff',
          position: 'end',
          backgroundColor: 'transparent',
        },
      };
    }
    if (data.summary.proposedTargetSpeed != null) {
      annotations.lineProposed = {
        type: 'line',
        yMin: data.summary.proposedTargetSpeed,
        yMax: data.summary.proposedTargetSpeed,
        borderColor: '#FFB86C',
        borderDash: [5, 5],
        borderWidth: 2,
        drawTime: 'afterDatasetsDraw',
        label: {
          display: true,
          content: 'ICT đề xuất',
          color: '#FFB86C',
          position: 'start',
          backgroundColor: 'transparent',
        },
      };
    }
    if (showDataCutoff && dataEndMs != null) {
      annotations.lineDataCutoff = {
        type: 'line',
        xMin: dataEndMs,
        xMax: dataEndMs,
        borderColor: '#FFB86C',
        borderDash: [4, 4],
        borderWidth: 1.5,
        drawTime: 'afterDatasetsDraw',
        label: {
          display: true,
          content: 'Dữ liệu mới nhất',
          color: '#FFB86C',
          position: 'start',
          backgroundColor: 'transparent',
          font: { size: 10 },
        },
      };
    }

    return {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      animation: false,
      plugins: {
        legend: {
          display: true,
          position: 'bottom',
          labels: {
            color: 'rgba(255,255,255,0.5)',
            boxWidth: 12,
            font: { size: 10 },
            filter: (item) => item.text !== '',
          },
        },
        annotation: { annotations },
        tooltip: {
          backgroundColor: '#0E2F4F',
          titleColor: '#ffffff',
          bodyColor: 'rgba(255,255,255,0.9)',
          borderColor: 'rgba(255,255,255,0.2)',
          borderWidth: 1,
          padding: 10,
          callbacks: {
            title: (items) => {
              const x = items[0]?.parsed.x;
              return x != null ? fmtIctFull(Number(x)) : '';
            },
            label: (ctx) => {
              const y = ctx.parsed.y;
              if (y == null || Number.isNaN(y)) return '';
              return `${ctx.dataset.label}: ${y.toFixed(2)} ${unit}`;
            },
            afterBody: (items) => {
              const x = items[0]?.parsed.x;
              if (x == null) return [];
              const xMs = Number(x);
              const row =
                rows.find((r) => Math.abs(r.timestampMs - xMs) < 500) ??
                rows[items[0]?.dataIndex ?? -1];
              if (!row) return [];
              const lines: string[] = [];
              const productNote = findProductNoteAtTime(productNotes, row.timestampMs);
              if (productNote) {
                lines.push(`Sản phẩm: ${productNote.productName}`);
              }
              if (refs.vDesign != null) {
                lines.push(`V_design: ${refs.vDesign.toFixed(2)} ${unit}`);
              }
              if (data.summary.proposedTargetSpeed != null) {
                lines.push(
                  `ICT đề xuất: ${data.summary.proposedTargetSpeed.toFixed(2)} ${unit}`
                );
              }
              if (row.performance != null) {
                lines.push(`P: ${row.performance.toFixed(1)}%`);
              }
              lines.push(`Phase: ${speedPhaseLabelVi(row.phase)}`);
              return lines;
            },
          },
        },
      },
      scales: {
        x: {
          type: 'linear',
          min: windowStartMs,
          max: Math.max(windowEndMs, windowStartMs + 60_000),
          ticks: {
            color: 'rgba(255,255,255,0.6)',
            maxTicksLimit: 10,
            callback: (value) => formatAxisTime(Number(value), longSpan),
          },
          grid: { color: 'rgba(255,255,255,0.08)' },
          title: {
            display: true,
            text: 'Thời gian (ICT)',
            color: 'rgba(255,255,255,0.5)',
            font: { size: 10 },
          },
        },
        y: {
          min: yDomain[0],
          max: yDomain[1],
          ticks: {
            color: 'rgba(255,255,255,0.6)',
            callback: (v) => Number(v).toFixed(0),
          },
          grid: { color: 'rgba(255,255,255,0.08)' },
          title: {
            display: true,
            text: `Tốc độ (${unit})`,
            color: 'rgba(255,255,255,0.6)',
            font: { size: 10 },
          },
        },
      },
    };
  }, [
    rows,
    unit,
    yDomain,
    windowStartMs,
    windowEndMs,
    longSpan,
    refs,
    productNotes,
    stableSegments,
    data.summary.proposedTargetSpeed,
    showDataCutoff,
    dataEndMs,
  ]);

  if (!rows.length) {
    return null;
  }

  return (
    <div className="mb-3 speed-trend-chart">
      <div className="flex items-center justify-between gap-2 mb-2 flex-wrap">
        <h3 className="text-sm speed-text-soft font-medium">Speed Trend — chi tiết tốc độ</h3>
        <div className="flex flex-col items-end gap-0.5 text-[10px] speed-text-subtle text-right">
          <span>
            Khung OEE: {formatAxisTime(windowStartMs, longSpan)} →{' '}
            {formatAxisTime(windowEndMs, longSpan)}
          </span>
          <span>
            Mỗi điểm ≈ {data.meta.bucketSec}s · {rows.length} điểm
            {showDataCutoff
              ? ` · dữ liệu đến ${formatAxisTime(dataEndMs!, longSpan)}`
              : ''}
          </span>
        </div>
      </div>

      <div className="h-80 speed-trend-chart-canvas">
        <Line data={chartData} options={chartOptions} />
      </div>

      <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-[10px] text-white/50">
        <span>
          <span
            className="inline-block w-3 h-2 rounded-sm mr-1 align-middle"
            style={{ backgroundColor: 'rgba(79, 255, 188, 0.35)' }}
          />
          Vùng tốc độ chuẩn (0 → V_KTCN)
        </span>
        <span>
          <span className="inline-block w-3 h-2 rounded-sm bg-[#EF4444]/30 mr-1 align-middle" />
          Vùng tối ưu (V_KTCN → V_design)
        </span>
        <span>
          <span className="inline-block w-3 h-2 rounded-sm bg-[#34E7F8]/25 mr-1 align-middle" />
          Đoạn chạy ổn định
        </span>
        {productNotes.length > 0 ? (
          <span className="text-white/40">Dải màu = PO / sản phẩm</span>
        ) : null}
      </div>
    </div>
  );
};

import {
  ComposedChart,
  Line,
  XAxis,
  YAxis,
  ResponsiveContainer,
  Tooltip,
  ReferenceLine,
  ReferenceArea,
} from 'recharts';
import type { SpeedChartRow, SpeedHistoryResponse, StableSpeedSegment } from '../utils/equipment-speed-analysis-chart';
import {
  buildSpeedChartTimeTicks,
  findProductNoteAtTime,
  productNoteBandColor,
  resolveSpeedChartXDomain,
  speedPhaseLabelVi,
  speedUnitForArea,
} from '../utils/equipment-speed-analysis-chart';

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
  stableSegments: StableSpeedSegment[];
  refs: SpeedReferenceLines;
};

function formatAxisTime(ms: number, longSpan: boolean): string {
  const d = new Date(ms);
  if (longSpan) {
    return d.toLocaleString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  }
  return d.toLocaleTimeString('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

export function EquipmentSpeedTrendChart({
  rows,
  data,
  yDomain,
  windowStartMs,
  windowEndMs,
  stableSegments,
  refs,
}: EquipmentSpeedTrendChartProps) {
  const unit = speedUnitForArea(data.meta.area);
  const productNotes = data.productNotes ?? [];

  if (!rows.length) {
    return null;
  }

  const xDomain = resolveSpeedChartXDomain(windowStartMs, windowEndMs, rows);
  const spanMs = xDomain[1] - xDomain[0];
  const longSpan = spanMs > 36 * 3600 * 1000;
  const tickCount = longSpan > 72 * 3600 * 1000 ? 8 : longSpan > 24 * 3600 * 1000 ? 7 : 6;
  const xTicks = buildSpeedChartTimeTicks(xDomain, tickCount);

  return (
    <div className="mb-3 speed-trend-chart">
      <div className="flex items-center justify-between gap-2 mb-2 flex-wrap">
        <h3 className="text-sm speed-text-soft font-medium">Speed Trend — chi tiết tốc độ</h3>
        <div className="flex flex-col items-end gap-0.5 text-[10px] speed-text-subtle text-right">
          <span>
            Khung OEE: {formatAxisTime(windowStartMs, longSpan)} → {formatAxisTime(windowEndMs, longSpan)}
          </span>
          <span>
            Mỗi điểm ≈ {data.meta.bucketSec}s · {rows.length} điểm hiển thị
          </span>
        </div>
      </div>

      <div className="h-80">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            data={rows}
            margin={{ top: 20, right: 24, left: 4, bottom: 8 }}
          >
            {productNotes.map((note, i) => {
              const x1 = new Date(note.segmentStart).getTime();
              const x2 = new Date(note.segmentEnd).getTime();
              if (!Number.isFinite(x1) || !Number.isFinite(x2) || x2 <= x1) return null;
              return (
                <ReferenceArea
                  key={`product-${note.orderId ?? 'x'}-${x1}-${i}`}
                  x1={x1}
                  x2={x2}
                  fill={productNoteBandColor(i)}
                  fillOpacity={0.07}
                  stroke={productNoteBandColor(i)}
                  strokeOpacity={0.25}
                  ifOverflow="extendDomain"
                />
              );
            })}

            {refs.vKtcn != null && refs.vKtcn > 0 ? (
              <ReferenceArea
                y1={0}
                y2={refs.vKtcn}
                fill="#4FFFBC"
                fillOpacity={0.14}
                ifOverflow="extendDomain"
              />
            ) : null}
            {refs.vKtcn != null && refs.vDesign != null && refs.vDesign > refs.vKtcn ? (
              <ReferenceArea
                y1={refs.vKtcn}
                y2={refs.vDesign}
                fill="#EF4444"
                fillOpacity={0.12}
                ifOverflow="extendDomain"
              />
            ) : null}

            {stableSegments.map((seg, i) => (
              <ReferenceArea
                key={`stable-${i}-${seg.xStart}`}
                x1={seg.xStart}
                x2={seg.xEnd}
                fill="#34E7F8"
                fillOpacity={0.12}
                stroke="#34E7F8"
                strokeOpacity={0.3}
                ifOverflow="extendDomain"
              />
            ))}

            <XAxis
              dataKey="timestampMs"
              type="number"
              scale="linear"
              allowDataOverflow
              domain={xDomain}
              stroke="#ffffff40"
              tick={{ fill: '#ffffff60', fontSize: 10 }}
              ticks={xTicks}
              tickFormatter={(ms) => formatAxisTime(Number(ms), longSpan)}
              label={{
                value: 'Thời gian',
                position: 'insideBottom',
                offset: -2,
                fill: '#ffffff50',
                fontSize: 10,
              }}
            />
            <YAxis
              stroke="#ffffff40"
              tick={{ fill: '#ffffff60', fontSize: 10 }}
              domain={yDomain}
              allowDataOverflow
              allowDecimals
              tickFormatter={(v) => Number(v).toFixed(0)}
              label={{
                value: `Tốc độ (${unit})`,
                angle: -90,
                position: 'insideLeft',
                fill: '#ffffff60',
                fontSize: 10,
                style: { textAnchor: 'middle' },
              }}
            />
            <Tooltip
              labelFormatter={(ms) => formatAxisTime(Number(ms), longSpan)}
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const row = payload[0]?.payload as SpeedChartRow;
                if (!row) return null;
                const productNote = findProductNoteAtTime(productNotes, row.timestampMs);
                return (
                  <div className="rounded-lg border border-white/20 bg-[#0E2F4F] px-3 py-2 text-xs text-white shadow-lg max-w-xs">
                    <div className="speed-text-soft mb-1.5 font-medium">
                      {formatAxisTime(row.timestampMs, longSpan)}
                    </div>
                    {productNote ? (
                      <div className="mb-1.5 pb-1.5 border-b border-white/10">
                        <span className="text-white/50">Sản phẩm: </span>
                        <span className="speed-accent-green font-medium">{productNote.productName}</span>
                        {productNote.orderName ? (
                          <div className="text-[10px] text-white/40 font-mono mt-0.5">{productNote.orderName}</div>
                        ) : null}
                      </div>
                    ) : null}
                    <div>
                      Thực tế:{' '}
                      <span className="text-white font-semibold">
                        {row.actualSpeed.toFixed(2)} {unit}
                      </span>
                    </div>
                    <div>
                      V<sub>KTCN</sub> (ICT):{' '}
                      <span className="speed-accent-green">{row.targetSpeed.toFixed(2)} {unit}</span>
                    </div>
                    {refs.vDesign != null ? (
                      <div className="text-white/60">
                        V<sub>design</sub>: {refs.vDesign.toFixed(2)} {unit}
                      </div>
                    ) : null}
                    {data.summary.proposedTargetSpeed != null ? (
                      <div>
                        ICT đề xuất:{' '}
                        <span className="speed-accent-ict font-medium">
                          {data.summary.proposedTargetSpeed.toFixed(2)} {unit}
                        </span>
                      </div>
                    ) : null}
                    {row.performance != null ? (
                      <div className="speed-text-soft">P: {row.performance.toFixed(1)}%</div>
                    ) : null}
                    <div className="mt-1 pt-1 border-t border-white/10">
                      Phase:{' '}
                      <span style={{ color: row.phaseColor }}>{speedPhaseLabelVi(row.phase)}</span>
                    </div>
                  </div>
                );
              }}
            />

            {refs.vDesign != null && refs.vDesign > 0 ? (
              <ReferenceLine
                y={refs.vDesign}
                stroke="#ffffff"
                strokeWidth={2}
                label={{
                  value: 'V_design',
                  fill: '#ffffff',
                  fontSize: 11,
                  position: 'right',
                }}
              />
            ) : null}

            {refs.vKtcn != null && refs.vKtcn > 0 ? (
              <ReferenceLine
                y={refs.vKtcn}
                stroke="#4FFFBC"
                strokeWidth={2}
                label={{
                  value: 'V_KTCN',
                  fill: '#4FFFBC',
                  fontSize: 11,
                  position: 'right',
                }}
              />
            ) : null}

            {data.summary.proposedTargetSpeed != null ? (
              <ReferenceLine
                y={data.summary.proposedTargetSpeed}
                stroke="#FFB86C"
                strokeDasharray="5 5"
                strokeWidth={1.5}
                label={{
                  value: 'ICT đề xuất',
                  fill: '#FFB86C',
                  fontSize: 10,
                  position: 'insideTopRight',
                }}
              />
            ) : null}

            <Line
              type="linear"
              dataKey="targetSpeed"
              stroke="#4FFFBC"
              strokeWidth={1.5}
              strokeDasharray="6 4"
              strokeOpacity={0.65}
              dot={false}
              isAnimationActive={false}
              connectNulls
              name="V_KTCN (series)"
            />

            <Line
              type="linear"
              dataKey="actualSpeed"
              stroke="#FFFFFF"
              strokeWidth={2.5}
              dot={false}
              activeDot={{ r: 5, stroke: '#fff', strokeWidth: 2, fill: '#FFFFFF' }}
              isAnimationActive={false}
              connectNulls
              name="Tốc độ thực tế"
            />
          </ComposedChart>
        </ResponsiveContainer>
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
          <span className="text-white/40">
            Dải màu = PO / sản phẩm
          </span>
        ) : null}
      </div>
    </div>
  );
}

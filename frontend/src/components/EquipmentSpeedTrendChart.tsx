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
  findProductNoteAtTime,
  productNoteBandColor,
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
  stableSegments,
  refs,
}: EquipmentSpeedTrendChartProps) {
  const unit = speedUnitForArea(data.meta.area);
  const productNotes = data.productNotes ?? [];
  const longSpan =
    rows.length >= 2
      ? rows[rows.length - 1].timestampMs - rows[0].timestampMs > 36 * 3600 * 1000
      : false;

  const tickCount = Math.min(10, Math.max(5, Math.floor(rows.length / 80)));

  return (
    <div className="mb-3">
      <div className="flex items-center justify-between gap-2 mb-2 flex-wrap">
        <h3 className="text-sm text-white/90 font-medium">Speed Trend — chi tiết tốc độ</h3>
        <span className="text-[10px] text-white/45">
          Mỗi điểm ≈ {data.meta.bucketSec}s · {rows.length} điểm
        </span>
      </div>

      <div className="h-80">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            data={rows}
            margin={{ top: 20, right: 20, left: 8, bottom: 8 }}
            isAnimationActive={false}
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
                  ifOverflow="hidden"
                />
              );
            })}

            {refs.vKtcn != null && refs.vKtcn > 0 ? (
              <ReferenceArea
                y1={0}
                y2={refs.vKtcn}
                fill="#22C55E"
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
                fillOpacity={0.15}
                stroke="#34E7F8"
                strokeOpacity={0.35}
                ifOverflow="hidden"
              />
            ))}

            <XAxis
              dataKey="timestampMs"
              type="number"
              domain={['dataMin', 'dataMax']}
              scale="time"
              stroke="#ffffff40"
              tick={{ fill: '#ffffff60', fontSize: 10 }}
              tickCount={tickCount}
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
                    <div className="text-white/70 mb-1.5 font-medium">
                      {formatAxisTime(row.timestampMs, longSpan)}
                    </div>
                    {productNote ? (
                      <div className="mb-1.5 pb-1.5 border-b border-white/10">
                        <span className="text-white/50">Sản phẩm: </span>
                        <span className="text-[#22C55E] font-medium">{productNote.productName}</span>
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
                      <span className="text-[#22C55E]">{row.targetSpeed.toFixed(2)} {unit}</span>
                    </div>
                    {refs.vDesign != null ? (
                      <div className="text-white/60">
                        V<sub>design</sub>: {refs.vDesign.toFixed(2)} {unit}
                      </div>
                    ) : null}
                    {data.summary.proposedTargetSpeed != null ? (
                      <div>
                        ICT đề xuất:{' '}
                        <span className="text-[#F59E0B] font-medium">
                          {data.summary.proposedTargetSpeed.toFixed(2)} {unit}
                        </span>
                      </div>
                    ) : null}
                    {row.performance != null ? (
                      <div className="text-white/70">P: {row.performance.toFixed(1)}%</div>
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
                stroke="#22C55E"
                strokeWidth={2}
                label={{
                  value: 'V_KTCN',
                  fill: '#22C55E',
                  fontSize: 11,
                  position: 'right',
                }}
              />
            ) : null}

            {data.summary.proposedTargetSpeed != null ? (
              <ReferenceLine
                y={data.summary.proposedTargetSpeed}
                stroke="#F59E0B"
                strokeDasharray="5 5"
                strokeWidth={1.5}
                label={{
                  value: 'ICT đề xuất',
                  fill: '#F59E0B',
                  fontSize: 10,
                  position: 'insideTopRight',
                }}
              />
            ) : null}

            <Line
              type="monotone"
              dataKey="targetSpeed"
              stroke="#22C55E55"
              strokeWidth={1}
              strokeDasharray="4 4"
              dot={false}
              isAnimationActive={false}
              name="V_KTCN (series)"
            />

            <Line
              type="monotone"
              dataKey="actualSpeed"
              stroke="#F8FAFC"
              strokeWidth={2.5}
              dot={false}
              activeDot={{ r: 5, stroke: '#fff', strokeWidth: 2, fill: '#F8FAFC' }}
              isAnimationActive={false}
              name="Tốc độ thực tế"
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-[10px] text-white/50">
        <span>
          <span className="inline-block w-3 h-2 rounded-sm bg-[#22C55E]/35 mr-1 align-middle" />
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

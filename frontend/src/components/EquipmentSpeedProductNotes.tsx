import { Package } from 'lucide-react';
import type { ProductSpeedNote } from '../utils/equipment-speed-analysis-chart';
import {
  formatProductNoteTimeRange,
  formatSpeedDuration,
  productNoteBandColor,
} from '../utils/equipment-speed-analysis-chart';

type EquipmentSpeedProductNotesProps = {
  notes: ProductSpeedNote[];
  unit: string;
  longSpan: boolean;
};

export function EquipmentSpeedProductNotes({
  notes,
  unit,
  longSpan,
}: EquipmentSpeedProductNotesProps) {
  if (!notes.length) {
    return (
      <div className="mb-4 rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-xs text-white/50">
        <Package className="inline w-3.5 h-3.5 mr-1.5 -mt-0.5 text-white/40" />
        Chưa có snapshot sản phẩm trên máy trong cửa sổ OEE — không suy ra được sản phẩm / tốc độ chuyên môn.
      </div>
    );
  }

  return (
    <div className="mb-4">
      <div className="flex items-center gap-2 mb-2">
        <Package className="w-4 h-4 speed-accent-purple" strokeWidth={2.5} />
        <h3 className="text-sm speed-text-soft font-medium">
          Sản phẩm &amp; tốc độ chuyên môn (theo snapshot máy)
        </h3>
      </div>
      <div className="space-y-2">
        {notes.map((note, i) => (
          <div
            key={`${note.orderId ?? 'unassigned'}-${note.segmentStart}-${i}`}
            className="rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2.5"
            style={{ borderLeftWidth: 3, borderLeftColor: productNoteBandColor(i) }}
          >
            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1 mb-1.5">
              <span className="text-sm font-medium speed-accent-green">{note.productName}</span>
              {note.orderName ? (
                <span className="text-[10px] speed-text-subtle font-mono">{note.orderName}</span>
              ) : null}
              <span className="text-[10px] text-white/40">
                {formatProductNoteTimeRange(note.segmentStart, note.segmentEnd, longSpan)}
                · {formatSpeedDuration(note.durationSec)}
              </span>
            </div>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4 text-xs">
              <div>
                <span className="text-white/50">Tốc độ ổn định: </span>
                <span className="text-white font-medium">
                  {note.stableSpeedMedian != null ? `${note.stableSpeedMedian.toFixed(2)} ${unit}` : '—'}
                </span>
              </div>
              <div>
                <span className="text-white/50">TB chạy: </span>
                <span className="speed-text-soft">
                  {note.avgRunningSpeed != null ? `${note.avgRunningSpeed.toFixed(2)} ${unit}` : '—'}
                </span>
              </div>
              <div>
                <span className="text-white/50">ICT (median): </span>
                <span className="speed-accent-green">
                  {note.ictMedian != null ? `${note.ictMedian.toFixed(2)} ${unit}` : '—'}
                </span>
              </div>
              <div>
                <span className="text-white/50">ICT đề xuất: </span>
                <span className="speed-accent-ict font-medium">
                  {note.proposedIct != null ? `${note.proposedIct.toFixed(2)} ${unit}` : '—'}
                </span>
              </div>
            </div>
            {note.stableSpeedMedian != null && note.ictMedian != null && note.ictMedian > 0 ? (
              <p className="mt-1.5 text-[10px] speed-text-subtle leading-snug">
                Ghi chú: trên máy này,{' '}
                <span className="speed-text-soft">{note.productName}</span> thường chạy ổn định ~{' '}
                <span className="speed-accent-orange">{note.stableSpeedMedian.toFixed(2)} {unit}</span>
                {note.proposedIct !== note.ictMedian ? (
                  <>
                    {' '}
                    (ICT hiện tại {note.ictMedian.toFixed(2)} {unit})
                  </>
                ) : null}
                .
              </p>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}

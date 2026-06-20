import { useCallback, useState } from 'react';
import type { SpeedLabTimelineSegment } from '../../types/oee-analytics-lab';
import { STATE_COLORS } from '../../utils/speed-lab-format';
import { fmtDur, fmtIctFull } from '../../utils/speed-lab-format';

type SpeedLabGanttTrackProps = {
  segments: SpeedLabTimelineSegment[];
  windowStartMs: number;
  windowEndMs: number;
  labels: Partial<Record<SpeedLabTimelineSegment['state'], string>>;
};

export function SpeedLabGanttTrack({
  segments,
  windowStartMs,
  windowEndMs,
  labels,
}: SpeedLabGanttTrackProps) {
  const [tip, setTip] = useState<{ x: number; y: number; html: string } | null>(null);
  const span = windowEndMs - windowStartMs;

  const onMove = useCallback(
    (e: React.MouseEvent, label: string, startMs: number, endMs: number) => {
      const dur = (endMs - startMs) / 1000;
      setTip({
        x: e.clientX + 12,
        y: e.clientY + 12,
        html: `<strong>${label}</strong><br>${fmtIctFull(startMs)} → ${fmtIctFull(endMs)}<br>${fmtDur(dur)}`,
      });
    },
    []
  );

  if (span <= 0) return null;

  return (
    <>
      <div className="speed-lab-gantt-track">
        {segments.map((seg, i) => {
          const left = ((Math.max(seg.startMs, windowStartMs) - windowStartMs) / span) * 100;
          const right = ((Math.min(seg.endMs, windowEndMs) - windowStartMs) / span) * 100;
          const width = Math.max(right - left, 0.05);
          const label = labels[seg.state] ?? seg.state;
          const dur = (seg.endMs - seg.startMs) / 1000;
          return (
            <div
              key={`${seg.startMs}-${i}`}
              className="speed-lab-gantt-seg"
              style={{
                left: `${left}%`,
                width: `${width}%`,
                background: STATE_COLORS[seg.state] ?? '#888',
              }}
              title={`${label}\n${fmtIctFull(seg.startMs)} → ${fmtIctFull(seg.endMs)}\n${fmtDur(dur)}`}
              onMouseMove={(e) => onMove(e, label, seg.startMs, seg.endMs)}
              onMouseLeave={() => setTip(null)}
            />
          );
        })}
      </div>
      {tip ? (
        <div
          className="speed-lab-gantt-tip"
          style={{ left: tip.x, top: tip.y }}
          dangerouslySetInnerHTML={{ __html: tip.html }}
        />
      ) : null}
    </>
  );
}

export function SpeedLabGanttLegend() {
  return (
    <div className="speed-lab-legend">
      <span>
        <i className="speed-lab-dot" style={{ background: 'var(--speed-run)' }} /> Chạy (speed ≥ 1)
      </span>
      <span>
        <i className="speed-lab-dot" style={{ background: 'var(--speed-creep)' }} /> Ramp (0 &lt; speed &lt; 1)
      </span>
      <span>
        <i className="speed-lab-dot" style={{ background: 'var(--speed-stop)' }} /> Dừng (speed = 0)
      </span>
      <span>
        <i className="speed-lab-dot" style={{ background: 'var(--speed-oee-run)' }} /> OEE đang cộng running_time
      </span>
      <span>
        <i className="speed-lab-dot" style={{ background: 'var(--speed-oee-freeze)' }} /> OEE không cộng
      </span>
    </div>
  );
}

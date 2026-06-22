import { useRef } from 'react';
import type { SpeedChartBucket } from '../../utils/multi-machine-speed-bucket';
import { machineColor, machineDisplayName } from '../../utils/speed-lab-format';
import { useMiniSpeedChart } from './MultiMachineSpeedChart';

function MiniSpeedChartCell({
  buckets,
  color,
  winStartMs,
  winEndMs,
}: {
  buckets: SpeedChartBucket[];
  color: string;
  winStartMs: number;
  winEndMs: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useMiniSpeedChart(canvasRef, buckets, color, { startMs: winStartMs, endMs: winEndMs });
  return <canvas ref={canvasRef} />;
}

type SpeedLabMiniGridProps = {
  machines: {
    id: string;
    buckets: SpeedChartBucket[];
    rawRowCount: number;
    peak: number;
    zeroPct: number;
  }[];
  windowStartMs: number;
  windowEndMs: number;
  onSelect: (id: string) => void;
  nameById?: Readonly<Record<string, string>>;
};

export function SpeedLabMiniGrid({
  machines,
  windowStartMs,
  windowEndMs,
  onSelect,
  nameById = {},
}: SpeedLabMiniGridProps) {
  const sorted = [...machines].sort((a, b) =>
    machineDisplayName(a.id, nameById).localeCompare(machineDisplayName(b.id, nameById), 'vi')
  );

  return (
    <div className="speed-lab-mini-grid">
      {sorted.map((m, idx) => (
        <button
          key={m.id}
          type="button"
          className="speed-lab-mini-card"
          onClick={() => onSelect(m.id)}
        >
          <h4>
            <span className="speed-lab-dot inline-block mr-1" style={{ background: machineColor(idx) }} />
            {machineDisplayName(m.id, nameById)}
          </h4>
          <div className="speed-lab-sub text-[0.72rem] mb-1">
            {m.rawRowCount.toLocaleString('vi-VN')} dòng · peak {m.peak.toFixed(1)} · dừng{' '}
            {m.zeroPct.toFixed(0)}%
          </div>
          <div className="speed-lab-mini-chart">
            <MiniSpeedChartCell
              buckets={m.buckets}
              color={machineColor(idx)}
              winStartMs={windowStartMs}
              winEndMs={windowEndMs}
            />
          </div>
        </button>
      ))}
    </div>
  );
}

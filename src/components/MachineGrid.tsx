import { useMachines } from '../hooks/useProductionData';
import type { ProductionArea } from '../types';

const areaNames: Record<ProductionArea, string> = {
  drawing: 'KÉO',
  stranding: 'XOẮN',
  armoring: 'GIÁP',
  sheathing: 'BỌC',
};

interface MachineGridProps {
  onMachineClick?: (machineId: string) => void;
}

export function MachineGrid({ onMachineClick }: MachineGridProps) {
  const { machines, loading, error } = useMachines();
  
  // Ensure machines is always an array
  const machinesArray = Array.isArray(machines) ? machines : [];
  
  if (error) {
    console.error('MachineGrid error:', error);
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'running': return 'bg-[#4FFFBC]/20 border-[#4FFFBC]';
      case 'setup': return 'bg-[#FFB86C]/20 border-[#FFB86C]';
      case 'error': return 'bg-[#FF4C4C]/20 border-[#FF4C4C]';
      case 'stopped': return 'bg-[#34E7F8]/20 border-[#34E7F8]';
      case 'idle': return 'bg-white/10 border-white/20';
      case 'warning': return 'bg-[#FFB86C]/20 border-[#FFB86C]';
      default: return 'bg-white/10 border-white/20';
    }
  };

  const getStatusDot = (status: string) => {
    switch (status) {
      case 'running': return 'bg-[#4FFFBC] shadow-[0_0_10px_rgba(79,255,188,0.5)]';
      case 'setup': return 'bg-[#FFB86C] shadow-[0_0_10px_rgba(255,184,108,0.5)]';
      case 'error': return 'bg-[#FF4C4C] shadow-[0_0_10px_rgba(255,76,76,0.5)]';
      case 'stopped': return 'bg-[#34E7F8] shadow-[0_0_10px_rgba(52,231,248,0.5)]';
      case 'idle': return 'bg-white/40';
      case 'warning': return 'bg-[#FFB86C] shadow-[0_0_10px_rgba(255,184,108,0.5)]';
      default: return 'bg-white/40';
    }
  };

  const getSpeedColor = (status: string) => {
    switch (status) {
      case 'running': return 'text-[#4FFFBC]';
      case 'setup': return 'text-[#FFB86C]';
      case 'error': return 'text-[#FF4C4C]';
      case 'stopped': return 'text-[#34E7F8]';
      case 'idle': return 'text-white/40';
      case 'warning': return 'text-[#FFB86C]';
      default: return 'text-white/40';
    }
  };

  return (
    <div className="rounded-2xl bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-xl border border-white/20 shadow-2xl p-3">
      <h2 className="text-lg text-white mb-3 flex items-center gap-2">
        <span className="w-1 h-4 bg-gradient-to-b from-[#34E7F8] to-[#4FFFBC] rounded-full"></span>
        ALL MACHINES
      </h2>
      
      <div className="grid gap-2" style={{ gridTemplateColumns: 'repeat(15, minmax(0, 1fr))' }}>
        {loading ? (
          // Loading skeleton
          Array.from({ length: 30 }).map((_, i) => (
            <div
              key={i}
              className="rounded-lg border-2 border-white/20 backdrop-blur-sm p-2 animate-pulse"
            >
              <div className="h-3 bg-white/10 rounded mb-1.5"></div>
              <div className="h-6 bg-white/10 rounded mb-1"></div>
              <div className="h-2 bg-white/10 rounded"></div>
            </div>
          ))
        ) : (
          machinesArray.map((machine) => (
          <div
            key={machine.id}
            onClick={() => onMachineClick?.(machine.id)}
            className={`rounded-lg border-2 ${getStatusColor(machine.status)} backdrop-blur-sm p-2 transition-all duration-300 hover:scale-105 hover:shadow-lg cursor-pointer`}
          >
            <div className="flex items-start justify-between mb-1.5">
              <div className="text-white text-sm tracking-wide line-clamp-2">{machine.name}</div>
              <div className={`w-2 h-2 rounded-full ${getStatusDot(machine.status)}`}></div>
            </div>
            
            <div className="mb-1">
              <div className={`text-2xl ${getSpeedColor(machine.status)} tracking-tight`}>
                {(machine.lineSpeed || 0).toFixed(1)}
              </div>
            </div>

              <div className="text-white/40 text-xs">{machine.id} • {areaNames[machine.area] || machine.area}</div>
            </div>
          ))
        )}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 mt-3 pt-3 border-t border-white/10">
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-[#4FFFBC]"></div>
          <span className="text-white/60 text-sm">Running</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-[#FFB86C]"></div>
          <span className="text-white/60 text-sm">Setup</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-[#FF4C4C]"></div>
          <span className="text-white/60 text-sm">Error</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-[#34E7F8]"></div>
          <span className="text-white/60 text-sm">Stopped</span>
        </div>
      </div>
    </div>
  );
}
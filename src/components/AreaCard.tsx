import { Activity, Package, Gauge, AlertTriangle } from 'lucide-react';
import { SparklineChart } from './SparklineChart';

interface Machine {
  name: string;
  speed: number;
  status: 'running' | 'setup' | 'error' | 'stopped';
}

import type { ProductionAreaSummary } from '../types';

interface AreaCardProps {
  area: ProductionAreaSummary;
}

export function AreaCard({ area }: AreaCardProps) {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'running': return 'bg-[#22C55E]'; // Green for running
      case 'idle': return 'bg-[#F59E0B]'; // Yellow/Orange for idle
      case 'warning': return 'bg-[#F59E0B]'; // Orange for warning
      case 'error': return 'bg-[#EF4444]'; // Red for error
      case 'stopped': return 'bg-[#EF4444]'; // Red for stopped
      case 'setup': return 'bg-[#FFB86C]';
      default: return 'bg-white/20';
    }
  };

  // Get all machines or fallback to topMachines for backward compatibility
  const machinesToDisplay = area.allMachines || area.topMachines || [];

  // Get shadow style based on status
  const getShadowStyle = (status: string) => {
    switch (status) {
      case 'running': return 'shadow-[0_0_6px_rgba(34,197,94,0.6)]';
      case 'idle': return 'shadow-[0_0_6px_rgba(245,158,11,0.6)]';
      case 'warning': return 'shadow-[0_0_6px_rgba(245,158,11,0.6)]';
      case 'error': return 'shadow-[0_0_6px_rgba(239,68,68,0.6)]';
      case 'stopped': return 'shadow-[0_0_6px_rgba(239,68,68,0.6)]';
      default: return 'shadow-lg';
    }
  };

  return (
    <div className="rounded-2xl bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-xl border border-white/20 shadow-2xl overflow-hidden group hover:shadow-[0_0_30px_rgba(52,231,248,0.3)] transition-all duration-300">
      {/* Header với gradient accent */}
      <div className="bg-gradient-to-r from-[#34E7F8]/20 to-transparent p-2 border-b border-white/10">
        <div className="flex items-center justify-between">
          <div className="flex items-baseline gap-1.5">
            <h2 className="text-lg text-white tracking-wide">{area.name}</h2>
            <span className="text-white/40 text-sm">{area.nameEn}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Activity className="w-3.5 h-3.5 text-[#4FFFBC]" />
            <span className="text-2xl text-[#4FFFBC]">{area.running}</span>
            <span className="text-white/40 text-sm">/ {area.total}</span>
          </div>
        </div>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-3 gap-2 p-2 border-b border-white/10">
        <div>
          <div className="flex items-center gap-1 mb-0.5">
            <Package className="w-3 h-3 text-[#34E7F8]" />
            <span className="text-white/60 text-sm">OUTPUT</span>
          </div>
          <div className="text-xl text-[#34E7F8]">{(area.output / 1000).toFixed(1)}K</div>
        </div>
        <div>
          <div className="flex items-center gap-1 mb-0.5">
            <Gauge className="w-3 h-3 text-[#4FFFBC]" />
            <span className="text-white/60 text-sm">SPEED</span>
          </div>
          <div className="text-xl text-[#4FFFBC]">
            {area.id === 'drawing' ? (area.speedAvg / 60.0).toFixed(2) : area.speedAvg}
          </div>
        </div>
        <div>
          <div className="flex items-center gap-1 mb-0.5">
            <AlertTriangle className="w-3 h-3 text-[#FF4C4C]" />
            <span className="text-white/60 text-sm">ALARMS</span>
          </div>
          <div className="text-xl text-[#FF4C4C]">{area.alarms}</div>
        </div>
      </div>

      {/* All Machines - Always show 10 lines with status indicators */}
      <div className="p-2 border-b border-white/10">
        <div className="text-white/60 text-sm mb-1.5">ALL MACHINES</div>
        <div className="space-y-1">
          {Array.from({ length: 10 }).map((_, index) => {
            const machine = machinesToDisplay[index];
            if (machine) {
              // Machine exists - show with status indicator
              const statusColor = getStatusColor(machine.status);
              const displaySpeed = (machine.status === 'stopped' || machine.status === 'error') ? 0 : machine.speed;
              
              return (
                <div key={machine.id || index} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className={`w-2.5 h-2.5 rounded-full ${statusColor} ${getShadowStyle(machine.status)}`}></div>
                    <span className="text-white text-base font-medium">{machine.name}</span>
                  </div>
                  <div className={`text-lg font-semibold ${
                    machine.status === 'running' ? 'text-[#22C55E]' :
                    machine.status === 'idle' ? 'text-[#F59E0B]' :
                    machine.status === 'warning' ? 'text-[#F59E0B]' :
                    machine.status === 'error' || machine.status === 'stopped' ? 'text-[#EF4444]' :
                    'text-[#34E7F8]'
                  }`}>
                    {displaySpeed > 0 
                      ? (area.id === 'drawing' ? `${(displaySpeed / 60.0).toFixed(2)}` : `${displaySpeed}`)
                      : '0'
                    } <span className="text-sm text-white/60">{area.id === 'drawing' ? 'm/s' : 'm/min'}</span>
                  </div>
                </div>
              );
            } else {
              // Empty placeholder to reserve space for standby/backup machines
              return (
                <div key={index} className="flex items-center justify-between opacity-30">
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full bg-white/20"></div>
                    <span className="text-white/40 text-base">--</span>
                  </div>
                  <div className="text-white/20 text-xl">--</div>
                </div>
              );
            }
          })}
        </div>
      </div>

    </div>
  );
}
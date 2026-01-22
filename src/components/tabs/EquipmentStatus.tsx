import { Settings, Zap, Thermometer, Gauge, Circle, Activity, Target, ChevronDown, ChevronUp } from 'lucide-react';
import { useState } from 'react';
import { useMachines } from '../../hooks/useProductionData';
import { useMachineTrends } from '../../hooks/useMachineTrends';
import { MachineTrendChart } from '../MachineTrendChart';
import type { ProductionArea, Machine } from '../../types';

interface EquipmentStatusProps {
  onMachineClick: (machineId: string) => void;
}

const areaConfig: Record<ProductionArea, { name: string; icon: any }> = {
  drawing: { name: 'DRAWING MACHINES', icon: Activity },
  stranding: { name: 'STRANDING MACHINES', icon: Settings },
  armoring: { name: 'ARMORING MACHINES', icon: Gauge },
  sheathing: { name: 'SHEATHING / EXTRUSION MACHINES', icon: Zap },
};

export function EquipmentStatus({ onMachineClick }: EquipmentStatusProps) {
  const { machines, loading } = useMachines();
  const trends = useMachineTrends(machines);
  const [expandedMachines, setExpandedMachines] = useState<Set<string>>(new Set());

  // Group machines by area
  const productionAreas = (['drawing', 'stranding', 'armoring', 'sheathing'] as ProductionArea[]).map((areaId) => {
    const areaMachines = machines.filter((m) => m.area === areaId);
    return {
      id: areaId,
      name: areaConfig[areaId].name,
      icon: areaConfig[areaId].icon,
      machines: areaMachines,
    };
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'running': return '#22C55E'; // Green
      case 'idle': return '#64748B'; // Gray
      case 'warning': return '#F59E0B'; // Orange
      case 'error': return '#EF4444'; // Red
      default: return '#64748B';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'running': return 'RUNNING';
      case 'idle': return 'IDLE';
      case 'warning': return 'WARNING';
      case 'error': return 'ERROR';
      default: return 'UNKNOWN';
    }
  };

  const getTempColor = (temp: number) => {
    if (temp > 75) return '#EF4444';
    if (temp > 65) return '#F59E0B';
    return '#34E7F8';
  };

  const getOEEColor = (value: number) => {
    if (value >= 85) return '#22C55E';
    if (value >= 75) return '#F59E0B';
    return '#EF4444';
  };

  // Calculate summary statistics
  const totalMachines = machines.length;
  const runningCount = machines.filter((m) => m.status === 'running').length;
  const idleCount = machines.filter((m) => m.status === 'idle').length;
  const warningCount = machines.filter((m) => m.status === 'warning').length;
  const errorCount = machines.filter((m) => m.status === 'error').length;

  return (
    <>
      {/* Summary Bar */}
      <div className="mb-6 grid gap-4 responsive-grid-5">
        <div className="rounded-xl bg-gradient-to-br from-white/10 to-red/5 backdrop-blur-xl border border-white/20 p-5">
          <div className="text-white/60 tracking-wider mb-2 text-sm">TOTAL MACHINES</div>
          <div className="text-4xl text-white tracking-tight">{totalMachines}</div>
        </div>

        <div className="rounded-xl bg-gradient-to-br from-[#22C55E]/20 to-[#22C55E]/5 backdrop-blur-xl border border-[#22C55E]/30 p-5">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-3 h-3 rounded-full bg-[#22C55E] shadow-lg shadow-[#22C55E]/50" />
            <div className="text-white/80 tracking-wider text-sm">RUNNING</div>
          </div>
          <div className="text-4xl text-[#22C55E] tracking-tight">{runningCount}</div>
          <div className="text-white/40 text-sm mt-1">{((runningCount / totalMachines) * 100).toFixed(1)}%</div>
        </div>

        <div className="rounded-xl bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-xl border border-white/20 p-5">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-3 h-3 rounded-full bg-[#64748B] shadow-lg" />
            <div className="text-white/80 tracking-wider text-sm">IDLE</div>
          </div>
          <div className="text-4xl text-[#64748B] tracking-tight">{idleCount}</div>
          <div className="text-white/40 text-sm mt-1">{((idleCount / totalMachines) * 100).toFixed(1)}%</div>
        </div>

        <div className="rounded-xl bg-gradient-to-br from-[#F59E0B]/20 to-[#F59E0B]/5 backdrop-blur-xl border border-[#F59E0B]/30 p-5">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-3 h-3 rounded-full bg-[#F59E0B] shadow-lg shadow-[#F59E0B]/50" />
            <div className="text-white/80 tracking-wider text-sm">WARNING</div>
          </div>
          <div className="text-4xl text-[#F59E0B] tracking-tight">{warningCount}</div>
          <div className="text-white/40 text-sm mt-1">{((warningCount / totalMachines) * 100).toFixed(1)}%</div>
        </div>

        <div className="rounded-xl bg-gradient-to-br from-[#EF4444]/20 to-[#EF4444]/5 backdrop-blur-xl border border-[#EF4444]/30 p-5">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-3 h-3 rounded-full bg-[#EF4444] shadow-lg shadow-[#EF4444]/50" />
            <div className="text-white/80 tracking-wider text-sm">ERROR</div>
          </div>
          <div className="text-4xl text-[#EF4444] tracking-tight">{errorCount}</div>
          <div className="text-white/40 text-sm mt-1">{((errorCount / totalMachines) * 100).toFixed(1)}%</div>
        </div>
      </div>

      {/* Production Areas */}
      <div className="space-y-6">
        {productionAreas.map((area) => {
          const AreaIcon = area.icon;
          
          return (
            <div key={area.id} className="rounded-2xl bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-xl border border-white/20 shadow-2xl overflow-hidden">
              {/* Area Header */}
              <div className="bg-gradient-to-r from-[#34E7F8]/20 via-[#34E7F8]/10 to-transparent border-b border-white/10 px-4 py-2">
                <div className="flex items-center gap-2 mobile-stack">
                  <div className="p-1.5 rounded-lg bg-[#34E7F8]/20 border border-[#34E7F8]/30">
                    <AreaIcon className="w-4 h-4 text-[#34E7F8]" strokeWidth={2.5} />
                  </div>
                  <h2 className="text-lg text-white tracking-wide">{area.name}</h2>
                  <div className="ml-auto flex items-center gap-2">
                    <div className="text-white/60 text-xs">
                      {area.machines.filter(m => m.status === 'running').length} / {area.machines.length} Running
                    </div>
                  </div>
                </div>
              </div>

              {/* Machines Grid */}
              <div className="p-3">
                <div className="grid gap-2 responsive-grid-4">
                  {[...area.machines]
                    .sort((a, b) => {
                      // Prioritize RUNNING machines
                      if (a.status === 'running' && b.status !== 'running') return -1;
                      if (a.status !== 'running' && b.status === 'running') return 1;
                      return 0;
                    })
                    .map((machine) => {
                    const statusColor = getStatusColor(machine.status);
                    const lineSpeed = machine.lineSpeed || 0;
                    const targetSpeed = machine.targetSpeed || 0;
                    const speedPercentage = targetSpeed > 0 ? (lineSpeed / targetSpeed) * 100 : 0;
                    
                    const isRunning = machine.status === 'running';
                    const isIdle = machine.status === 'idle';
                    const isExpanded = isRunning || expandedMachines.has(machine.id);
                    
                    const toggleExpand = (e: React.MouseEvent) => {
                      e.stopPropagation(); // Prevent card click
                      setExpandedMachines(prev => {
                        const newSet = new Set(prev);
                        if (newSet.has(machine.id)) {
                          newSet.delete(machine.id);
                        } else {
                          newSet.add(machine.id);
                        }
                        return newSet;
                      });
                    };
                    
                    return (
                      <div 
                        key={machine.id}
                        onClick={() => onMachineClick(machine.id)}
                        className={`rounded-xl transition-all group cursor-pointer hover:scale-[1.02] active:scale-[0.98] ${
                          isRunning 
                            ? 'p-3 bg-gradient-to-br from-[#22C55E]/30 to-[#22C55E]/10 border-2 border-[#22C55E] hover:border-[#22C55E] hover:bg-gradient-to-br hover:from-[#22C55E]/40 hover:to-[#22C55E]/15' 
                            : 'p-3 bg-gradient-to-br from-white/8 to-white/3 border border-white/10 hover:border-[#34E7F8]/50 hover:bg-white/12'
                        }`}
                        style={{
                          boxShadow: isRunning 
                            ? `0 0 40px ${statusColor}60, 0 6px 30px ${statusColor}30, inset 0 0 30px ${statusColor}15` 
                            : machine.status !== 'idle' 
                              ? `0 0 20px ${statusColor}15` 
                              : 'none'
                        }}
                      >
                        {/* Machine Header */}
                        <div className="flex items-start justify-between mb-2" style={{ minHeight: '45px' }}>
                          <div className="flex-1 min-w-0">
                            <div className={`${isRunning ? 'text-xl' : 'text-lg'} ${isRunning ? 'text-white font-semibold' : 'text-white'} tracking-tight mb-0.5`}>{machine.name}</div>
                            <div className="text-white/60 text-xs leading-tight">
                              {(() => {
                                const productName = machine.productName?.trim();
                                if (!productName) {
                                  const isInvalid = !!machine.materialCode;
                                  const message = isInvalid ? 'Invalid production name' : 'Not entered yet';
                                  const className = isInvalid
                                    ? 'text-[#EF4444] font-semibold text-sm'
                                    : 'text-[#F59E0B] font-semibold text-sm';
                                  return (
                                    <>
                                      {machine.productionOrderId && <span>{machine.productionOrderId} • </span>}
                                      <span className={className}>{message}</span>
                                    </>
                                  );
                                }
                                return (
                                  <>
                                    {machine.productionOrderId && <span>{machine.productionOrderId} • </span>}
                                    <span className="text-[#22C55E] font-semibold text-sm">{machine.productName}</span>
                                  </>
                                );
                              })()}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {!isRunning && (
                              <button
                                onClick={toggleExpand}
                                className="p-1 rounded hover:bg-white/10 transition-colors"
                                title={isExpanded ? 'Collapse details' : 'Expand details'}
                              >
                                {isExpanded ? (
                                  <ChevronUp className="w-4 h-4 text-white/60" />
                                ) : (
                                  <ChevronDown className="w-4 h-4 text-white/60" />
                                )}
                              </button>
                            )}
                            <div 
                              className="px-2 py-1 rounded text-xs tracking-wider border flex-shrink-0"
                              style={{
                                backgroundColor: `${statusColor}${isRunning ? '30' : '20'}`,
                                borderColor: `${statusColor}${isRunning ? '60' : '40'}`,
                                color: statusColor
                              }}
                            >
                              {getStatusLabel(machine.status)}
                            </div>
                          </div>
                        </div>

                        {/* Speed Indicator - Primary KPI */}
                        <div className="mb-2" style={{ minHeight: isRunning ? '55px' : '45px' }}>
                          <div className={`flex items-baseline justify-between ${isRunning ? 'mb-2' : 'mb-1.5'}`}>
                            <div className="flex items-baseline gap-1.5">
                              <span className={`${isRunning ? 'text-3xl font-bold' : 'text-xl'} tracking-tight`} style={{ color: isRunning ? '#22C55E' : statusColor }}>
                                {machine.area === 'drawing' ? (machine.lineSpeed || 0).toFixed(2) : (machine.lineSpeed || 0)}
                              </span>
                              <span className="text-white/40 text-xs">/ {machine.area === 'drawing' ? (machine.targetSpeed || 0).toFixed(2) : (machine.targetSpeed || 0)}</span>
                              <span className="text-white/60 text-xs">{machine.area === 'drawing' ? 'm/s' : 'm/min'}</span>
                            </div>
                            <span className={`${isRunning ? 'text-base font-semibold' : 'text-sm'} text-white/60`}>{speedPercentage.toFixed(0)}%</span>
                          </div>
                          <div className={`${isRunning ? 'h-2.5' : 'h-1.5'} bg-white/10 rounded-full overflow-hidden`}>
                            <div 
                              className="h-full rounded-full transition-all duration-500"
                              style={{
                                width: `${Math.min(speedPercentage, 100)}%`,
                                backgroundColor: isRunning ? '#22C55E' : statusColor,
                                boxShadow: isRunning ? `0 0 10px ${statusColor}80` : 'none'
                              }}
                            />
                          </div>
                        </div>

                        {/* Machine Metrics with Trends - Show for RUNNING or expanded */}
                        {isExpanded && (
                          <div className="grid gap-2 pt-2 border-t border-white/10 responsive-grid-3" style={{ minHeight: '75px' }}>
                          {/* Current - Always render */}
                          <div>
                            <div className="flex items-center gap-1 mb-0.5">
                              <Zap className="w-3 h-3 text-[#FFB86C]" strokeWidth={2} />
                              <span className="text-white/50 text-[10px] tracking-wide">CURRENT</span>
                            </div>
                            <div className="text-base text-white tracking-tight mb-0.5">{(machine.current || 0).toFixed(1)}</div>
                            <div className="text-white/40 text-[10px] mb-0.5">A</div>
                            <MachineTrendChart 
                              data={trends[machine.id]?.current || []} 
                              color="#FFB86C" 
                              height={25}
                            />
                          </div>
                          
                          {/* Power - Always render */}
                          <div>
                            <div className="flex items-center gap-1 mb-0.5">
                              <Circle className="w-3 h-3 text-[#4FFFBC]" strokeWidth={2} fill="currentColor" />
                              <span className="text-white/50 text-[10px] tracking-wide">POWER</span>
                            </div>
                            <div className="text-base text-white tracking-tight mb-0.5">{(machine.power || 0).toFixed(1)}</div>
                            <div className="text-white/40 text-[10px] mb-0.5">kW</div>
                            <MachineTrendChart 
                              data={trends[machine.id]?.power || []} 
                              color="#4FFFBC" 
                              height={25}
                              showArea={true}
                            />
                          </div>
                          
                          {/* Temperature - Always render */}
                          <div>
                            <div className="flex items-center gap-1 mb-0.5">
                              <Thermometer className="w-3 h-3" style={{ color: getTempColor(machine.temperature || 0) }} strokeWidth={2} />
                              <span className="text-white/50 text-[10px] tracking-wide">TEMP</span>
                            </div>
                            <div className="text-base text-white tracking-tight mb-0.5">{Math.round(machine.temperature || 0)}</div>
                            <div className="text-white/40 text-[10px] mb-0.5">°C</div>
                            <MachineTrendChart 
                              data={trends[machine.id]?.temperature || []} 
                              color={getTempColor(machine.temperature || 0)} 
                              height={25}
                              showArea={true}
                            />
                          </div>
                        </div>
                        )}

                        {/* Speed Trend - Show for RUNNING or expanded */}
                        {isExpanded && (
                          <div className="mt-2 pt-2 border-t border-white/10" style={{ minHeight: '50px' }}>
                          <div className="flex items-center justify-between mb-1">
                            <div className="flex items-center gap-1">
                              <Gauge className="w-3 h-3 text-[#34E7F8]" strokeWidth={2} />
                              <span className="text-white/50 text-[10px] tracking-wide">SPEED</span>
                            </div>
                            <span className="text-white/60 text-[10px]">
                              {machine.area === 'drawing' ? (machine.lineSpeed || 0).toFixed(2) : (machine.lineSpeed || 0)} {machine.area === 'drawing' ? 'm/s' : 'm/min'}
                            </span>
                          </div>
                          <MachineTrendChart 
                            data={trends[machine.id]?.speed || []} 
                            color="#34E7F8" 
                            height={25}
                            showArea={true}
                          />
                        </div>
                        )}

                        {/* OEE Metrics - Show for RUNNING or expanded */}
                        {isExpanded && (
                          <div className="mt-2 pt-2 border-t border-white/10" style={{ minHeight: '50px' }}>
                            <div className="flex items-center gap-1 mb-1">
                              <Target className="w-2.5 h-2.5 text-[#34E7F8]" strokeWidth={2} />
                              <div className="text-white/50 text-[9px] tracking-wide">OEE</div>
                            </div>
                            <div className="grid gap-1 responsive-grid-4">
                              {/* OEE */}
                              <div className="p-1 rounded-lg bg-gradient-to-br from-white/8 to-white/3 border border-white/10">
                                <div className="text-white/60 text-[9px] mb-0.5 tracking-wider">OEE</div>
                                <div 
                                  className={`${isRunning ? 'text-base' : 'text-sm'} tracking-tight mb-0.5`}
                                  style={{ color: getOEEColor(machine.oee || 0) }}
                                >
                                  {Math.round(machine.oee || 0)}%
                                </div>
                                <div className="h-0.5 bg-white/10 rounded-full overflow-hidden">
                                  <div 
                                    className="h-full rounded-full"
                                    style={{
                                      width: `${Math.min(machine.oee || 0, 100)}%`,
                                      backgroundColor: getOEEColor(machine.oee || 0)
                                    }}
                                  />
                                </div>
                              </div>

                              {/* Availability */}
                              <div className="p-1 rounded-lg bg-gradient-to-br from-white/8 to-white/3 border border-white/10">
                                <div className="text-white/60 text-[9px] mb-0.5 tracking-wider">A</div>
                                <div className={`${isRunning ? 'text-base' : 'text-sm'} text-[#4FFFBC] tracking-tight mb-0.5`}>
                                  {Math.round(machine.availability || 0)}%
                                </div>
                                <div className="h-0.5 bg-white/10 rounded-full overflow-hidden">
                                  <div 
                                    className="h-full rounded-full bg-[#4FFFBC]"
                                    style={{ width: `${Math.min(machine.availability || 0, 100)}%` }}
                                  />
                                </div>
                              </div>

                              {/* Performance */}
                              <div className="p-1 rounded-lg bg-gradient-to-br from-white/8 to-white/3 border border-white/10">
                                <div className="text-white/60 text-[9px] mb-0.5 tracking-wider">P</div>
                                <div className={`${isRunning ? 'text-base' : 'text-sm'} text-[#FFB86C] tracking-tight mb-0.5`}>
                                  {Math.round(machine.performance || 0)}%
                                </div>
                                <div className="h-0.5 bg-white/10 rounded-full overflow-hidden">
                                  <div 
                                    className="h-full rounded-full bg-[#FFB86C]"
                                    style={{ width: `${Math.min(machine.performance || 0, 100)}%` }}
                                  />
                                </div>
                              </div>

                              {/* Quality */}
                              <div className="p-1 rounded-lg bg-gradient-to-br from-white/8 to-white/3 border border-white/10">
                                <div className="text-white/60 text-[9px] mb-0.5 tracking-wider">Q</div>
                                <div className={`${isRunning ? 'text-base' : 'text-sm'} text-[#34E7F8] tracking-tight mb-0.5`}>
                                  {Math.round(machine.quality || 0)}%
                                </div>
                                <div className="h-0.5 bg-white/10 rounded-full overflow-hidden">
                                  <div 
                                    className="h-full rounded-full bg-[#34E7F8]"
                                    style={{ width: `${Math.min(machine.quality || 0, 100)}%` }}
                                  />
                                </div>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
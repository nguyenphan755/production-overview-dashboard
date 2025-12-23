import { Settings, Zap, Thermometer, Gauge, Circle, Activity } from 'lucide-react';
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

  // Calculate summary statistics
  const totalMachines = machines.length;
  const runningCount = machines.filter((m) => m.status === 'running').length;
  const idleCount = machines.filter((m) => m.status === 'idle').length;
  const warningCount = machines.filter((m) => m.status === 'warning').length;
  const errorCount = machines.filter((m) => m.status === 'error').length;

  return (
    <>
      {/* Summary Bar */}
      <div className="mb-6 grid grid-cols-5 gap-4">
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
              <div className="bg-gradient-to-r from-[#34E7F8]/20 via-[#34E7F8]/10 to-transparent border-b border-white/10 px-6 py-4">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-[#34E7F8]/20 border border-[#34E7F8]/30">
                    <AreaIcon className="w-6 h-6 text-[#34E7F8]" strokeWidth={2.5} />
                  </div>
                  <h2 className="text-2xl text-white tracking-wide">{area.name}</h2>
                  <div className="ml-auto flex items-center gap-4">
                    <div className="text-white/60 text-sm">
                      {area.machines.filter(m => m.status === 'running').length} / {area.machines.length} Running
                    </div>
                  </div>
                </div>
              </div>

              {/* Machines Grid */}
              <div className="p-6">
                <div className="grid grid-cols-4 gap-4">
                  {area.machines.map((machine) => {
                    const statusColor = getStatusColor(machine.status);
                    const speedPercentage = machine.targetSpeed ? (machine.lineSpeed / machine.targetSpeed) * 100 : 0;
                    
                    return (
                      <div 
                        key={machine.id}
                        onClick={() => onMachineClick(machine.id)}
                        className="rounded-xl bg-gradient-to-br from-white/8 to-white/3 border border-white/10 p-5 hover:border-[#34E7F8]/50 hover:bg-white/12 transition-all group cursor-pointer hover:scale-[1.02] active:scale-[0.98]"
                        style={{
                          boxShadow: machine.status !== 'idle' ? `0 0 20px ${statusColor}15` : 'none'
                        }}
                      >
                        {/* Machine Header */}
                        <div className="flex items-start justify-between mb-4">
                          <div>
                            <div className="text-2xl text-white tracking-tight mb-1">{machine.id}</div>
                            <div className="text-white/60 text-sm">{machine.name}</div>
                          </div>
                          <div 
                            className="px-3 py-1.5 rounded-lg text-sm tracking-wider border"
                            style={{
                              backgroundColor: `${statusColor}20`,
                              borderColor: `${statusColor}40`,
                              color: statusColor
                            }}
                          >
                            {getStatusLabel(machine.status)}
                          </div>
                        </div>

                        {/* Speed Indicator */}
                        {machine.targetSpeed && (
                          <div className="mb-4">
                            <div className="flex items-baseline justify-between mb-2">
                              <div className="flex items-baseline gap-2">
                                <span className="text-3xl tracking-tight" style={{ color: statusColor }}>
                                  {machine.lineSpeed}
                                </span>
                                <span className="text-white/40">/ {machine.targetSpeed}</span>
                                <span className="text-white/60 text-sm">m/min</span>
                              </div>
                              <span className="text-lg text-white/60">{speedPercentage.toFixed(0)}%</span>
                            </div>
                            <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                              <div 
                                className="h-full rounded-full transition-all duration-500"
                                style={{
                                  width: `${Math.min(speedPercentage, 100)}%`,
                                  backgroundColor: statusColor
                                }}
                              />
                            </div>
                          </div>
                        )}

                        {/* Machine Metrics with Trends */}
                        <div className="grid grid-cols-3 gap-3 pt-4 border-t border-white/10">
                          {machine.current !== undefined && machine.current > 0 && (
                            <div>
                              <div className="flex items-center gap-1.5 mb-1">
                                <Zap className="w-4 h-4 text-[#FFB86C]" strokeWidth={2} />
                                <span className="text-white/50 text-xs tracking-wide">CURRENT</span>
                              </div>
                              <div className="text-xl text-white tracking-tight mb-1">{machine.current.toFixed(1)}</div>
                              <div className="text-white/40 text-xs mb-1">A</div>
                              <MachineTrendChart 
                                data={trends[machine.id]?.current || []} 
                                color="#FFB86C" 
                                height={30}
                              />
                            </div>
                          )}
                          
                          {machine.power !== undefined && machine.power > 0 && (
                            <div>
                              <div className="flex items-center gap-1.5 mb-1">
                                <Circle className="w-4 h-4 text-[#4FFFBC]" strokeWidth={2} fill="currentColor" />
                                <span className="text-white/50 text-xs tracking-wide">POWER</span>
                              </div>
                              <div className="text-xl text-white tracking-tight mb-1">{machine.power.toFixed(1)}</div>
                              <div className="text-white/40 text-xs mb-1">kW</div>
                              <MachineTrendChart 
                                data={trends[machine.id]?.power || []} 
                                color="#4FFFBC" 
                                height={30}
                                showArea={true}
                              />
                            </div>
                          )}
                          
                          {machine.temperature !== undefined && machine.temperature > 0 && (
                            <div>
                              <div className="flex items-center gap-1.5 mb-1">
                                <Thermometer className="w-4 h-4" style={{ color: getTempColor(machine.temperature) }} strokeWidth={2} />
                                <span className="text-white/50 text-xs tracking-wide">TEMP</span>
                              </div>
                              <div className="text-xl text-white tracking-tight mb-1">{Math.round(machine.temperature)}</div>
                              <div className="text-white/40 text-xs mb-1">°C</div>
                              <MachineTrendChart 
                                data={trends[machine.id]?.temperature || []} 
                                color={getTempColor(machine.temperature)} 
                                height={30}
                                showArea={true}
                              />
                            </div>
                          )}
                        </div>

                        {/* Speed Trend */}
                        {machine.lineSpeed !== undefined && machine.lineSpeed > 0 && (
                          <div className="mt-4 pt-4 border-t border-white/10">
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-1.5">
                                <Gauge className="w-4 h-4 text-[#34E7F8]" strokeWidth={2} />
                                <span className="text-white/50 text-xs tracking-wide">SPEED TREND</span>
                              </div>
                              <span className="text-white/60 text-xs">{machine.lineSpeed} m/min</span>
                            </div>
                            <MachineTrendChart 
                              data={trends[machine.id]?.speed || []} 
                              color="#34E7F8" 
                              height={35}
                              showArea={true}
                            />
                          </div>
                        )}

                        {/* Multi-Zone Temperature (if available) */}
                        {machine.multiZoneTemperatures && (
                          <div className="mt-4 pt-4 border-t border-white/10">
                            <div className="text-white/50 text-xs tracking-wide mb-2">MULTI-ZONE TEMP</div>
                            <div className="grid grid-cols-4 gap-2">
                              {machine.multiZoneTemperatures.zone1 !== undefined && (
                                <div>
                                  <div className="text-white/60 text-xs mb-1">Z1</div>
                                  <MachineTrendChart 
                                    data={trends[machine.id]?.multiZoneTemp?.zone1 || []} 
                                    color="#FF6B6B" 
                                    height={25}
                                  />
                                </div>
                              )}
                              {machine.multiZoneTemperatures.zone2 !== undefined && (
                                <div>
                                  <div className="text-white/60 text-xs mb-1">Z2</div>
                                  <MachineTrendChart 
                                    data={trends[machine.id]?.multiZoneTemp?.zone2 || []} 
                                    color="#FFB86C" 
                                    height={25}
                                  />
                                </div>
                              )}
                              {machine.multiZoneTemperatures.zone3 !== undefined && (
                                <div>
                                  <div className="text-white/60 text-xs mb-1">Z3</div>
                                  <MachineTrendChart 
                                    data={trends[machine.id]?.multiZoneTemp?.zone3 || []} 
                                    color="#F59E0B" 
                                    height={25}
                                  />
                                </div>
                              )}
                              {machine.multiZoneTemperatures.zone4 !== undefined && (
                                <div>
                                  <div className="text-white/60 text-xs mb-1">Z4</div>
                                  <MachineTrendChart 
                                    data={trends[machine.id]?.multiZoneTemp?.zone4 || []} 
                                    color="#34E7F8" 
                                    height={25}
                                  />
                                </div>
                              )}
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
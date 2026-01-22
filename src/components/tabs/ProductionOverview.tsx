import { GlobalKPIBar } from '../GlobalKPIBar';
import { AreaCard } from '../AreaCard';
import { MachineGrid } from '../MachineGrid';
import { useProductionAreas } from '../../hooks/useProductionData';

interface ProductionOverviewProps {
  onMachineClick?: (machineId: string) => void;
}

export function ProductionOverview({ onMachineClick }: ProductionOverviewProps) {
  const { areas, loading, error } = useProductionAreas();
  
  // Show error message if API fails
  if (error) {
    console.error('ProductionOverview error:', error);
  }

  return (
    <>
      {/* Global KPI Bar */}
      <GlobalKPIBar />

      {/* Area Cards - Always horizontal - 4 columns in one row */}
      <div className="grid gap-3 mb-2 responsive-grid-4">
        {loading ? (
          // Loading skeleton
          Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="rounded-2xl bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-xl border border-white/20 shadow-2xl p-6 animate-pulse"
            >
              <div className="h-8 bg-white/10 rounded mb-4"></div>
              <div className="h-6 bg-white/10 rounded mb-2"></div>
              <div className="h-4 bg-white/10 rounded"></div>
            </div>
          ))
        ) : (
          areas.map((area) => (
          <AreaCard key={area.id} area={area} />
          ))
        )}
      </div>

      {/* Machine Grid */}
      <MachineGrid onMachineClick={onMachineClick} />
    </>
  );
}

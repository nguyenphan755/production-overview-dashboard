import { useMemo } from 'react';
import { GlobalKPIBar } from '../GlobalKPIBar';
import { AreaCard } from '../AreaCard';
import { MachineGrid } from '../MachineGrid';
import { useProductionAreas } from '../../hooks/useProductionData';
import type { Machine, ProductionAreaSummary } from '../../types';

interface ProductionOverviewProps {
  onMachineClick?: (machineId: string) => void;
  /** Live machine rows (same source as Equipment); used to show product on area cards */
  machines?: Machine[];
}

function mergeProductNamesIntoAreas(
  areas: ProductionAreaSummary[],
  machines: Machine[]
): ProductionAreaSummary[] {
  if (!machines.length) return areas;
  const byId = new Map(machines.map((m) => [m.id, m]));
  const attach = <T extends { id: string }>(rows: T[]): T[] =>
    rows.map((row) => {
      const m = byId.get(row.id);
      const product =
        m?.productName?.trim() || m?.productionOrderProductName?.trim() || undefined;
      if (!product) return row;
      return { ...row, productName: product };
    });

  return areas.map((area) => ({
    ...area,
    ...(area.allMachines ? { allMachines: attach(area.allMachines) } : {}),
    ...(area.topMachines ? { topMachines: attach(area.topMachines) } : {}),
  }));
}

export function ProductionOverview({ onMachineClick, machines = [] }: ProductionOverviewProps) {
  const { areas, loading, error } = useProductionAreas();
  const areasForCards = useMemo(
    () => mergeProductNamesIntoAreas(areas, machines),
    [areas, machines]
  );
  
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
          areasForCards.map((area) => (
          <AreaCard key={area.id} area={area} />
          ))
        )}
      </div>

      {/* Machine Grid */}
      <MachineGrid onMachineClick={onMachineClick} />
    </>
  );
}

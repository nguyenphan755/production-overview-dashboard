import { Activity, Package, ClipboardList, AlertTriangle, Zap } from 'lucide-react';
import { useGlobalKPIs } from '../hooks/useProductionData';

export function GlobalKPIBar() {
  const { kpis, loading, error } = useGlobalKPIs();
  
  // Show error message if API fails
  if (error) {
    console.error('GlobalKPIBar error:', error);
  }

  const formatValue = (value: number, type: 'running' | 'output' | 'orders' | 'alarms' | 'energy') => {
    if (loading || !kpis) return '--';
    
    try {
      switch (type) {
        case 'running':
          return `${kpis.running || 0}/${kpis.total || 0}`;
        case 'output':
          const output = kpis.output || 0;
          if (output >= 1000000) {
            return `${(output / 1000000).toFixed(2)}M`;
          }
          return `${(output / 1000).toFixed(2)}K`;
        case 'orders':
          return (kpis.orders || 0).toString();
        case 'alarms':
          return (kpis.alarms || 0).toString();
        case 'energy':
          return `${((kpis.energy || 0) * 1000).toFixed(2)}KW`;
        default:
          return '--';
      }
    } catch (err) {
      console.error('Error formatting value:', err, { kpis, type });
      return '--';
    }
  };

  const kpiItems = [
    { icon: Activity, label: 'RUNNING', value: formatValue(0, 'running'), color: 'text-[#4FFFBC]' },
    { icon: Package, label: 'OUTPUT', value: formatValue(0, 'output'), unit: 'm', color: 'text-[#34E7F8]' },
    { icon: ClipboardList, label: 'ORDERS', value: formatValue(0, 'orders'), color: 'text-[#FFB86C]' },
    { icon: AlertTriangle, label: 'ALARMS', value: formatValue(0, 'alarms'), color: 'text-[#FF4C4C]' },
    { icon: Zap, label: 'ENERGY', value: formatValue(0, 'energy'), color: 'text-[#34E7F8]' }
  ];

  return (
    <div className="mb-2 rounded-2xl bg-gradient-to-r from-[#0E2F4F] via-[#1a4d6f] to-[#34E7F8]/20 backdrop-blur-xl shadow-2xl border border-[#34E7F8]/20 p-4 kpi-bar">
      <div className="grid gap-4 responsive-grid-5">
        {kpiItems.map((kpi, index) => {
          const Icon = kpi.icon;
          return (
            <div key={index} className="flex items-center gap-3">
              <div className={`p-2.5 rounded-xl bg-white/5 backdrop-blur-sm ${kpi.color}`}>
                <Icon className="w-5 h-5" strokeWidth={2.5} />
              </div>
              <div>
                <div className="text-white/60 text-sm tracking-wider mb-0.5">{kpi.label}</div>
                <div className="flex items-baseline gap-1">
                  <span className={`text-3xl tracking-tight ${kpi.color}`}>
                    {kpi.value}
                  </span>
                  {kpi.unit && (
                    <span className="text-white/40 text-sm">{kpi.unit}</span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
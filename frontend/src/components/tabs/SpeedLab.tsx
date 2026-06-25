import { useEffect, useMemo, useState } from 'react';
import { ExternalLink, FlaskConical } from 'lucide-react';
import { EquipmentOeeToolbar } from '../EquipmentOeeToolbar';
import { GrafanaEmbeddedView } from '../grafana/GrafanaEmbeddedView';
import type { Machine, ProductionArea } from '../../types';
import type { EquipmentOeeAnalyticsScope, EquipmentOeeMode } from '../../utils/equipmentOeeDisplay';
import {
  buildGrafanaDashboardUrl,
  GRAFANA_BASE_URL,
  GRAFANA_DASHBOARD,
} from '../../utils/grafana-embed';
import { machineDisplayName } from '../../utils/speed-lab-format';
import '../../styles/speed-lab.css';

const AREA_LABELS: Record<ProductionArea, string> = {
  drawing: 'Drawing',
  stranding: 'Stranding',
  armoring: 'Armoring',
  sheathing: 'Sheathing',
};

const AREA_ORDER: ProductionArea[] = ['drawing', 'stranding', 'armoring', 'sheathing'];

type SpeedLabProps = {
  machines: Machine[];
  machinesLoading?: boolean;
  equipmentOeeMode: EquipmentOeeMode;
  onEquipmentOeeModeChange: (mode: EquipmentOeeMode) => void;
  equipmentOeeScope: EquipmentOeeAnalyticsScope;
  equipmentOeeRollupLoading: boolean;
  equipmentOeeRollupError: string | null;
  referenceDate: string;
  onReferenceDateChange: (isoDate: string) => void;
  pastIsoShiftNumber: 1 | 2 | 3;
  onPastIsoShiftNumberChange: (n: 1 | 2 | 3) => void;
};

/**
 * Speed Lab — Grafana dashboard (mes-speed-lab).
 * Legacy React lab: frontend/src/components/tabs/SpeedLab.legacy.tsx
 */
export function SpeedLab({
  machines,
  machinesLoading = false,
  equipmentOeeMode,
  onEquipmentOeeModeChange,
  equipmentOeeScope,
  equipmentOeeRollupLoading,
  equipmentOeeRollupError,
  referenceDate,
  onReferenceDateChange,
  pastIsoShiftNumber,
  onPastIsoShiftNumberChange,
}: SpeedLabProps) {
  const [selectedMachineId, setSelectedMachineId] = useState<string | null>(null);

  const machineNameById = useMemo(() => {
    const map: Record<string, string> = {};
    for (const m of machines) {
      if (m.id && m.name) map[m.id] = m.name;
    }
    return map;
  }, [machines]);

  const machinesByArea = useMemo(() => {
    const grouped = new Map<ProductionArea, Machine[]>();
    for (const area of AREA_ORDER) grouped.set(area, []);
    for (const m of machines) {
      const list = grouped.get(m.area);
      if (list) list.push(m);
    }
    return grouped;
  }, [machines]);

  useEffect(() => {
    if (!selectedMachineId && machines.length > 0) {
      const preferred = machines.find((m) => m.id === 'SH-05');
      setSelectedMachineId(preferred?.id ?? machines[0].id);
    }
  }, [machines, selectedMachineId]);

  const grafanaSrc = useMemo(() => {
    if (!selectedMachineId) return '';
    return buildGrafanaDashboardUrl({
      dashboardUid: GRAFANA_DASHBOARD.speedLab,
      machineId: selectedMachineId,
      equipmentOeeMode,
      referenceDate,
      pastIsoShiftNumber,
      theme: 'dark',
      kiosk: true,
    });
  }, [
    selectedMachineId,
    equipmentOeeMode,
    referenceDate,
    pastIsoShiftNumber,
  ]);

  const grafanaStandalone = useMemo(() => {
    if (!grafanaSrc) return '';
    const u = new URL(grafanaSrc);
    u.searchParams.delete('kiosk');
    return u.toString();
  }, [grafanaSrc]);

  return (
    <div className="speed-lab flex flex-col gap-4 min-h-0 h-full pb-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-cyan-300">
          <FlaskConical className="w-5 h-5" />
          <h2 className="text-lg font-semibold text-white">Speed Lab</h2>
          <span className="text-white/40 text-sm">Grafana</span>
        </div>
        {grafanaStandalone ? (
          <a
            href={grafanaStandalone}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-xs text-cyan-400/80 hover:text-cyan-300 border border-cyan-500/30 rounded-lg px-2.5 py-1"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            Mở Grafana
          </a>
        ) : null}
      </div>

      <div className="flex flex-wrap items-end gap-4">
        <label className="flex flex-col gap-1 text-sm text-white/70">
          Máy
          <select
            className="bg-white/5 border border-white/15 rounded-lg px-3 py-2 text-white min-w-[200px]"
            value={selectedMachineId ?? ''}
            disabled={machinesLoading}
            onChange={(e) => setSelectedMachineId(e.target.value)}
          >
            {machinesLoading ? (
              <option value="">Đang tải…</option>
            ) : (
              AREA_ORDER.flatMap((area) => {
                const list = machinesByArea.get(area) ?? [];
                if (!list.length) return [];
                return [
                  <optgroup key={area} label={AREA_LABELS[area]}>
                    {list.map((m) => (
                      <option key={m.id} value={m.id}>
                        {machineDisplayName(m.id, machineNameById)}
                      </option>
                    ))}
                  </optgroup>,
                ];
              })
            )}
          </select>
        </label>
      </div>

      <EquipmentOeeToolbar
        mode={equipmentOeeMode}
        onModeChange={onEquipmentOeeModeChange}
        scope={equipmentOeeScope}
        rollupLoading={equipmentOeeRollupLoading}
        rollupError={equipmentOeeRollupError}
        referenceDate={referenceDate}
        onReferenceDateChange={onReferenceDateChange}
        pastIsoShiftNumber={pastIsoShiftNumber}
        onPastIsoShiftNumberChange={onPastIsoShiftNumberChange}
      />

      <p className="text-white/40 text-xs px-1">
        OEE Waterfall v2 vẫn cần logic MES — xem báo cáo settled trong tab Equipment nếu cần. Phân
        tích tốc độ/OEE lịch sử: {GRAFANA_BASE_URL}
      </p>

      {selectedMachineId && grafanaSrc ? (
        <GrafanaEmbeddedView
          src={grafanaSrc}
          title={`Speed Lab — ${selectedMachineId}`}
          className="flex-1"
        />
      ) : (
        <div className="flex-1 flex items-center justify-center text-white/40 text-sm">
          Chọn máy để xem Speed Lab
        </div>
      )}
    </div>
  );
}

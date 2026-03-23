import { useState } from 'react';
import { useScheduleSummary, useMachineBobbinTracking } from '../../hooks/useProductionData';
import { effectiveProducedLengthOkM } from '../../utils/effectiveProducedLength';

export function ProductionScheduleTablet() {
  const { rows, loading, error } = useScheduleSummary();
  const [selectedMachineId, setSelectedMachineId] = useState<string | null>(null);

  const machineId =
    selectedMachineId ?? (rows.length > 0 ? rows[0].machineId : null);

  const { snapshot: bobbinSnapshot } = useMachineBobbinTracking(machineId);

  if (loading) {
    return <div className="text-white/60">Loading schedule...</div>;
  }

  if (error) {
    return <div className="text-[#EF4444]">{error}</div>;
  }

  if (!rows.length || !machineId) {
    return <div className="text-white/60">No schedule data.</div>;
  }

  const selectedRow =
    rows.find((r) => r.machineId === machineId) ?? rows[0];

  const order = selectedRow.currentOrder;
  const history = bobbinSnapshot?.history ?? [];
  const activeBobbin = bobbinSnapshot?.activeBobbin ?? null;
  const lastCompletedBobbin = history[0] ?? null;

  // Use total produced length for stable display.
  const produced = order ? effectiveProducedLengthOkM(order) : 0;
  const target = order?.targetLength ?? 0;
  const progress = target > 0 ? Math.min(100, (produced / target) * 100) : 0;

  const totalBobbins =
    history.length + (activeBobbin ? 1 : 0);

  return (
    <div className="grid gap-4 lg:grid-cols-[0.26fr_0.48fr_0.26fr]">
      {/* Left: chọn máy */}
      <div className="rounded-2xl bg-white/5 border border-white/10 p-3 max-h-[70vh] overflow-auto">
        <div className="text-white/70 text-xs uppercase tracking-wide mb-2">
          Machines
        </div>
        <div className="space-y-2 text-[11px]">
          {rows.map((r) => (
            <button
              key={r.machineId}
              onClick={() => setSelectedMachineId(r.machineId)}
              className={`w-full text-left rounded-xl border p-2 transition-colors ${
                r.machineId === selectedRow.machineId
                  ? 'bg-[#0B3B5C] border-emerald-400/70'
                  : 'bg-white/5 border-white/10 hover:bg-white/10'
              }`}
            >
              <div className="flex items-center justify-between mb-0.5">
                <div className="text-white text-xs">
                  {r.machineId} – {r.machineName}
                </div>
                <span className="px-1.5 py-0.5 rounded-full text-[10px] border border-white/20 text-white/70">
                  {r.status.toUpperCase()}
                </span>
              </div>
              <div className="text-white/50 text-[10px]">
                {r.currentOrder?.productName || 'No current order'}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Center: lệnh SX và bobbin hiện tại */}
      <div className="space-y-4">
        <div className="rounded-2xl bg-gradient-to-br from-[#0B3B5C] to-[#0A2A46] border border-white/15 shadow-2xl p-4">
          <div className="flex items-center justify-between mb-3">
            <div>
              <div className="text-xs text-[#34E7F8]/80 uppercase tracking-wide">
                Running Production Order
              </div>
              <div className="text-white/60 text-[11px]">
                Machine {selectedRow.machineId} · {selectedRow.machineName}
              </div>
            </div>
            <div className="px-2 py-0.5 rounded-full text-[10px] border border-emerald-400/60 text-emerald-300">
              {order?.status ? order.status.toUpperCase() : 'IDLE'}
            </div>
          </div>

          {order ? (
            <>
              <div className="mb-3">
                <div className="text-white text-lg">
                  {order.productName || 'No product'}
                </div>
                <div className="text-white/60 text-sm">
                  {order.customerName || '—'}
                </div>
              </div>

              <div className="mb-3">
                <div className="flex justify-between text-xs text-white/60 mb-1">
                  <span>PRODUCTION PROGRESS</span>
                  <span>{progress.toFixed(0)}%</span>
                </div>
                <div className="h-2 rounded-full bg-white/10 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-[#34E7F8] via-[#4FFFBC] to-emerald-300"
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <div className="flex justify-between text-[11px] text-white/60 mt-1">
                  <span>
                    {produced.toLocaleString()} /{' '}
                    {(order.targetLength ?? 0).toLocaleString()} m
                  </span>
                  <span>
                    ETA:{' '}
                    {order.estimatedFinishTime
                      ? new Date(order.estimatedFinishTime).toLocaleTimeString('en-US', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })
                      : '—'}
                  </span>
                </div>
              </div>

              {/* Bobbin hiện tại */}
              <div className="mt-4 grid gap-3 md:grid-cols-2 text-xs">
                <div className="rounded-xl bg-white/5 border border-white/10 p-3">
                  <div className="text-white/50 text-[11px] mb-1">
                    CURRENT BOBBIN
                  </div>
                  <div className="text-white text-sm mb-1">
                    {activeBobbin?.bobbinId ||
                      lastCompletedBobbin?.bobbinId ||
                      '—'}
                  </div>
                  <div className="flex justify-between text-[11px] text-white/60">
                    <span>
                      LENGTH:{' '}
                      <span className="text-white/80">
                        {activeBobbin
                          ? activeBobbin.currentLengthM.toLocaleString()
                          : lastCompletedBobbin
                          ? lastCompletedBobbin.grossM.toLocaleString()
                          : 0}{' '}
                        m
                      </span>
                    </span>
                    <span>
                      BOBBINS:{' '}
                      <span className="text-white/80">{totalBobbins}</span>
                    </span>
                  </div>
                  <div className="text-[11px] text-white/60 mt-1">
                    LAST CUT:{' '}
                    <span className="text-white/80">
                      {lastCompletedBobbin
                        ? new Date(lastCompletedBobbin.endTime).toLocaleTimeString('en-US', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })
                        : '—'}
                    </span>
                  </div>
                </div>
                <div className="rounded-xl bg-white/5 border border-white/10 p-3">
                  <div className="text-white/50 text-[11px] mb-1">
                    CURRENT BOBBIN LENGTH PROGRESS
                  </div>
                  <div className="h-1.5 rounded-full bg-white/10 overflow-hidden mb-1">
                    <div
                      className="h-full bg-gradient-to-r from-[#34E7F8] to-[#4FFFBC]"
                      style={{
                        width: `${
                          activeBobbin && bobbinSnapshot?.recipeBobbinTargetM
                            ? Math.min(
                                100,
                                (activeBobbin.currentLengthM /
                                  bobbinSnapshot.recipeBobbinTargetM) *
                                  100,
                              )
                            : 0
                        }%`,
                      }}
                    />
                  </div>
                  <div className="flex justify-between text-[11px] text-white/60">
                    <span>
                      {activeBobbin
                        ? activeBobbin.currentLengthM.toLocaleString()
                        : 0}{' '}
                      m
                    </span>
                    <span>
                      Target{' '}
                      {bobbinSnapshot?.recipeBobbinTargetM
                        ? bobbinSnapshot.recipeBobbinTargetM.toLocaleString()
                        : 0}{' '}
                      m
                    </span>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="text-white/60 text-sm">
              No running production order on this machine.
            </div>
          )}
        </div>
      </div>

      {/* Right: lịch sử bobbin */}
      <div className="space-y-4">
        <div className="rounded-2xl bg-white/5 border border-white/10 p-3">
          <div className="flex items-center justify-between mb-2">
            <div className="text-white/70 text-xs uppercase tracking-wide">
              Completed Bobbins
            </div>
            <div className="text-white/50 text-[11px]">
              {history.length} bobbins
            </div>
          </div>
          {history.length === 0 ? (
            <div className="text-white/50 text-xs">No completed bobbins.</div>
          ) : (
            <div className="space-y-2 text-[11px]">
              {history.map((b) => (
                <div
                  key={b.bobbinId}
                  className="rounded-xl bg-white/5 border border-white/10 p-2"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-white text-xs">{b.bobbinId}</div>
                      <div className="text-white/50 text-[10px]">
                        Bobbin #{b.bobbinNo}
                      </div>
                    </div>
                    <span className="px-2 py-0.5 rounded-full text-[10px] border border-emerald-400/60 text-emerald-300">
                      {b.status === 'SCRAP' ? 'SCRAP' : 'PASS'}
                    </span>
                  </div>
                  <div className="flex justify-between text-white/60 text-[10px] mt-1">
                    <span>LENGTH {b.netM.toLocaleString()} m</span>
                    <span>
                      {new Date(b.endTime).toLocaleTimeString('en-US', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}


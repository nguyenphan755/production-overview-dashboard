import { Clock, Package, CheckCircle2, AlertCircle } from 'lucide-react';
import { useMachines, useProductionOrders } from '../../hooks/useProductionData';

export function ProductionSchedule() {
  const { machines } = useMachines();
  const { orders, loading, error } = useProductionOrders();
  
  // Create a map of machine ID to machine name
  const machineNameMap = new Map(
    machines.map(m => [m.id, m.name])
  );
  const machineStatusMap = new Map(
    machines.map(m => [m.id, m.status])
  );
  
  // Helper function to get machine name or fallback to ID
  const getMachineName = (machineId: string) => {
    return machineNameMap.get(machineId) || machineId;
  };
  const formatTime = (isoTime?: string) => {
    if (!isoTime) return '—';
    const date = new Date(isoTime);
    if (Number.isNaN(date.getTime())) return '—';
    return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  };

  const getOrderStatusStyle = (status: string) => {
    switch (status) {
      case 'running':
        return { label: 'RUNNING', color: '#22C55E' };
      case 'completed':
        return { label: 'COMPLETED', color: '#4FFFBC' };
      case 'interrupted':
        return { label: 'INTERRUPTED', color: '#F59E0B' };
      default:
        return { label: status.toUpperCase(), color: '#64748B' };
    }
  };

  const getMachineStatusStyle = (status?: string) => {
    switch (status) {
      case 'running':
        return { label: 'RUNNING', color: '#22C55E' };
      case 'idle':
        return { label: 'IDLE', color: '#64748B' };
      case 'warning':
        return { label: 'WARNING', color: '#F59E0B' };
      case 'error':
        return { label: 'ERROR', color: '#EF4444' };
      case 'stopped':
        return { label: 'STOPPED', color: '#34E7F8' };
      case 'setup':
        return { label: 'SETUP', color: '#FFB86C' };
      default:
        return { label: 'UNKNOWN', color: '#64748B' };
    }
  };

  const runningOrders = orders.filter(order => order.status === 'running');
  const completedOrders = orders.filter(order => order.status === 'completed');
  const interruptedOrders = orders.filter(order => order.status === 'interrupted');
  const otherOrders = orders.filter(
    order => !['running', 'completed', 'interrupted'].includes(order.status)
  );

  const renderOrders = (list: typeof orders, title: string, icon: JSX.Element) => (
    <div className="mb-6 rounded-2xl bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-xl border border-white/20 shadow-2xl p-5">
      <div className="flex items-center gap-2 mb-4">
        {icon}
        <h3 className="text-white">{title}</h3>
      </div>
      {list.length === 0 ? (
        <div className="text-white/50 text-sm">No executions available.</div>
      ) : (
        <div className="space-y-3">
          {list.map(order => {
            const producedLength = order.producedLength || 0;
            const targetLength = order.targetLength || 0;
            const progress = targetLength > 0 ? (producedLength / targetLength) * 100 : 0;
            const orderStatus = getOrderStatusStyle(order.status);
            const machineName = order.machineName || getMachineName(order.machineId);
            const machineStatus = getMachineStatusStyle(machineStatusMap.get(order.machineId));
            const productName = order.productNameCurrent?.trim() || order.productName;
            const productLabel = order.productNameCurrent?.trim() ? 'CURRENT' : 'SNAPSHOT';

            return (
              <div key={`${order.id}-${order.machineId}-${order.startTime}`}>
                <div className="desktop-only p-5 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-all">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <span className="text-white/60 text-sm">{order.id}</span>
                        <span
                          className="px-2 py-0.5 rounded-full text-xs border"
                          style={{
                            borderColor: `${orderStatus.color}80`,
                            color: orderStatus.color
                          }}
                        >
                          {orderStatus.label}
                        </span>
                        <span
                          className="px-2 py-0.5 rounded-full text-xs border"
                          style={{
                            borderColor: `${machineStatus.color}80`,
                            color: machineStatus.color
                          }}
                        >
                          {machineStatus.label}
                        </span>
                      </div>
                      <div className="text-white text-xl mb-1">{productName || 'Not entered yet'}</div>
                      <div className="text-white/60 text-sm">{order.customer}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-3xl text-[#34E7F8]">{progress.toFixed(0)}%</div>
                      <div className="text-white/40 text-xs">Complete</div>
                    </div>
                  </div>

                  <div className="mb-4">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-white/60 text-sm">Progress</span>
                      <span className="text-white text-sm">
                        {producedLength.toLocaleString()} / {targetLength.toLocaleString()} m
                      </span>
                    </div>
                    <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-[#34E7F8] to-[#4FFFBC] rounded-full transition-all duration-500"
                        style={{ width: `${Math.min(progress, 100)}%` }}
                      />
                    </div>
                  </div>

                  <div className="grid gap-4 responsive-grid-4">
                    <div>
                      <div className="text-white/60 text-xs mb-1">MACHINE</div>
                      <div className="text-white">{machineName}</div>
                      <div className="text-white/40 text-xs">{order.machineId}</div>
                    </div>
                    <div>
                      <div className="text-white/60 text-xs mb-1">START</div>
                      <div className="text-white">{formatTime(order.startTime)}</div>
                    </div>
                    <div>
                      <div className="text-white/60 text-xs mb-1">END</div>
                      <div className="text-white">{formatTime(order.endTime)}</div>
                    </div>
                    <div>
                      <div className="text-white/60 text-xs mb-1">PRODUCT</div>
                      <div className="text-[#34E7F8] text-sm">{productLabel}</div>
                    </div>
                  </div>
                </div>

                <details className="mobile-only mobile-accordion rounded-xl bg-white/5 border border-white/10 p-4">
                  <summary className="flex items-start justify-between gap-3 text-white cursor-pointer">
                    <div className="min-w-0">
                      <div className="text-white/60 text-xs">{order.id}</div>
                      <div className="text-white text-base truncate">{productName || 'Not entered yet'}</div>
                      <div className="text-white/40 text-xs">{order.customer}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl text-[#34E7F8]">{progress.toFixed(0)}%</div>
                      <div className="text-white/40 text-xs">Complete</div>
                    </div>
                  </summary>
                  <div className="mt-3 space-y-3 border-t border-white/10 pt-3">
                    <div className="flex flex-wrap gap-2">
                      <span
                        className="px-2 py-0.5 rounded-full text-xs border"
                        style={{
                          borderColor: `${orderStatus.color}80`,
                          color: orderStatus.color
                        }}
                      >
                        {orderStatus.label}
                      </span>
                      <span
                        className="px-2 py-0.5 rounded-full text-xs border"
                        style={{
                          borderColor: `${machineStatus.color}80`,
                          color: machineStatus.color
                        }}
                      >
                        {machineStatus.label}
                      </span>
                    </div>
                    <div>
                      <div className="text-white/60 text-xs mb-1">Progress</div>
                      <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-[#34E7F8] to-[#4FFFBC] rounded-full"
                          style={{ width: `${Math.min(progress, 100)}%` }}
                        />
                      </div>
                      <div className="text-white/60 text-xs mt-1">
                        {producedLength.toLocaleString()} / {targetLength.toLocaleString()} m
                      </div>
                    </div>
                    <div className="grid gap-3 responsive-grid-2">
                      <div>
                        <div className="text-white/60 text-xs mb-1">MACHINE</div>
                        <div className="text-white">{machineName}</div>
                        <div className="text-white/40 text-xs">{order.machineId}</div>
                      </div>
                      <div>
                        <div className="text-white/60 text-xs mb-1">START</div>
                        <div className="text-white">{formatTime(order.startTime)}</div>
                      </div>
                      <div>
                        <div className="text-white/60 text-xs mb-1">END</div>
                        <div className="text-white">{formatTime(order.endTime)}</div>
                      </div>
                      <div>
                        <div className="text-white/60 text-xs mb-1">PRODUCT</div>
                        <div className="text-[#34E7F8] text-sm">{productLabel}</div>
                      </div>
                    </div>
                  </div>
                </details>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );

  return (
    <>
      {/* Summary Cards */}
      <div className="mb-6 grid gap-4 responsive-grid-4">
        <div className="rounded-2xl bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-xl border border-white/20 shadow-2xl p-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-xl bg-[#34E7F8]/20">
              <Clock className="w-5 h-5 text-[#34E7F8]" strokeWidth={2.5} />
            </div>
            <span className="text-white/60 text-xs tracking-wider">RUNNING</span>
          </div>
          <div className="text-3xl text-[#34E7F8]">{runningOrders.length}</div>
          <div className="text-white/40 text-xs mt-1">Executions</div>
        </div>

        <div className="rounded-2xl bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-xl border border-white/20 shadow-2xl p-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-xl bg-[#4FFFBC]/20">
              <CheckCircle2 className="w-5 h-5 text-[#4FFFBC]" strokeWidth={2.5} />
            </div>
            <span className="text-white/60 text-xs tracking-wider">COMPLETED</span>
          </div>
          <div className="text-3xl text-[#4FFFBC]">{completedOrders.length}</div>
          <div className="text-white/40 text-xs mt-1">Executions</div>
        </div>

        <div className="rounded-2xl bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-xl border border-white/20 shadow-2xl p-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-xl bg-[#FFB86C]/20">
              <AlertCircle className="w-5 h-5 text-[#FFB86C]" strokeWidth={2.5} />
            </div>
            <span className="text-white/60 text-xs tracking-wider">INTERRUPTED</span>
          </div>
          <div className="text-3xl text-[#FFB86C]">{interruptedOrders.length}</div>
          <div className="text-white/40 text-xs mt-1">Executions</div>
        </div>

        <div className="rounded-2xl bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-xl border border-white/20 shadow-2xl p-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-xl bg-[#6366F1]/20">
              <Package className="w-5 h-5 text-[#6366F1]" strokeWidth={2.5} />
            </div>
            <span className="text-white/60 text-xs tracking-wider">TOTAL</span>
          </div>
          <div className="text-3xl text-[#6366F1]">{orders.length}</div>
          <div className="text-white/40 text-xs mt-1">Executions</div>
        </div>
      </div>

      {loading && <div className="text-white/60">Loading execution data...</div>}
      {error && <div className="text-[#EF4444]">{error}</div>}
      {!loading && !error && (
        <>
          {renderOrders(runningOrders, 'Running Executions', <Clock className="w-5 h-5 text-[#34E7F8]" />)}
          {renderOrders(interruptedOrders, 'Interrupted Executions', <AlertCircle className="w-5 h-5 text-[#FFB86C]" />)}
          {renderOrders(completedOrders, 'Completed Executions', <CheckCircle2 className="w-5 h-5 text-[#4FFFBC]" />)}
          {otherOrders.length > 0 &&
            renderOrders(otherOrders, 'Other Executions', <Package className="w-5 h-5 text-[#6366F1]" />)}
        </>
      )}
    </>
  );
}

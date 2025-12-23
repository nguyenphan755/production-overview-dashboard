import { Calendar, Clock, Package, CheckCircle2, AlertCircle } from 'lucide-react';

export function ProductionSchedule() {
  const activeOrders = [
    {
      id: 'PO-2024-156',
      product: 'CV 3x2.5mm²',
      customer: 'Công ty ABC',
      quantity: 5000,
      completed: 3850,
      progress: 77,
      machine: 'D-01',
      area: 'Kéo',
      startTime: '06:00',
      endTime: '14:30',
      status: 'in-progress',
      priority: 'high'
    },
    {
      id: 'PO-2024-157',
      product: 'VCm 2x4mm²',
      customer: 'Công ty XYZ',
      quantity: 3500,
      completed: 2100,
      progress: 60,
      machine: 'S-02',
      area: 'Xoắn',
      startTime: '07:00',
      endTime: '15:00',
      status: 'in-progress',
      priority: 'medium'
    },
    {
      id: 'PO-2024-158',
      product: 'CV 4x6mm²',
      customer: 'Công ty DEF',
      quantity: 2800,
      completed: 2650,
      progress: 95,
      machine: 'SH-01',
      area: 'Bọc',
      startTime: '06:30',
      endTime: '13:00',
      status: 'in-progress',
      priority: 'high'
    }
  ];

  const upcomingOrders = [
    {
      id: 'PO-2024-159',
      product: 'VCm 3x2.5mm²',
      customer: 'Công ty GHI',
      quantity: 4200,
      machine: 'D-03',
      area: 'Kéo',
      scheduledStart: '14:30',
      estimatedDuration: '6h 30m',
      priority: 'medium'
    },
    {
      id: 'PO-2024-160',
      product: 'CV 2x1.5mm²',
      customer: 'Công ty JKL',
      quantity: 6500,
      machine: 'D-01',
      area: 'Kéo',
      scheduledStart: '15:00',
      estimatedDuration: '8h 15m',
      priority: 'high'
    },
    {
      id: 'PO-2024-161',
      product: 'VCm 4x4mm²',
      customer: 'Công ty MNO',
      quantity: 3800,
      machine: 'S-05',
      area: 'Xoắn',
      scheduledStart: '15:30',
      estimatedDuration: '5h 45m',
      priority: 'low'
    }
  ];

  const completedToday = [
    { id: 'PO-2024-153', product: 'CV 3x1.5mm²', quantity: 4500, completedAt: '11:30', duration: '5h 30m' },
    { id: 'PO-2024-154', product: 'VCm 2x2.5mm²', quantity: 3200, completedAt: '10:15', duration: '4h 15m' },
    { id: 'PO-2024-155', product: 'CV 4x4mm²', quantity: 2900, completedAt: '09:45', duration: '3h 45m' }
  ];

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'text-[#FF4C4C]';
      case 'medium': return 'text-[#FFB86C]';
      case 'low': return 'text-[#4FFFBC]';
      default: return 'text-white/40';
    }
  };

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case 'high': return 'border-[#FF4C4C]/30 bg-[#FF4C4C]/10';
      case 'medium': return 'border-[#FFB86C]/30 bg-[#FFB86C]/10';
      case 'low': return 'border-[#4FFFBC]/30 bg-[#4FFFBC]/10';
      default: return 'border-white/20 bg-white/5';
    }
  };

  return (
    <>
      {/* Summary Cards */}
      <div className="mb-6 grid grid-cols-4 gap-4">
        <div className="rounded-2xl bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-xl border border-white/20 shadow-2xl p-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-xl bg-[#34E7F8]/20">
              <Clock className="w-5 h-5 text-[#34E7F8]" strokeWidth={2.5} />
            </div>
            <span className="text-white/60 text-xs tracking-wider">ACTIVE</span>
          </div>
          <div className="text-3xl text-[#34E7F8]">18</div>
          <div className="text-white/40 text-xs mt-1">Production orders</div>
        </div>

        <div className="rounded-2xl bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-xl border border-white/20 shadow-2xl p-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-xl bg-[#4FFFBC]/20">
              <CheckCircle2 className="w-5 h-5 text-[#4FFFBC]" strokeWidth={2.5} />
            </div>
            <span className="text-white/60 text-xs tracking-wider">COMPLETED</span>
          </div>
          <div className="text-3xl text-[#4FFFBC]">12</div>
          <div className="text-white/40 text-xs mt-1">Today</div>
        </div>

        <div className="rounded-2xl bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-xl border border-white/20 shadow-2xl p-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-xl bg-[#FFB86C]/20">
              <Calendar className="w-5 h-5 text-[#FFB86C]" strokeWidth={2.5} />
            </div>
            <span className="text-white/60 text-xs tracking-wider">SCHEDULED</span>
          </div>
          <div className="text-3xl text-[#FFB86C]">25</div>
          <div className="text-white/40 text-xs mt-1">Next 24 hours</div>
        </div>

        <div className="rounded-2xl bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-xl border border-white/20 shadow-2xl p-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-xl bg-[#FF4C4C]/20">
              <AlertCircle className="w-5 h-5 text-[#FF4C4C]" strokeWidth={2.5} />
            </div>
            <span className="text-white/60 text-xs tracking-wider">DELAYED</span>
          </div>
          <div className="text-3xl text-[#FF4C4C]">2</div>
          <div className="text-white/40 text-xs mt-1">Behind schedule</div>
        </div>
      </div>

      {/* Active Production Orders */}
      <div className="mb-6 rounded-2xl bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-xl border border-white/20 shadow-2xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <Clock className="w-5 h-5 text-[#34E7F8]" />
          <h3 className="text-white">Active Production Orders</h3>
        </div>
        <div className="space-y-3">
          {activeOrders.map((order, index) => (
            <div 
              key={index}
              className="p-5 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-all"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="text-white/60 text-sm">{order.id}</span>
                    <span className={`px-2 py-0.5 rounded-full text-xs border ${getPriorityBadge(order.priority)} ${getPriorityColor(order.priority)}`}>
                      {order.priority.toUpperCase()}
                    </span>
                  </div>
                  <div className="text-white text-xl mb-1">{order.product}</div>
                  <div className="text-white/60 text-sm">{order.customer}</div>
                </div>
                <div className="text-right">
                  <div className="text-3xl text-[#34E7F8]">{order.progress}%</div>
                  <div className="text-white/40 text-xs">Complete</div>
                </div>
              </div>

              <div className="mb-4">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-white/60 text-sm">Progress</span>
                  <span className="text-white text-sm">{order.completed.toLocaleString()} / {order.quantity.toLocaleString()} m</span>
                </div>
                <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-gradient-to-r from-[#34E7F8] to-[#4FFFBC] rounded-full transition-all duration-500"
                    style={{ width: `${order.progress}%` }}
                  />
                </div>
              </div>

              <div className="grid grid-cols-4 gap-4">
                <div>
                  <div className="text-white/60 text-xs mb-1">MACHINE</div>
                  <div className="text-white">{order.machine}</div>
                  <div className="text-white/40 text-xs">{order.area}</div>
                </div>
                <div>
                  <div className="text-white/60 text-xs mb-1">START TIME</div>
                  <div className="text-white">{order.startTime}</div>
                </div>
                <div>
                  <div className="text-white/60 text-xs mb-1">EST. END</div>
                  <div className="text-white">{order.endTime}</div>
                </div>
                <div>
                  <div className="text-white/60 text-xs mb-1">REMAINING</div>
                  <div className="text-[#FFB86C]">{(order.quantity - order.completed).toLocaleString()} m</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {/* Upcoming Orders */}
        <div className="rounded-2xl bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-xl border border-white/20 shadow-2xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <Calendar className="w-5 h-5 text-[#FFB86C]" />
            <h3 className="text-white">Upcoming Orders</h3>
          </div>
          <div className="space-y-3">
            {upcomingOrders.map((order, index) => (
              <div 
                key={index}
                className="p-4 rounded-xl bg-white/5 border border-white/10"
              >
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-white/60 text-xs">{order.id}</span>
                      <span className={`px-2 py-0.5 rounded-full text-xs border ${getPriorityBadge(order.priority)} ${getPriorityColor(order.priority)}`}>
                        {order.priority}
                      </span>
                    </div>
                    <div className="text-white text-lg">{order.product}</div>
                    <div className="text-white/60 text-sm">{order.customer}</div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 mb-3">
                  <div>
                    <div className="text-white/60 text-xs mb-1">QUANTITY</div>
                    <div className="text-[#34E7F8]">{order.quantity.toLocaleString()} m</div>
                  </div>
                  <div>
                    <div className="text-white/60 text-xs mb-1">DURATION</div>
                    <div className="text-white">{order.estimatedDuration}</div>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-3 border-t border-white/10">
                  <div>
                    <div className="text-white/60 text-xs">STARTS AT</div>
                    <div className="text-[#FFB86C]">{order.scheduledStart}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-white/60 text-xs">MACHINE</div>
                    <div className="text-white">{order.machine}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Completed Today */}
        <div className="rounded-2xl bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-xl border border-white/20 shadow-2xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <CheckCircle2 className="w-5 h-5 text-[#4FFFBC]" />
            <h3 className="text-white">Completed Today</h3>
          </div>
          <div className="space-y-3">
            {completedToday.map((order, index) => (
              <div 
                key={index}
                className="p-4 rounded-xl bg-white/5 border border-white/10"
              >
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <div className="text-white/60 text-xs mb-1">{order.id}</div>
                    <div className="text-white text-lg">{order.product}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5 text-[#4FFFBC]" />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <div className="text-white/60 text-xs mb-1">QUANTITY</div>
                    <div className="text-[#4FFFBC]">{order.quantity.toLocaleString()} m</div>
                  </div>
                  <div>
                    <div className="text-white/60 text-xs mb-1">DURATION</div>
                    <div className="text-white">{order.duration}</div>
                  </div>
                </div>

                <div className="mt-3 pt-3 border-t border-white/10">
                  <div className="text-white/60 text-xs">COMPLETED AT</div>
                  <div className="text-white">{order.completedAt}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}

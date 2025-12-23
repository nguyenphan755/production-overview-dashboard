import { Wrench, Calendar, CheckCircle2, Clock, AlertTriangle, Package } from 'lucide-react';
import { useMachines } from '../../hooks/useProductionData';

export function Maintenance() {
  const { machines } = useMachines();
  
  // Create a map of machine ID to machine name
  const machineNameMap = new Map(
    machines.map(m => [m.id, m.name])
  );
  
  // Helper function to get machine name or fallback to ID
  const getMachineName = (machineId: string) => {
    return machineNameMap.get(machineId) || machineId;
  };
  const upcomingMaintenance = [
    {
      machine: 'D-01',
      area: 'Kéo',
      type: 'Preventive',
      dueIn: 2,
      duration: 4,
      priority: 'high',
      parts: ['Bearing Set', 'Oil Filter']
    },
    {
      machine: 'S-05',
      area: 'Xoắn',
      type: 'Preventive',
      dueIn: 1,
      duration: 3,
      priority: 'critical',
      parts: ['Belt Kit', 'Cooling Fan']
    },
    {
      machine: 'D-03',
      area: 'Kéo',
      type: 'Inspection',
      dueIn: 5,
      duration: 2,
      priority: 'medium',
      parts: []
    },
    {
      machine: 'SH-04',
      area: 'Bọc',
      type: 'Preventive',
      dueIn: 7,
      duration: 5,
      priority: 'medium',
      parts: ['Motor Coupling', 'Drive Belt']
    }
  ];

  const workOrders = [
    {
      id: 'WO-2024-128',
      machine: 'SH-06',
      area: 'Bọc',
      issue: 'Temperature sensor failure',
      status: 'in-progress',
      technician: 'Nguyễn V.A',
      started: '2h ago',
      estimatedCompletion: '1h'
    },
    {
      id: 'WO-2024-127',
      machine: 'D-07',
      area: 'Kéo',
      issue: 'Bearing replacement',
      status: 'completed',
      technician: 'Trần T.B',
      completed: '3h ago',
      duration: '2h 15m'
    },
    {
      id: 'WO-2024-126',
      machine: 'S-08',
      area: 'Xoắn',
      issue: 'Lubrication system check',
      status: 'pending',
      assignedTo: 'Lê V.C',
      priority: 'low'
    }
  ];

  const maintenanceHistory = [
    { date: '12/12', completed: 8, planned: 8, emergency: 1 },
    { date: '11/12', completed: 6, planned: 7, emergency: 2 },
    { date: '10/12', completed: 9, planned: 9, emergency: 0 },
    { date: '09/12', completed: 7, planned: 8, emergency: 3 },
    { date: '08/12', completed: 8, planned: 8, emergency: 1 }
  ];

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'critical': return 'bg-[#FF4C4C]';
      case 'high': return 'bg-[#FFB86C]';
      case 'medium': return 'bg-[#34E7F8]';
      case 'low': return 'bg-[#4FFFBC]';
      default: return 'bg-white/20';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'in-progress': return 'text-[#FFB86C]';
      case 'completed': return 'text-[#4FFFBC]';
      case 'pending': return 'text-[#34E7F8]';
      default: return 'text-white/40';
    }
  };

  return (
    <>
      {/* Summary Cards */}
      <div className="mb-6 grid grid-cols-4 gap-4">
        <div className="rounded-2xl bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-xl border border-white/20 shadow-2xl p-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-xl bg-[#FFB86C]/20">
              <Calendar className="w-5 h-5 text-[#FFB86C]" strokeWidth={2.5} />
            </div>
            <span className="text-white/60 text-xs tracking-wider">SCHEDULED</span>
          </div>
          <div className="text-3xl text-[#FFB86C]">12</div>
          <div className="text-white/40 text-xs mt-1">Next 7 days</div>
        </div>

        <div className="rounded-2xl bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-xl border border-white/20 shadow-2xl p-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-xl bg-[#34E7F8]/20">
              <Wrench className="w-5 h-5 text-[#34E7F8]" strokeWidth={2.5} />
            </div>
            <span className="text-white/60 text-xs tracking-wider">IN PROGRESS</span>
          </div>
          <div className="text-3xl text-[#34E7F8]">3</div>
          <div className="text-white/40 text-xs mt-1">Active work orders</div>
        </div>

        <div className="rounded-2xl bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-xl border border-white/20 shadow-2xl p-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-xl bg-[#4FFFBC]/20">
              <CheckCircle2 className="w-5 h-5 text-[#4FFFBC]" strokeWidth={2.5} />
            </div>
            <span className="text-white/60 text-xs tracking-wider">COMPLETED</span>
          </div>
          <div className="text-3xl text-[#4FFFBC]">8</div>
          <div className="text-white/40 text-xs mt-1">Today</div>
        </div>

        <div className="rounded-2xl bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-xl border border-white/20 shadow-2xl p-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-xl bg-[#FF4C4C]/20">
              <AlertTriangle className="w-5 h-5 text-[#FF4C4C]" strokeWidth={2.5} />
            </div>
            <span className="text-white/60 text-xs tracking-wider">OVERDUE</span>
          </div>
          <div className="text-3xl text-[#FF4C4C]">1</div>
          <div className="text-white/40 text-xs mt-1">Needs attention</div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-6">
        {/* Upcoming Maintenance */}
        <div className="rounded-2xl bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-xl border border-white/20 shadow-2xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <Calendar className="w-5 h-5 text-[#FFB86C]" />
            <h3 className="text-white">Upcoming Maintenance</h3>
          </div>
          <div className="space-y-3">
            {upcomingMaintenance.map((item, index) => (
              <div 
                key={index}
                className="p-4 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-all"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className={`w-2 h-2 rounded-full ${getPriorityColor(item.priority)} shadow-lg`} />
                    <div>
                      <div className="text-white text-lg">{getMachineName(item.machine)}</div>
                      <div className="text-white/40 text-sm">{item.machine} • {item.area} • {item.type}</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className={`text-xl ${item.dueIn <= 2 ? 'text-[#FF4C4C]' : 'text-[#34E7F8]'}`}>
                      {item.dueIn}d
                    </div>
                    <div className="text-white/40 text-xs">Due in</div>
                  </div>
                </div>
                
                <div className="flex items-center gap-4 mb-2">
                  <div className="flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-[#FFB86C]" />
                    <span className="text-white/60 text-sm">{item.duration}h</span>
                  </div>
                  {item.parts.length > 0 && (
                    <div className="flex items-center gap-1.5">
                      <Package className="w-3.5 h-3.5 text-[#4FFFBC]" />
                      <span className="text-white/60 text-sm">{item.parts.length} parts</span>
                    </div>
                  )}
                </div>
                
                {item.parts.length > 0 && (
                  <div className="text-white/40 text-xs">
                    {item.parts.join(', ')}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Active Work Orders */}
        <div className="rounded-2xl bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-xl border border-white/20 shadow-2xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <Wrench className="w-5 h-5 text-[#34E7F8]" />
            <h3 className="text-white">Work Orders</h3>
          </div>
          <div className="space-y-3">
            {workOrders.map((order, index) => (
              <div 
                key={index}
                className="p-4 rounded-xl bg-white/5 border border-white/10"
              >
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <div className="text-white/60 text-xs mb-1">{order.id}</div>
                    <div className="text-white text-lg">{getMachineName(order.machine)}</div>
                    <div className="text-white/40 text-sm">{order.machine} • {order.area}</div>
                  </div>
                  <div className={`px-3 py-1 rounded-full text-xs ${getStatusColor(order.status)} border ${
                    order.status === 'in-progress' ? 'border-[#FFB86C]/30 bg-[#FFB86C]/10' :
                    order.status === 'completed' ? 'border-[#4FFFBC]/30 bg-[#4FFFBC]/10' :
                    'border-[#34E7F8]/30 bg-[#34E7F8]/10'
                  }`}>
                    {order.status.toUpperCase()}
                  </div>
                </div>
                
                <div className="text-white/80 text-sm mb-3">{order.issue}</div>
                
                <div className="space-y-1">
                  {order.status === 'in-progress' && (
                    <>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-white/60">Technician:</span>
                        <span className="text-white">{order.technician}</span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-white/60">Started:</span>
                        <span className="text-white">{order.started}</span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-white/60">ETA:</span>
                        <span className="text-[#34E7F8]">{order.estimatedCompletion}</span>
                      </div>
                    </>
                  )}
                  
                  {order.status === 'completed' && (
                    <>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-white/60">Technician:</span>
                        <span className="text-white">{order.technician}</span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-white/60">Duration:</span>
                        <span className="text-white">{order.duration}</span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-white/60">Completed:</span>
                        <span className="text-[#4FFFBC]">{order.completed}</span>
                      </div>
                    </>
                  )}
                  
                  {order.status === 'pending' && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-white/60">Assigned to:</span>
                      <span className="text-white">{order.assignedTo}</span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Maintenance History */}
      <div className="rounded-2xl bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-xl border border-white/20 shadow-2xl p-5">
        <h3 className="text-white mb-4">Recent Maintenance Activity</h3>
        <div className="grid grid-cols-5 gap-4">
          {maintenanceHistory.map((day, index) => (
            <div 
              key={index}
              className="p-4 rounded-xl bg-white/5 border border-white/10 text-center"
            >
              <div className="text-white/60 text-xs mb-3">{day.date}</div>
              <div className="space-y-2">
                <div>
                  <div className="text-2xl text-[#4FFFBC]">{day.completed}</div>
                  <div className="text-white/40 text-xs">Completed</div>
                </div>
                <div>
                  <div className="text-lg text-[#34E7F8]">{day.planned}</div>
                  <div className="text-white/40 text-xs">Planned</div>
                </div>
                {day.emergency > 0 && (
                  <div>
                    <div className="text-lg text-[#FF4C4C]">{day.emergency}</div>
                    <div className="text-white/40 text-xs">Emergency</div>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

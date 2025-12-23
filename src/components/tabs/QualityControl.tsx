import { CheckCircle2, XCircle, AlertTriangle, TrendingDown, Target, ClipboardList } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

export function QualityControl() {
  const defectData = [
    { name: 'Kéo', defects: 23, total: 5680, rate: 0.4 },
    { name: 'Xoắn', defects: 12, total: 3450, rate: 0.35 },
    { name: 'Bọc', defects: 18, total: 2920, rate: 0.62 }
  ];

  const defectTypes = [
    { type: 'Diameter', count: 28, color: '#FF4C4C' },
    { type: 'Surface', count: 15, color: '#FFB86C' },
    { type: 'Length', count: 10, color: '#34E7F8' }
  ];

  const inspectionStatus = [
    { area: 'Kéo', inspector: 'Nguyễn V.A', time: '5 phút trước', status: 'passed', samples: 12 },
    { area: 'Xoắn', inspector: 'Trần T.B', time: '12 phút trước', status: 'passed', samples: 8 },
    { area: 'Bọc', inspector: 'Lê V.C', time: '3 phút trước', status: 'warning', samples: 5 }
  ];

  return (
    <>
      {/* Quality KPIs */}
      <div className="mb-6 grid grid-cols-4 gap-4">
        <div className="rounded-2xl bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-xl border border-white/20 shadow-2xl p-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-xl bg-[#4FFFBC]/20">
              <CheckCircle2 className="w-5 h-5 text-[#4FFFBC]" strokeWidth={2.5} />
            </div>
            <span className="text-white/60 text-xs tracking-wider">PASS RATE</span>
          </div>
          <div className="text-3xl text-[#4FFFBC]">99.6%</div>
          <div className="text-white/40 text-xs mt-1">↑ 0.2% vs yesterday</div>
        </div>

        <div className="rounded-2xl bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-xl border border-white/20 shadow-2xl p-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-xl bg-[#FF4C4C]/20">
              <XCircle className="w-5 h-5 text-[#FF4C4C]" strokeWidth={2.5} />
            </div>
            <span className="text-white/60 text-xs tracking-wider">DEFECTS</span>
          </div>
          <div className="text-3xl text-[#FF4C4C]">53</div>
          <div className="text-white/40 text-xs mt-1">Today's total</div>
        </div>

        <div className="rounded-2xl bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-xl border border-white/20 shadow-2xl p-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-xl bg-[#34E7F8]/20">
              <ClipboardList className="w-5 h-5 text-[#34E7F8]" strokeWidth={2.5} />
            </div>
            <span className="text-white/60 text-xs tracking-wider">INSPECTIONS</span>
          </div>
          <div className="text-3xl text-[#34E7F8]">156</div>
          <div className="text-white/40 text-xs mt-1">Last 8 hours</div>
        </div>

        <div className="rounded-2xl bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-xl border border-white/20 shadow-2xl p-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-xl bg-[#FFB86C]/20">
              <Target className="w-5 h-5 text-[#FFB86C]" strokeWidth={2.5} />
            </div>
            <span className="text-white/60 text-xs tracking-wider">FIRST PASS YIELD</span>
          </div>
          <div className="text-3xl text-[#FFB86C]">98.2%</div>
          <div className="text-white/40 text-xs mt-1">Target: 98.5%</div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-6">
        {/* Defects by Area */}
        <div className="rounded-2xl bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-xl border border-white/20 shadow-2xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <TrendingDown className="w-5 h-5 text-[#FF4C4C]" />
            <h3 className="text-white">Defect Rate by Area</h3>
          </div>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={defectData}>
                <XAxis 
                  dataKey="name" 
                  stroke="#ffffff40" 
                  tick={{ fill: '#ffffff80' }}
                />
                <YAxis 
                  stroke="#ffffff40" 
                  tick={{ fill: '#ffffff80' }}
                />
                <Bar dataKey="defects" fill="#FF4C4C" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Defect Types */}
        <div className="rounded-2xl bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-xl border border-white/20 shadow-2xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle className="w-5 h-5 text-[#FFB86C]" />
            <h3 className="text-white">Defect Types Distribution</h3>
          </div>
          <div className="flex items-center gap-6">
            <div className="h-40 w-40">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={defectTypes}
                    dataKey="count"
                    cx="50%"
                    cy="50%"
                    innerRadius={40}
                    outerRadius={60}
                  >
                    {defectTypes.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex-1 space-y-3">
              {defectTypes.map((item, index) => (
                <div key={index} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div 
                      className="w-3 h-3 rounded-full" 
                      style={{ backgroundColor: item.color }}
                    />
                    <span className="text-white/80">{item.type}</span>
                  </div>
                  <span className="text-xl" style={{ color: item.color }}>{item.count}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Recent Inspections */}
      <div className="rounded-2xl bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-xl border border-white/20 shadow-2xl p-5">
        <h3 className="text-white mb-4">Recent Inspections</h3>
        <div className="space-y-3">
          {inspectionStatus.map((inspection, index) => (
            <div 
              key={index}
              className="flex items-center justify-between p-4 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-all"
            >
              <div className="flex items-center gap-4">
                <div className={`w-2 h-2 rounded-full ${
                  inspection.status === 'passed' ? 'bg-[#4FFFBC]' : 'bg-[#FFB86C]'
                } shadow-lg`} />
                <div>
                  <div className="text-white">{inspection.area}</div>
                  <div className="text-white/40 text-sm">{inspection.inspector}</div>
                </div>
              </div>
              <div className="flex items-center gap-6">
                <div className="text-center">
                  <div className="text-white/60 text-xs">SAMPLES</div>
                  <div className="text-xl text-[#34E7F8]">{inspection.samples}</div>
                </div>
                <div className="text-white/40 text-sm">{inspection.time}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

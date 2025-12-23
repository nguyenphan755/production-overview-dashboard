import { TrendingUp, Clock, Zap, Target } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, BarChart, Bar, Tooltip } from 'recharts';

export function PerformanceAnalytics() {
  const oeeData = [
    { time: '00:00', oee: 85, availability: 92, performance: 88, quality: 99 },
    { time: '02:00', oee: 87, availability: 94, performance: 89, quality: 99 },
    { time: '04:00', oee: 83, availability: 90, performance: 87, quality: 98 },
    { time: '06:00', oee: 89, availability: 95, performance: 91, quality: 99 },
    { time: '08:00', oee: 91, availability: 96, performance: 93, quality: 99 },
    { time: '10:00', oee: 88, availability: 94, performance: 90, quality: 98 },
    { time: '12:00', oee: 86, availability: 93, performance: 89, quality: 99 },
    { time: '14:00', oee: 90, availability: 95, performance: 92, quality: 99 }
  ];

  const downtimeData = [
    { reason: 'Setup', duration: 45, color: '#FFB86C' },
    { reason: 'Material', duration: 32, color: '#34E7F8' },
    { reason: 'Maintenance', duration: 28, color: '#4FFFBC' },
    { reason: 'Quality', duration: 18, color: '#FF4C4C' },
    { reason: 'Break', duration: 60, color: '#9580FF' }
  ];

  const areaPerformance = [
    { area: 'Kéo', oee: 89, availability: 94, performance: 91, quality: 99 },
    { area: 'Xoắn', oee: 87, availability: 92, performance: 90, quality: 98 },
    { area: 'Bọc', oee: 85, availability: 90, performance: 88, quality: 99 }
  ];

  return (
    <>
      {/* OEE Summary */}
      <div className="mb-6 grid grid-cols-4 gap-4">
        <div className="rounded-2xl bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-xl border border-white/20 shadow-2xl p-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-xl bg-[#34E7F8]/20">
              <Target className="w-5 h-5 text-[#34E7F8]" strokeWidth={2.5} />
            </div>
            <span className="text-white/60 text-xs tracking-wider">OEE</span>
          </div>
          <div className="text-3xl text-[#34E7F8]">88%</div>
          <div className="text-white/40 text-xs mt-1">Overall Equipment Effectiveness</div>
        </div>

        <div className="rounded-2xl bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-xl border border-white/20 shadow-2xl p-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-xl bg-[#4FFFBC]/20">
              <Zap className="w-5 h-5 text-[#4FFFBC]" strokeWidth={2.5} />
            </div>
            <span className="text-white/60 text-xs tracking-wider">AVAILABILITY</span>
          </div>
          <div className="text-3xl text-[#4FFFBC]">93%</div>
          <div className="text-white/40 text-xs mt-1">↑ 2% vs last week</div>
        </div>

        <div className="rounded-2xl bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-xl border border-white/20 shadow-2xl p-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-xl bg-[#FFB86C]/20">
              <TrendingUp className="w-5 h-5 text-[#FFB86C]" strokeWidth={2.5} />
            </div>
            <span className="text-white/60 text-xs tracking-wider">PERFORMANCE</span>
          </div>
          <div className="text-3xl text-[#FFB86C]">90%</div>
          <div className="text-white/40 text-xs mt-1">↑ 1.5% vs last week</div>
        </div>

        <div className="rounded-2xl bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-xl border border-white/20 shadow-2xl p-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-xl bg-[#9580FF]/20">
              <Target className="w-5 h-5 text-[#9580FF]" strokeWidth={2.5} />
            </div>
            <span className="text-white/60 text-xs tracking-wider">QUALITY</span>
          </div>
          <div className="text-3xl text-[#9580FF]">99%</div>
          <div className="text-white/40 text-xs mt-1">→ Stable</div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-6">
        {/* OEE Trend */}
        <div className="rounded-2xl bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-xl border border-white/20 shadow-2xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="w-5 h-5 text-[#34E7F8]" />
            <h3 className="text-white">OEE Trend (Today)</h3>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={oeeData}>
                <XAxis 
                  dataKey="time" 
                  stroke="#ffffff40" 
                  tick={{ fill: '#ffffff80' }}
                />
                <YAxis 
                  stroke="#ffffff40" 
                  tick={{ fill: '#ffffff80' }}
                  domain={[70, 100]}
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: '#0E2F4F', 
                    border: '1px solid rgba(255,255,255,0.2)',
                    borderRadius: '12px'
                  }}
                />
                <Line 
                  type="monotone" 
                  dataKey="oee" 
                  stroke="#34E7F8" 
                  strokeWidth={3}
                  dot={false}
                />
                <Line 
                  type="monotone" 
                  dataKey="availability" 
                  stroke="#4FFFBC" 
                  strokeWidth={2}
                  dot={false}
                  strokeDasharray="5 5"
                />
                <Line 
                  type="monotone" 
                  dataKey="performance" 
                  stroke="#FFB86C" 
                  strokeWidth={2}
                  dot={false}
                  strokeDasharray="5 5"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className="flex justify-center gap-6 mt-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-0.5 bg-[#34E7F8]" />
              <span className="text-white/60 text-xs">OEE</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-8 h-0.5 bg-[#4FFFBC] opacity-50" style={{ backgroundImage: 'repeating-linear-gradient(to right, #4FFFBC 0, #4FFFBC 5px, transparent 5px, transparent 10px)' }} />
              <span className="text-white/60 text-xs">Availability</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-8 h-0.5 bg-[#FFB86C] opacity-50" style={{ backgroundImage: 'repeating-linear-gradient(to right, #FFB86C 0, #FFB86C 5px, transparent 5px, transparent 10px)' }} />
              <span className="text-white/60 text-xs">Performance</span>
            </div>
          </div>
        </div>

        {/* Downtime Analysis */}
        <div className="rounded-2xl bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-xl border border-white/20 shadow-2xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <Clock className="w-5 h-5 text-[#FFB86C]" />
            <h3 className="text-white">Downtime Analysis (Today)</h3>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={downtimeData} layout="vertical">
                <XAxis 
                  type="number" 
                  stroke="#ffffff40" 
                  tick={{ fill: '#ffffff80' }}
                />
                <YAxis 
                  type="category" 
                  dataKey="reason" 
                  stroke="#ffffff40" 
                  tick={{ fill: '#ffffff80' }}
                  width={80}
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: '#0E2F4F', 
                    border: '1px solid rgba(255,255,255,0.2)',
                    borderRadius: '12px'
                  }}
                />
                <Bar dataKey="duration" radius={[0, 8, 8, 0]}>
                  {downtimeData.map((entry, index) => (
                    <Bar key={index} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-4 text-center">
            <span className="text-white/60 text-xs">Total Downtime: </span>
            <span className="text-xl text-[#FF4C4C]">183 min</span>
          </div>
        </div>
      </div>

      {/* Area Performance Comparison */}
      <div className="rounded-2xl bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-xl border border-white/20 shadow-2xl p-5">
        <h3 className="text-white mb-4">Performance by Area</h3>
        <div className="grid grid-cols-3 gap-4">
          {areaPerformance.map((area, index) => (
            <div 
              key={index}
              className="p-4 rounded-xl bg-white/5 border border-white/10"
            >
              <div className="text-white text-lg mb-4">{area.area}</div>
              <div className="space-y-3">
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-white/60 text-xs">OEE</span>
                    <span className="text-[#34E7F8]">{area.oee}%</span>
                  </div>
                  <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-gradient-to-r from-[#34E7F8] to-[#4FFFBC] rounded-full"
                      style={{ width: `${area.oee}%` }}
                    />
                  </div>
                </div>
                
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-white/60 text-xs">Availability</span>
                    <span className="text-[#4FFFBC]">{area.availability}%</span>
                  </div>
                  <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-[#4FFFBC] rounded-full"
                      style={{ width: `${area.availability}%` }}
                    />
                  </div>
                </div>
                
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-white/60 text-xs">Performance</span>
                    <span className="text-[#FFB86C]">{area.performance}%</span>
                  </div>
                  <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-[#FFB86C] rounded-full"
                      style={{ width: `${area.performance}%` }}
                    />
                  </div>
                </div>
                
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-white/60 text-xs">Quality</span>
                    <span className="text-[#9580FF]">{area.quality}%</span>
                  </div>
                  <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-[#9580FF] rounded-full"
                      style={{ width: `${area.quality}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

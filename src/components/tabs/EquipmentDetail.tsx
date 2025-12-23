import { ArrowLeft, User, Package, Activity, Target, TrendingUp, Gauge, Zap, Thermometer, Circle, Flame, Battery, History, Clock, CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, Tooltip, Area, AreaChart, Legend, ComposedChart, Bar, BarChart, ReferenceLine } from 'recharts';
import { useMachineDetail } from '../../hooks/useProductionData';
import { useMachineDetailTrends } from '../../hooks/useMachineDetailTrends';

interface EquipmentDetailProps {
  machineId: string;
  onBack: () => void;
}

export function EquipmentDetail({ machineId, onBack }: EquipmentDetailProps) {
  const { machine, loading } = useMachineDetail(machineId);
  const realTimeTrends = useMachineDetailTrends(machine);

  if (loading || !machine) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-white/60">Loading machine details...</div>
      </div>
    );
  }

  // Extract data from machine
  const machineInfo = {
    id: machine.id,
    name: machine.name,
    status: machine.status,
    operator: machine.operatorName || 'N/A',
    currentOrder: machine.productionOrderId || 'N/A',
    productName: machine.productionOrder?.productName || 'N/A',
    customer: machine.productionOrder?.customer || 'N/A'
  };

  // Production metrics
  const productionData = {
    currentLength: machine.producedLength,
    targetLength: machine.targetLength || 0,
    speed: machine.lineSpeed,
    targetSpeed: machine.targetSpeed || 0,
    runtime: machine.productionOrder?.startTime 
      ? (Date.now() - new Date(machine.productionOrder.startTime).getTime()) / 3600000 
      : 0,
    estimatedCompletion: machine.productionOrder?.endTime 
      ? new Date(machine.productionOrder.endTime).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
      : 'N/A'
  };

  // OEE metrics
  const oeeMetrics = {
    availability: machine.availability || 0,
    performance: machine.performance || 0,
    quality: machine.quality || 0,
    oee: machine.oee || 0
  };

  // Use real-time trends (merged with backend data)
  const tempData = realTimeTrends.temperature.length > 0 
    ? realTimeTrends.temperature 
    : (machine.temperatureTrend || []);

  const speedData = realTimeTrends.speed.length > 0 
    ? realTimeTrends.speed 
    : (machine.speedTrend || []);

  const currentData = realTimeTrends.current.length > 0 
    ? realTimeTrends.current 
    : (machine.currentTrend || []);

  const getOEEColor = (value: number) => {
    if (value >= 85) return '#22C55E';
    if (value >= 75) return '#F59E0B';
    return '#EF4444';
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'running': return '#22C55E';
      case 'idle': return '#64748B';
      case 'warning': return '#F59E0B';
      case 'error': return '#EF4444';
      case 'stopped': return '#34E7F8';
      case 'setup': return '#FFB86C';
      default: return '#64748B';
    }
  };

  const statusColor = getStatusColor(machine.status);
  const progressPercentage = productionData.targetLength > 0 
    ? (productionData.currentLength / productionData.targetLength) * 100 
    : 0;
  const speedPercentage = productionData.targetSpeed > 0 
    ? (productionData.speed / productionData.targetSpeed) * 100 
    : 0;

  // Multi-zone temperature data (use real-time trends)
  const multiZoneTempData = realTimeTrends.multiZoneTemp.length > 0 
    ? realTimeTrends.multiZoneTemp 
    : (machine.multiZoneTemperatureTrend || []);

  // Power consumption data (use real-time trends)
  const powerData = realTimeTrends.power.length > 0 
    ? realTimeTrends.power 
    : (machine.powerTrend || []);

  // Energy consumption data (use real-time trends or backend data)
  const energyData = realTimeTrends.energy.length > 0 
    ? realTimeTrends.energy 
    : (machine.energyConsumption || []);

  // Production order history
  const orderHistory = machine.orderHistory || [];

  const getOrderStatusColor = (status: string) => {
    switch (status) {
      case 'running': return '#22C55E';
      case 'completed': return '#4FFFBC';
      case 'interrupted': return '#F59E0B';
      default: return '#64748B';
    }
  };

  const getOrderStatusIcon = (status: string) => {
    switch (status) {
      case 'running': return Activity;
      case 'completed': return CheckCircle;
      case 'interrupted': return AlertCircle;
      default: return Circle;
    }
  };

  return (
    <div>
      {/* Header with Back Button */}
      <div className="mb-4 rounded-xl bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-xl border border-white/20 shadow-2xl p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={onBack}
              className="p-3 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 transition-all group"
            >
              <ArrowLeft className="w-6 h-6 text-white group-hover:text-[#34E7F8]" strokeWidth={2.5} />
            </button>
            <div>
              <div className="flex items-center gap-3 mb-2">
                <h1 className="text-3xl text-white tracking-tight">{machineInfo.name}</h1>
                <div 
                  className="px-3 py-1.5 rounded-lg tracking-wider border text-sm"
                  style={{
                    backgroundColor: `${statusColor}20`,
                    borderColor: `${statusColor}40`,
                    color: statusColor
                  }}
                >
                  RUNNING
                </div>
              </div>
              <div className="text-white/60 text-base">
                {machine.productionOrderId && (machine.productionOrderProductName || machine.productionOrder?.productName)
                  ? `${machine.productionOrderId} • ${machine.productionOrderProductName || machine.productionOrder?.productName}`
                  : machine.productionOrderId || 'No active order'}
              </div>
            </div>
          </div>
          <div className="text-right">
            <div className="text-white/60 text-xs mb-1">OPERATOR</div>
            <div className="flex items-center gap-2 justify-end">
              <User className="w-4 h-4 text-[#34E7F8]" />
              <span className="text-lg text-white">{machineInfo.operator}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Production Order Info */}
      <div className="mb-4 rounded-xl bg-gradient-to-br from-[#34E7F8]/20 to-[#34E7F8]/5 backdrop-blur-xl border border-[#34E7F8]/30 shadow-2xl p-4">
        <div className="flex items-center gap-2 mb-3">
          <Package className="w-5 h-5 text-[#34E7F8]" strokeWidth={2.5} />
          <h2 className="text-xl text-white">Current Production Order</h2>
        </div>
        <div className="grid grid-cols-4 gap-4">
          <div>
            <div className="text-white/60 text-xs mb-1.5">ORDER ID</div>
            <div className="text-xl text-white tracking-tight">{machineInfo.currentOrder}</div>
          </div>
          <div>
            <div className="text-white/60 text-xs mb-1.5">PRODUCT</div>
            <div className="text-xl text-white tracking-tight">{machineInfo.productName}</div>
          </div>
          <div>
            <div className="text-white/60 text-xs mb-1.5">CUSTOMER</div>
            <div className="text-xl text-white tracking-tight">{machineInfo.customer}</div>
          </div>
          <div>
            <div className="text-white/60 text-xs mb-1.5">EST. COMPLETION</div>
            <div className="text-xl text-[#4FFFBC] tracking-tight">{productionData.estimatedCompletion}</div>
          </div>
        </div>
      </div>

      {/* Production Metrics */}
      <div className="mb-4 grid grid-cols-2 gap-4">
        {/* Production Length */}
        <div className="rounded-xl bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-xl border border-white/20 shadow-2xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <Activity className="w-5 h-5 text-[#34E7F8]" strokeWidth={2.5} />
            <h3 className="text-lg text-white">Production Length</h3>
          </div>
          <div className="flex items-baseline gap-2 mb-3">
            <span className="text-4xl text-[#34E7F8] tracking-tight">{productionData.currentLength.toLocaleString()}</span>
            <span className="text-xl text-white/40">/ {productionData.targetLength.toLocaleString()}</span>
            <span className="text-base text-white/60">meters</span>
          </div>
          <div className="mb-3">
            <div className="flex justify-between items-center mb-1.5">
              <span className="text-white/60 text-sm">Progress</span>
              <span className="text-xl text-white">{progressPercentage.toFixed(1)}%</span>
            </div>
            <div className="h-2 bg-white/10 rounded-full overflow-hidden">
              <div 
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${progressPercentage}%`,
                  backgroundColor: '#34E7F8'
                }}
              />
            </div>
          </div>
          <div className="pt-3 border-t border-white/10 grid grid-cols-2 gap-3">
            <div>
              <div className="text-white/60 text-xs mb-1">RUNTIME</div>
              <div className="text-xl text-white">{productionData.runtime}h</div>
            </div>
            <div>
              <div className="text-white/60 text-xs mb-1">REMAINING</div>
              <div className="text-xl text-[#FFB86C]">{(productionData.targetLength - productionData.currentLength).toLocaleString()}m</div>
            </div>
          </div>
        </div>

        {/* Machine Speed */}
        <div className="rounded-xl bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-xl border border-white/20 shadow-2xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <Gauge className="w-5 h-5 text-[#4FFFBC]" strokeWidth={2.5} />
            <h3 className="text-lg text-white">Machine Speed</h3>
          </div>
          <div className="flex items-baseline gap-2 mb-3">
            <span className="text-4xl text-[#4FFFBC] tracking-tight">{productionData.speed}</span>
            <span className="text-xl text-white/40">/ {productionData.targetSpeed}</span>
            <span className="text-base text-white/60">m/min</span>
          </div>
          <div className="mb-3">
            <div className="flex justify-between items-center mb-1.5">
              <span className="text-white/60 text-sm">Performance</span>
              <span className="text-xl text-white">{speedPercentage.toFixed(1)}%</span>
            </div>
            <div className="h-2 bg-white/10 rounded-full overflow-hidden">
              <div 
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${speedPercentage}%`,
                  backgroundColor: '#4FFFBC'
                }}
              />
            </div>
          </div>
          <div className="pt-3 border-t border-white/10 grid grid-cols-2 gap-3">
            <div>
              <div className="text-white/60 text-xs mb-1">AVG SPEED</div>
              <div className="text-xl text-white">915 m/min</div>
            </div>
            <div>
              <div className="text-white/60 text-xs mb-1">EFFICIENCY</div>
              <div className="text-xl text-[#4FFFBC]">91.5%</div>
            </div>
          </div>
        </div>
      </div>

      {/* OEE Metrics */}
      <div className="mb-4 rounded-xl bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-xl border border-white/20 shadow-2xl p-4">
        <div className="flex items-center gap-2 mb-4">
          <Target className="w-5 h-5 text-[#34E7F8]" strokeWidth={2.5} />
          <h3 className="text-lg text-white">Overall Equipment Effectiveness (OEE)</h3>
        </div>
        <div className="grid grid-cols-4 gap-4">
          {/* OEE */}
          <div className="p-4 rounded-lg bg-gradient-to-br from-white/8 to-white/3 border border-white/10">
            <div className="text-white/60 text-xs mb-2 tracking-wider">OEE</div>
            <div 
              className="text-5xl tracking-tight mb-3"
              style={{ color: getOEEColor(oeeMetrics.oee) }}
            >
              {oeeMetrics.oee}%
            </div>
            <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
              <div 
                className="h-full rounded-full"
                style={{
                  width: `${oeeMetrics.oee}%`,
                  backgroundColor: getOEEColor(oeeMetrics.oee)
                }}
              />
            </div>
          </div>

          {/* Availability */}
          <div className="p-4 rounded-lg bg-gradient-to-br from-white/8 to-white/3 border border-white/10">
            <div className="text-white/60 text-xs mb-2 tracking-wider">AVAILABILITY</div>
            <div className="text-5xl text-[#4FFFBC] tracking-tight mb-3">{oeeMetrics.availability}%</div>
            <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
              <div 
                className="h-full rounded-full bg-[#4FFFBC]"
                style={{ width: `${oeeMetrics.availability}%` }}
              />
            </div>
          </div>

          {/* Performance */}
          <div className="p-4 rounded-lg bg-gradient-to-br from-white/8 to-white/3 border border-white/10">
            <div className="text-white/60 text-xs mb-2 tracking-wider">PERFORMANCE</div>
            <div className="text-5xl text-[#FFB86C] tracking-tight mb-3">{oeeMetrics.performance}%</div>
            <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
              <div 
                className="h-full rounded-full bg-[#FFB86C]"
                style={{ width: `${oeeMetrics.performance}%` }}
              />
            </div>
          </div>

          {/* Quality */}
          <div className="p-4 rounded-lg bg-gradient-to-br from-white/8 to-white/3 border border-white/10">
            <div className="text-white/60 text-xs mb-2 tracking-wider">QUALITY</div>
            <div className="text-5xl text-[#34E7F8] tracking-tight mb-3">{oeeMetrics.quality}%</div>
            <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
              <div 
                className="h-full rounded-full bg-[#34E7F8]"
                style={{ width: `${oeeMetrics.quality}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Real-time Charts */}
      <div className="grid grid-cols-3 gap-4">
        {/* Temperature Trend */}
        <div className="rounded-xl bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-xl border border-white/20 shadow-2xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <Thermometer className="w-4 h-4 text-[#FF6B6B]" strokeWidth={2.5} />
            <h3 className="text-base text-white">Temperature Trend</h3>
          </div>
          <div className="mb-3">
            <div className="text-3xl text-[#FF6B6B] tracking-tight">
              {machine.temperature ? `${Math.round(machine.temperature)}°C` : 'N/A'}
            </div>
            <div className="text-white/60 text-xs">Current</div>
          </div>
          <div className="h-40">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={tempData}>
                <defs>
                  <linearGradient id="tempGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#FF6B6B" stopOpacity={0.4}/>
                    <stop offset="100%" stopColor="#FF6B6B" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <XAxis 
                  dataKey="time" 
                  stroke="#ffffff40" 
                  tick={{ fill: '#ffffff60', fontSize: 11 }}
                />
                <YAxis 
                  stroke="#ffffff40" 
                  tick={{ fill: '#ffffff60', fontSize: 11 }}
                  domain={[60, 75]}
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: '#0E2F4F', 
                    border: '1px solid rgba(255,255,255,0.2)',
                    borderRadius: '8px',
                    fontSize: '12px'
                  }}
                />
                <Area 
                  type="monotone" 
                  dataKey="temp" 
                  stroke="#FF6B6B" 
                  strokeWidth={3}
                  fill="url(#tempGradient)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Speed Trend */}
        <div className="rounded-xl bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-xl border border-white/20 shadow-2xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp className="w-4 h-4 text-[#4FFFBC]" strokeWidth={2.5} />
            <h3 className="text-base text-white">Speed Trend</h3>
          </div>
          <div className="mb-3">
            <div className="text-3xl text-[#4FFFBC] tracking-tight">{machine.lineSpeed}</div>
            <div className="text-white/60 text-xs">m/min</div>
          </div>
          <div className="h-40">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={speedData}>
                <XAxis 
                  dataKey="time" 
                  stroke="#ffffff40" 
                  tick={{ fill: '#ffffff60', fontSize: 11 }}
                />
                <YAxis 
                  stroke="#ffffff40" 
                  tick={{ fill: '#ffffff60', fontSize: 11 }}
                  domain={[850, 1000]}
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: '#0E2F4F', 
                    border: '1px solid rgba(255,255,255,0.2)',
                    borderRadius: '8px',
                    fontSize: '12px'
                  }}
                />
                <Line 
                  type="monotone" 
                  dataKey="target" 
                  stroke="#ffffff40" 
                  strokeWidth={2}
                  strokeDasharray="5 5"
                  dot={false}
                />
                <Line 
                  type="monotone" 
                  dataKey="speed" 
                  stroke="#4FFFBC" 
                  strokeWidth={3}
                  dot={{ fill: '#4FFFBC', r: 4 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Motor Current Trend */}
        <div className="rounded-xl bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-xl border border-white/20 shadow-2xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <Zap className="w-4 h-4 text-[#FFB86C]" strokeWidth={2.5} />
            <h3 className="text-base text-white">Motor Current</h3>
          </div>
          <div className="mb-3">
            <div className="text-3xl text-[#FFB86C] tracking-tight">
              {machine.current ? `${machine.current.toFixed(1)}A` : 'N/A'}
            </div>
            <div className="text-white/60 text-xs">Current</div>
          </div>
          <div className="h-40">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={currentData}>
                <defs>
                  <linearGradient id="currentGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#FFB86C" stopOpacity={0.4}/>
                    <stop offset="100%" stopColor="#FFB86C" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <XAxis 
                  dataKey="time" 
                  stroke="#ffffff40" 
                  tick={{ fill: '#ffffff60', fontSize: 11 }}
                />
                <YAxis 
                  stroke="#ffffff40" 
                  tick={{ fill: '#ffffff60', fontSize: 11 }}
                  domain={[40, 50]}
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: '#0E2F4F', 
                    border: '1px solid rgba(255,255,255,0.2)',
                    borderRadius: '8px',
                    fontSize: 12
                  }}
                />
                <Area 
                  type="monotone" 
                  dataKey="current" 
                  stroke="#FFB86C" 
                  strokeWidth={3}
                  fill="url(#currentGradient)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Advanced Analytics Section */}
      
      {/* Multi-zone Temperature Monitoring */}
      <div className="mt-4 rounded-xl bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-xl border border-white/20 shadow-2xl p-4">
        <div className="flex items-center gap-2 mb-4">
          <Flame className="w-5 h-5 text-[#FF6B6B]" strokeWidth={2.5} />
          <h2 className="text-xl text-white">Multi-Zone Temperature Monitoring</h2>
        </div>
        
        {/* Current Zone Temperatures */}
        <div className="grid grid-cols-4 gap-3 mb-4">
          <div className="p-3 rounded-lg bg-white/5 border border-white/10">
            <div className="flex items-center gap-1.5 mb-1.5">
              <div className="w-2.5 h-2.5 rounded-full bg-[#FF6B6B]" />
              <div className="text-white/60 text-xs">ZONE 1</div>
            </div>
            <div className="text-2xl text-[#FF6B6B] tracking-tight">
              {machine.multiZoneTemperatures?.zone1 ? `${Math.round(machine.multiZoneTemperatures.zone1)}°C` : 'N/A'}
            </div>
          </div>
          <div className="p-3 rounded-lg bg-white/5 border border-white/10">
            <div className="flex items-center gap-1.5 mb-1.5">
              <div className="w-2.5 h-2.5 rounded-full bg-[#FFB86C]" />
              <div className="text-white/60 text-xs">ZONE 2</div>
            </div>
            <div className="text-2xl text-[#FFB86C] tracking-tight">
              {machine.multiZoneTemperatures?.zone2 ? `${Math.round(machine.multiZoneTemperatures.zone2)}°C` : 'N/A'}
            </div>
          </div>
          <div className="p-3 rounded-lg bg-white/5 border border-white/10">
            <div className="flex items-center gap-1.5 mb-1.5">
              <div className="w-2.5 h-2.5 rounded-full bg-[#F59E0B]" />
              <div className="text-white/60 text-xs">ZONE 3</div>
            </div>
            <div className="text-2xl text-[#F59E0B] tracking-tight">
              {machine.multiZoneTemperatures?.zone3 ? `${Math.round(machine.multiZoneTemperatures.zone3)}°C` : 'N/A'}
            </div>
          </div>
          <div className="p-3 rounded-lg bg-white/5 border border-white/10">
            <div className="flex items-center gap-1.5 mb-1.5">
              <div className="w-2.5 h-2.5 rounded-full bg-[#34E7F8]" />
              <div className="text-white/60 text-xs">ZONE 4</div>
            </div>
            <div className="text-2xl text-[#34E7F8] tracking-tight">
              {machine.multiZoneTemperatures?.zone4 ? `${Math.round(machine.multiZoneTemperatures.zone4)}°C` : 'N/A'}
            </div>
          </div>
        </div>

        {/* Multi-zone Chart */}
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={multiZoneTempData}>
              <defs>
                <linearGradient id="zone1Gradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#FF6B6B" stopOpacity={0.3}/>
                  <stop offset="100%" stopColor="#FF6B6B" stopOpacity={0}/>
                </linearGradient>
                <linearGradient id="zone2Gradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#FFB86C" stopOpacity={0.3}/>
                  <stop offset="100%" stopColor="#FFB86C" stopOpacity={0}/>
                </linearGradient>
                <linearGradient id="zone3Gradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#F59E0B" stopOpacity={0.3}/>
                  <stop offset="100%" stopColor="#F59E0B" stopOpacity={0}/>
                </linearGradient>
                <linearGradient id="zone4Gradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#34E7F8" stopOpacity={0.3}/>
                  <stop offset="100%" stopColor="#34E7F8" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <XAxis 
                dataKey="time" 
                stroke="#ffffff40" 
                tick={{ fill: '#ffffff80', fontSize: 12 }}
              />
              <YAxis 
                stroke="#ffffff40" 
                tick={{ fill: '#ffffff80', fontSize: 12 }}
                domain={[140, 175]}
                label={{ value: 'Temperature (°C)', angle: -90, position: 'insideLeft', fill: '#ffffff60' }}
              />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: '#0E2F4F', 
                  border: '1px solid rgba(255,255,255,0.2)',
                  borderRadius: '8px',
                  padding: '10px'
                }}
              />
              <Legend 
                wrapperStyle={{ paddingTop: '20px' }}
                iconType="line"
              />
              <Line 
                type="monotone" 
                dataKey="zone1" 
                stroke="#FF6B6B" 
                strokeWidth={3}
                name="Zone 1"
                dot={{ fill: '#FF6B6B', r: 4 }}
              />
              <Line 
                type="monotone" 
                dataKey="zone2" 
                stroke="#FFB86C" 
                strokeWidth={3}
                name="Zone 2"
                dot={{ fill: '#FFB86C', r: 4 }}
              />
              <Line 
                type="monotone" 
                dataKey="zone3" 
                stroke="#F59E0B" 
                strokeWidth={3}
                name="Zone 3"
                dot={{ fill: '#F59E0B', r: 4 }}
              />
              <Line 
                type="monotone" 
                dataKey="zone4" 
                stroke="#34E7F8" 
                strokeWidth={3}
                name="Zone 4"
                dot={{ fill: '#34E7F8', r: 4 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Power and Energy Analytics */}
      <div className="mt-4 grid grid-cols-2 gap-4">
        {/* Real-time Power Consumption */}
        <div className="rounded-xl bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-xl border border-white/20 shadow-2xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <Zap className="w-5 h-5 text-[#FFB86C]" strokeWidth={2.5} />
            <h3 className="text-lg text-white">Real-time Power Consumption</h3>
          </div>
          
          <div className="mb-4">
            <div className="flex items-baseline gap-2 mb-1.5">
              <span className="text-4xl text-[#FFB86C] tracking-tight">
                {machine.power ? machine.power.toFixed(1) : 'N/A'}
              </span>
              <span className="text-xl text-white/60">kW</span>
            </div>
            <div className="flex items-center gap-3 text-xs">
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-1 rounded-full bg-[#22C55E]" />
                <span className="text-white/60">Normal Range: 60-75 kW</span>
              </div>
            </div>
          </div>

          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={powerData}>
                <defs>
                  <linearGradient id="powerGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#FFB86C" stopOpacity={0.4}/>
                    <stop offset="100%" stopColor="#FFB86C" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <XAxis 
                  dataKey="time" 
                  stroke="#ffffff40" 
                  tick={{ fill: '#ffffff60', fontSize: 11 }}
                />
                <YAxis 
                  stroke="#ffffff40" 
                  tick={{ fill: '#ffffff60', fontSize: 11 }}
                  domain={[55, 80]}
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: '#0E2F4F', 
                    border: '1px solid rgba(255,255,255,0.2)',
                    borderRadius: '8px'
                  }}
                />
                {/* Normal range area */}
                <Area 
                  type="monotone" 
                  dataKey="maxRange"
                  stroke="none"
                  fill="rgba(34, 197, 94, 0.1)"
                  stackId="range"
                />
                {/* Reference lines */}
                <ReferenceLine 
                  y={68} 
                  stroke="#ffffff40" 
                  strokeDasharray="5 5"
                  label={{ value: 'Avg', fill: '#ffffff60', fontSize: 11 }}
                />
                {/* Actual power line */}
                <Line 
                  type="monotone" 
                  dataKey="power" 
                  stroke="#FFB86C" 
                  strokeWidth={3}
                  dot={{ fill: '#FFB86C', r: 4 }}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Energy Consumption (24h) */}
        <div className="rounded-xl bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-xl border border-white/20 shadow-2xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <Battery className="w-5 h-5 text-[#4FFFBC]" strokeWidth={2.5} />
            <h3 className="text-lg text-white">Energy Consumption (24h)</h3>
          </div>
          
          <div className="mb-4">
            <div className="flex items-baseline gap-2 mb-1.5">
              <span className="text-4xl text-[#4FFFBC] tracking-tight">
                {energyData.reduce((sum, d) => sum + d.energy, 0).toFixed(0)}
              </span>
              <span className="text-xl text-white/60">kWh</span>
            </div>
            <div className="text-white/60 text-xs">Last 24 hours total</div>
          </div>

          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={energyData}>
                <defs>
                  <linearGradient id="energyGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#4FFFBC" stopOpacity={1}/>
                    <stop offset="100%" stopColor="#4FFFBC" stopOpacity={0.3}/>
                  </linearGradient>
                </defs>
                <XAxis 
                  dataKey="hour" 
                  stroke="#ffffff40" 
                  tick={{ fill: '#ffffff60', fontSize: 11 }}
                />
                <YAxis 
                  stroke="#ffffff40" 
                  tick={{ fill: '#ffffff60', fontSize: 11 }}
                  label={{ value: 'kWh', angle: -90, position: 'insideLeft', fill: '#ffffff60' }}
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: '#0E2F4F', 
                    border: '1px solid rgba(255,255,255,0.2)',
                    borderRadius: '8px'
                  }}
                />
                <Bar 
                  dataKey="energy" 
                  fill="url(#energyGradient)"
                  radius={[6, 6, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Production Order History (24h) */}
      <div className="mt-4 rounded-xl bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-xl border border-white/20 shadow-2xl p-4">
        <div className="flex items-center gap-2 mb-4">
          <History className="w-5 h-5 text-[#34E7F8]" strokeWidth={2.5} />
          <h2 className="text-xl text-white">Production Order History - Last 24 Hours</h2>
        </div>

        <div className="space-y-2">
          {orderHistory.map((order, index) => {
            const StatusIcon = getOrderStatusIcon(order.status);
            const statusColor = getOrderStatusColor(order.status);
            const completionPercentage = (order.producedLength / order.targetLength) * 100;
            
            return (
              <div 
                key={index}
                className="p-4 rounded-lg bg-gradient-to-br from-white/8 to-white/3 border border-white/10 hover:border-white/20 transition-all"
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div 
                      className="p-2 rounded-lg border"
                      style={{
                        backgroundColor: `${statusColor}15`,
                        borderColor: `${statusColor}30`
                      }}
                    >
                      <StatusIcon className="w-5 h-5" style={{ color: statusColor }} strokeWidth={2.5} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xl text-white tracking-tight">{order.id}</span>
                        <div 
                          className="px-2 py-0.5 rounded-md text-xs tracking-wider uppercase border"
                          style={{
                            backgroundColor: `${statusColor}20`,
                            borderColor: `${statusColor}40`,
                            color: statusColor
                          }}
                        >
                          {order.status}
                        </div>
                      </div>
                      <div className="text-white/60 text-sm">{order.productName} • {order.customer}</div>
                    </div>
                  </div>
                  <div className="text-right">
                      <div className="text-white/60 text-xs mb-1">DURATION</div>
                    <div className="text-lg text-white">
                      {order.duration || (order.endTime 
                        ? `${Math.round((new Date(order.endTime).getTime() - new Date(order.startTime).getTime()) / 3600000)}h ${Math.round(((new Date(order.endTime).getTime() - new Date(order.startTime).getTime()) % 3600000) / 60000)}m`
                        : `${Math.round((Date.now() - new Date(order.startTime).getTime()) / 3600000)}h ${Math.round(((Date.now() - new Date(order.startTime).getTime()) % 3600000) / 60000)}m`)}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-4 gap-4 mb-3">
                    <div>
                      <div className="flex items-center gap-1.5 mb-1">
                        <Clock className="w-3.5 h-3.5 text-[#34E7F8]" />
                        <span className="text-white/60 text-xs">START TIME</span>
                      </div>
                      <div className="text-base text-white">
                        {new Date(order.startTime).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5 mb-1">
                        <Clock className="w-3.5 h-3.5 text-[#FFB86C]" />
                        <span className="text-white/60 text-xs">END TIME</span>
                      </div>
                      <div className="text-base text-white">
                        {order.endTime 
                          ? new Date(order.endTime).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
                          : '-'}
                      </div>
                    </div>
                  <div>
                    <div className="flex items-center gap-1.5 mb-1">
                      <Activity className="w-3.5 h-3.5 text-[#4FFFBC]" />
                      <span className="text-white/60 text-xs">PRODUCED</span>
                    </div>
                    <div className="text-base text-[#4FFFBC]">{order.producedLength.toLocaleString()} m</div>
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5 mb-1">
                      <Target className="w-3.5 h-3.5 text-white/60" />
                      <span className="text-white/60 text-xs">TARGET</span>
                    </div>
                    <div className="text-base text-white">{order.targetLength.toLocaleString()} m</div>
                  </div>
                </div>

                {/* Progress bar */}
                <div>
                  <div className="flex justify-between items-center mb-1.5">
                    <span className="text-white/60 text-xs">Completion</span>
                    <span className="text-white text-sm">{completionPercentage.toFixed(1)}%</span>
                  </div>
                  <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                    <div 
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${Math.min(completionPercentage, 100)}%`,
                        backgroundColor: statusColor
                      }}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
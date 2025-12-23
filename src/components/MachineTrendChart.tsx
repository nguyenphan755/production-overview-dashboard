// Mini trend chart component for machine cards
import { LineChart, Line, ResponsiveContainer, Area, AreaChart } from 'recharts';

interface MachineTrendChartProps {
  data: number[];
  color: string;
  height?: number;
  showArea?: boolean;
}

export function MachineTrendChart({ data, color, height = 40, showArea = false }: MachineTrendChartProps) {
  if (!data || data.length === 0) {
    return (
      <div style={{ height: `${height}px` }} className="flex items-center justify-center text-white/20 text-xs">
        No data
      </div>
    );
  }

  // If only one data point, duplicate it for visualization
  const chartData = data.length === 1 
    ? [data[0], data[0]] 
    : data;

  // Normalize data to 0-100 range for consistent display
  const min = Math.min(...chartData);
  const max = Math.max(...chartData);
  const range = max - min || 1;
  const normalizedData = chartData.map((value, index) => ({
    index,
    value: ((value - min) / range) * 100,
    original: value,
  }));

  const ChartComponent = showArea ? AreaChart : LineChart;

  return (
    <div style={{ height: `${height}px`, width: '100%' }}>
      <ResponsiveContainer width="100%" height="100%">
        <ChartComponent data={normalizedData} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
          {showArea ? (
            <>
              <defs>
                <linearGradient id={`gradient-${color.replace('#', '')}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={color} stopOpacity={0.4} />
                  <stop offset="100%" stopColor={color} stopOpacity={0} />
                </linearGradient>
              </defs>
              <Area
                type="monotone"
                dataKey="value"
                stroke={color}
                strokeWidth={2}
                fill={`url(#gradient-${color.replace('#', '')})`}
                dot={false}
                isAnimationActive={true}
                animationDuration={300}
              />
            </>
          ) : (
            <Line
              type="monotone"
              dataKey="value"
              stroke={color}
              strokeWidth={2}
              dot={false}
              isAnimationActive={true}
              animationDuration={300}
            />
          )}
        </ChartComponent>
      </ResponsiveContainer>
    </div>
  );
}


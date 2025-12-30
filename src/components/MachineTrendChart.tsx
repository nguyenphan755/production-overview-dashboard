// Mini trend chart component for machine cards
import { memo, useMemo } from 'react';
import { LineChart, Line, ResponsiveContainer, Area, AreaChart } from 'recharts';

interface MachineTrendChartProps {
  data: number[];
  color: string;
  height?: number;
  showArea?: boolean;
}

function MachineTrendChartComponent({ data, color, height = 40, showArea = false }: MachineTrendChartProps) {
  // Memoize normalized data to prevent unnecessary recalculations
  const normalizedData = useMemo(() => {
    if (!data || data.length === 0) {
      return [];
    }

    // If only one data point, duplicate it for visualization
    const chartData = data.length === 1 
      ? [data[0], data[0]] 
      : data;

    // Normalize data to 0-100 range for consistent display
    const min = Math.min(...chartData);
    const max = Math.max(...chartData);
    const range = max - min || 1;
    
    return chartData.map((value, index) => ({
      index,
      value: ((value - min) / range) * 100,
      original: value,
    }));
  }, [data]);

  // Memoize gradient ID to prevent re-creation
  const gradientId = useMemo(() => `gradient-${color.replace('#', '')}`, [color]);

  if (!data || data.length === 0) {
    return (
      <div style={{ height: `${height}px` }} className="flex items-center justify-center text-white/20 text-xs">
        No data
      </div>
    );
  }

  const ChartComponent = showArea ? AreaChart : LineChart;

  return (
    <div style={{ height: `${height}px`, width: '100%' }}>
      <ResponsiveContainer width="100%" height="100%">
        <ChartComponent 
          data={normalizedData} 
          margin={{ top: 0, right: 0, bottom: 0, left: 0 }}
          // Disable animations to prevent flickering on updates
          isAnimationActive={false}
        >
          {showArea ? (
            <>
              <defs>
                <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={color} stopOpacity={0.4} />
                  <stop offset="100%" stopColor={color} stopOpacity={0} />
                </linearGradient>
              </defs>
              <Area
                type="monotone"
                dataKey="value"
                stroke={color}
                strokeWidth={2}
                fill={`url(#${gradientId})`}
                dot={false}
                isAnimationActive={false}
              />
            </>
          ) : (
            <Line
              type="monotone"
              dataKey="value"
              stroke={color}
              strokeWidth={2}
              dot={false}
              isAnimationActive={false}
            />
          )}
        </ChartComponent>
      </ResponsiveContainer>
    </div>
  );
}

// Memoize component to prevent re-renders when props haven't changed
export const MachineTrendChart = memo(MachineTrendChartComponent, (prevProps, nextProps) => {
  // Only re-render if data array reference or length changed
  // This allows incremental updates without full re-render
  if (prevProps.data.length !== nextProps.data.length) {
    return false; // Re-render if length changed
  }
  
  // Check if last value changed (incremental update)
  if (prevProps.data.length > 0 && nextProps.data.length > 0) {
    const prevLast = prevProps.data[prevProps.data.length - 1];
    const nextLast = nextProps.data[nextProps.data.length - 1];
    if (Math.abs(prevLast - nextLast) > 0.01) {
      return false; // Re-render if last value changed significantly
    }
  }
  
  // Check other props
  if (prevProps.color !== nextProps.color || 
      prevProps.height !== nextProps.height || 
      prevProps.showArea !== nextProps.showArea) {
    return false;
  }
  
  return true; // Don't re-render
});


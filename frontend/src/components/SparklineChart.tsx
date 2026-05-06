import { memo, useMemo } from 'react';
import { LineChart, Line, ResponsiveContainer } from 'recharts';

interface SparklineChartProps {
  data: number[];
}

function SparklineChartComponent({ data }: SparklineChartProps) {
  // Memoize chart data to prevent unnecessary recalculations
  const chartData = useMemo(() => {
    return data.map((value, index) => ({ value, index }));
  }, [data]);

  return (
    <div className="h-10 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart 
          data={chartData}
          // Disable animations to prevent flickering on updates
          isAnimationActive={false}
        >
          <Line
            type="monotone"
            dataKey="value"
            stroke="#34E7F8"
            strokeWidth={1.5}
            dot={false}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

// Memoize component to prevent re-renders when props haven't changed
export const SparklineChart = memo(SparklineChartComponent, (prevProps, nextProps) => {
  // Only re-render if data array reference or length changed
  if (prevProps.data.length !== nextProps.data.length) {
    return false;
  }
  
  // Check if last value changed (incremental update)
  if (prevProps.data.length > 0 && nextProps.data.length > 0) {
    const prevLast = prevProps.data[prevProps.data.length - 1];
    const nextLast = nextProps.data[nextProps.data.length - 1];
    if (Math.abs(prevLast - nextLast) > 0.01) {
      return false;
    }
  }
  
  return true; // Don't re-render
});
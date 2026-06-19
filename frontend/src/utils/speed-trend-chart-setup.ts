/**
 * Chart.js registration for speed trend (mirrors sh04-speed-compare.html).
 * Import once before rendering EquipmentSpeedTrendChart.
 */
import {
  Chart as ChartJS,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';
import annotationPlugin from 'chartjs-plugin-annotation';

let registered = false;

export function ensureSpeedTrendChartRegistered(): void {
  if (registered) return;
  ChartJS.register(
    LinearScale,
    PointElement,
    LineElement,
    Title,
    Tooltip,
    Legend,
    Filler,
    annotationPlugin
  );
  registered = true;
}

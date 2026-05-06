// Utility functions for handling speed units (m/s for drawing machines, m/min for others)
import type { ProductionArea } from '../types';

/**
 * Check if a machine is in the Drawing area (uses m/s instead of m/min)
 */
export function isDrawingMachine(area: ProductionArea): boolean {
  return area === 'drawing';
}

/**
 * Get the speed unit for a machine based on its area
 */
export function getSpeedUnit(area: ProductionArea): 'm/s' | 'm/min' {
  return isDrawingMachine(area) ? 'm/s' : 'm/min';
}

/**
 * Format speed for display with appropriate unit
 */
export function formatSpeed(speed: number, area: ProductionArea, decimals: number = 2): string {
  const unit = getSpeedUnit(area);
  return `${speed.toFixed(decimals)} ${unit}`;
}

/**
 * Convert speed to m/s for calculations
 * Drawing machines: already in m/s
 * Other machines: convert from m/min to m/s
 */
export function speedToMps(speed: number, area: ProductionArea): number {
  return isDrawingMachine(area) ? speed : speed / 60;
}

/**
 * Convert speed from m/s to display units
 * Drawing machines: keep as m/s
 * Other machines: convert to m/min
 */
export function speedFromMps(speedMps: number, area: ProductionArea): number {
  return isDrawingMachine(area) ? speedMps : speedMps * 60;
}


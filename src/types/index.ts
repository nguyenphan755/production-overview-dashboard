// Core data types for Production Overview Dashboard

export type MachineStatus = 'running' | 'idle' | 'warning' | 'error' | 'stopped' | 'setup';

export type ProductionArea = 'drawing' | 'stranding' | 'armoring' | 'sheathing';

export interface Machine {
  id: string;
  name: string;
  area: ProductionArea;
  status: MachineStatus;
  lineSpeed: number; // m/min
  targetSpeed: number; // m/min
  producedLength: number; // meters
  targetLength?: number; // meters
  productionOrderId?: string;
  productionOrderName?: string;
  productionOrderProductName?: string; // Product name from production order
  operatorName?: string;
  oee?: number; // Overall Equipment Effectiveness (0-100)
  availability?: number; // A in OEE (0-100)
  performance?: number; // P in OEE (0-100)
  quality?: number; // Q in OEE (0-100)
  current?: number; // Amperes
  power?: number; // kW
  temperature?: number; // Celsius
  multiZoneTemperatures?: {
    zone1?: number;
    zone2?: number;
    zone3?: number;
    zone4?: number;
  };
  alarms?: Alarm[];
  lastUpdated: string; // ISO timestamp
}

export interface Alarm {
  id: string;
  machineId: string;
  severity: 'info' | 'warning' | 'error' | 'critical';
  message: string;
  timestamp: string; // ISO timestamp
  acknowledged?: boolean;
}

export interface ProductionAreaSummary {
  id: ProductionArea;
  name: string; // Vietnamese name
  nameEn: string; // English name
  running: number; // Count of running machines
  total: number; // Total machines in area
  output: number; // Total output in meters
  speedAvg: number; // Average speed in m/min
  alarms: number; // Count of active alarms
  topMachines: Array<{
    id: string;
    name: string;
    speed: number;
    status: MachineStatus;
  }>;
  allMachines?: Array<{
    id: string;
    name: string;
    speed: number;
    status: MachineStatus;
  }>; // All machines in the area
  sparklineData: number[]; // Speed trend data (last 10 minutes)
}

export interface GlobalKPI {
  running: number; // Count of running machines
  total: number; // Total machines
  output: number; // Total output in meters
  orders: number; // Active production orders
  alarms: number; // Active alarms
  energy: number; // Energy consumption in MW
}

export interface ProductionOrder {
  id: string;
  name: string;
  productName: string;
  customer: string;
  machineId: string;
  startTime: string; // ISO timestamp
  endTime?: string; // ISO timestamp (null if still running)
  producedLength: number; // meters
  targetLength: number; // meters
  status: 'running' | 'completed' | 'interrupted' | 'cancelled';
  duration?: string; // Human-readable duration
}

export interface MachineDetail extends Machine {
  productionOrder?: ProductionOrder;
  speedTrend?: Array<{
    time: string; // ISO timestamp or time string
    speed: number;
    target: number;
  }>;
  temperatureTrend?: Array<{
    time: string;
    temp: number;
  }>;
  currentTrend?: Array<{
    time: string;
    current: number;
  }>;
  multiZoneTemperatureTrend?: Array<{
    time: string;
    zone1?: number;
    zone2?: number;
    zone3?: number;
    zone4?: number;
  }>;
  powerTrend?: Array<{
    time: string;
    power: number;
    avgPower: number;
    minRange: number;
    maxRange: number;
  }>;
  energyConsumption?: Array<{
    hour: string;
    energy: number; // kWh
  }>;
  orderHistory?: ProductionOrder[];
}

export interface TimeSeriesDataPoint {
  timestamp: string; // ISO timestamp
  value: number;
}

export interface APIResponse<T> {
  data: T;
  timestamp: string;
  success: boolean;
  message?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  timestamp: string;
}


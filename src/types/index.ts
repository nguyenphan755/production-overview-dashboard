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
  producedLength: number; // meters (total / PLC raw; prefer producedLengthOk for UI)
  /** Mét đạt / OK — dùng cho hiển thị chiều dài sản xuất khi có */
  producedLengthOk?: number;
  /** Mét NG — optional */
  producedLengthNg?: number;
  targetLength?: number; // meters
  productionOrderId?: string;
  productionOrderName?: string;
  productionOrderProductName?: string; // Product name from production order
  productName?: string; // Current product name for the machine
  materialCode?: string;
  operatorName?: string;
  oee?: number; // Overall Equipment Effectiveness (0-100)
  availability?: number; // A in OEE (0-100)
  availabilityIsPreliminary?: boolean; // True when showing prior shift value during active shift
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
    zone5?: number;
    zone6?: number;
    zone7?: number;
    zone8?: number;
    zone9?: number;
    zone10?: number;
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

/** One completed bobbin when the OK-length counter reset to ~0 and restarted */
export interface OrderBobbinRecord {
  id: string;
  orderId: string;
  sequence: number;
  /** Mét OK trên bobbin đó trước khi bộ đếm OK về ≤ ngưỡng (producedLengthOk) */
  cutLengthM: number;
  recordedAt: string;
  /** Planned bobbin count for the order (snapshot when the cut was recorded) */
  bobbinCountPlanned?: number;
}

export interface ProductionOrder {
  id: string;
  name: string;
  productName: string;
  productNameCurrent?: string;
  customer: string;
  machineName?: string;
  machineId: string;
  startTime: string; // ISO timestamp
  endTime?: string; // ISO timestamp (null if still running)
  producedLength: number; // meters (total)
  /** Mét OK cho đơn — ưu tiên khi hiển thị tiến độ / sản lượng */
  producedLengthOk?: number;
  targetLength: number; // meters
  status: 'running' | 'completed' | 'interrupted' | 'cancelled';
  duration?: string; // Human-readable duration
  /** Planned number of bobbins for this order (from ERP / planning) */
  bobbinCountPlanned?: number;
  /** Bobbin cuts supplied by backend (historical) */
  bobbinCuts?: OrderBobbinRecord[];
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
    zone5?: number;
    zone6?: number;
    zone7?: number;
    zone8?: number;
    zone9?: number;
    zone10?: number;
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


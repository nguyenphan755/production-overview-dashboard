// Mock API service - provides realistic sample data for development
// This can be easily replaced with real Node-RED API calls

import type {
  Machine,
  MachineDetail,
  ProductionAreaSummary,
  GlobalKPI,
  ProductionOrder,
  APIResponse,
  ProductionArea,
  MachineStatus,
} from '../types';

// Mock data storage
let mockMachines: Machine[] = [];
let mockOrders: ProductionOrder[] = [];
let mockGlobalKPI: GlobalKPI | null = null;

// Initialize mock data
function initializeMockData() {
  // Initialize machines
  mockMachines = [
    // Drawing machines
    {
      id: 'D-01',
      name: 'Drawing Line 01',
      area: 'drawing',
      status: 'running',
      lineSpeed: 920,
      targetSpeed: 1000,
      producedLength: 3850,
      targetLength: 5000,
      productionOrderId: 'PO-2024-156',
      productionOrderName: 'PO-2024-156',
      operatorName: 'Nguyễn Văn An',
      oee: 83.6,
      availability: 94.5,
      performance: 89.2,
      quality: 99.1,
      current: 45.2,
      power: 68.5,
      temperature: 68,
      multiZoneTemperatures: {
        zone1: 148,
        zone2: 161,
        zone3: 169,
        zone4: 155,
      },
      alarms: [],
      lastUpdated: new Date().toISOString(),
    },
    {
      id: 'D-02',
      name: 'Drawing Line 02',
      area: 'drawing',
      status: 'running',
      lineSpeed: 875,
      targetSpeed: 1000,
      producedLength: 4200,
      targetLength: 5000,
      productionOrderId: 'PO-2024-157',
      productionOrderName: 'PO-2024-157',
      operatorName: 'Trần Thị Bình',
      oee: 81.2,
      availability: 92.3,
      performance: 87.5,
      quality: 98.8,
      current: 43.8,
      power: 65.2,
      temperature: 72,
      lastUpdated: new Date().toISOString(),
    },
    {
      id: 'D-03',
      name: 'Drawing Line 03',
      area: 'drawing',
      status: 'running',
      lineSpeed: 885,
      targetSpeed: 1000,
      producedLength: 3980,
      targetLength: 5000,
      productionOrderId: 'PO-2024-158',
      productionOrderName: 'PO-2024-158',
      operatorName: 'Lê Văn Cường',
      oee: 82.5,
      availability: 93.1,
      performance: 88.5,
      quality: 99.0,
      current: 44.1,
      power: 66.8,
      temperature: 70,
      lastUpdated: new Date().toISOString(),
    },
    {
      id: 'D-04',
      name: 'Drawing Line 04',
      area: 'drawing',
      status: 'stopped',
      lineSpeed: 0,
      targetSpeed: 1000,
      producedLength: 0,
      operatorName: 'Phạm Thị Dung',
      oee: 0,
      availability: 0,
      performance: 0,
      quality: 0,
      current: 0,
      power: 2.1,
      temperature: 45,
      lastUpdated: new Date().toISOString(),
    },
    {
      id: 'D-05',
      name: 'Drawing Line 05',
      area: 'drawing',
      status: 'setup',
      lineSpeed: 810,
      targetSpeed: 1000,
      producedLength: 2100,
      targetLength: 5000,
      productionOrderId: 'PO-2024-159',
      productionOrderName: 'PO-2024-159',
      operatorName: 'Hoàng Văn Em',
      oee: 75.3,
      availability: 88.2,
      performance: 81.0,
      quality: 97.5,
      current: 38.2,
      power: 55.3,
      temperature: 82,
      lastUpdated: new Date().toISOString(),
    },
    {
      id: 'D-06',
      name: 'Drawing Line 06',
      area: 'drawing',
      status: 'running',
      lineSpeed: 895,
      targetSpeed: 1000,
      producedLength: 4450,
      targetLength: 5000,
      productionOrderId: 'PO-2024-160',
      productionOrderName: 'PO-2024-160',
      operatorName: 'Vũ Thị Phương',
      oee: 84.2,
      availability: 95.1,
      performance: 89.5,
      quality: 99.2,
      current: 45.8,
      power: 69.2,
      temperature: 69,
      lastUpdated: new Date().toISOString(),
    },
    {
      id: 'D-07',
      name: 'Drawing Line 07',
      area: 'drawing',
      status: 'running',
      lineSpeed: 840,
      targetSpeed: 1000,
      producedLength: 3650,
      targetLength: 5000,
      productionOrderId: 'PO-2024-161',
      productionOrderName: 'PO-2024-161',
      operatorName: 'Đỗ Văn Giang',
      oee: 79.8,
      availability: 91.2,
      performance: 84.0,
      quality: 98.5,
      current: 42.3,
      power: 63.5,
      temperature: 71,
      lastUpdated: new Date().toISOString(),
    },
    {
      id: 'D-08',
      name: 'Drawing Line 08',
      area: 'drawing',
      status: 'error',
      lineSpeed: 0,
      targetSpeed: 1000,
      producedLength: 0,
      operatorName: 'Bùi Thị Hoa',
      oee: 0,
      availability: 0,
      performance: 0,
      quality: 0,
      current: 0,
      power: 0,
      temperature: 85,
      alarms: [
        {
          id: 'ALM-001',
          machineId: 'D-08',
          severity: 'error',
          message: 'Motor overload detected',
          timestamp: new Date(Date.now() - 5 * 60000).toISOString(),
          acknowledged: false,
        },
      ],
      lastUpdated: new Date().toISOString(),
    },
    // Stranding machines
    {
      id: 'S-01',
      name: 'Stranding Unit 01',
      area: 'stranding',
      status: 'running',
      lineSpeed: 650,
      targetSpeed: 720,
      producedLength: 2800,
      targetLength: 3500,
      productionOrderId: 'PO-2024-162',
      productionOrderName: 'PO-2024-162',
      operatorName: 'Nguyễn Văn Khoa',
      oee: 78.5,
      availability: 90.2,
      performance: 90.3,
      quality: 96.5,
      current: 38.5,
      power: 52.3,
      temperature: 65,
      lastUpdated: new Date().toISOString(),
    },
    {
      id: 'S-02',
      name: 'Stranding Unit 02',
      area: 'stranding',
      status: 'running',
      lineSpeed: 680,
      targetSpeed: 720,
      producedLength: 2950,
      targetLength: 3500,
      productionOrderId: 'PO-2024-163',
      productionOrderName: 'PO-2024-163',
      operatorName: 'Trần Thị Lan',
      oee: 81.2,
      availability: 92.5,
      performance: 94.4,
      quality: 97.8,
      current: 40.2,
      power: 54.8,
      temperature: 68,
      lastUpdated: new Date().toISOString(),
    },
    {
      id: 'S-03',
      name: 'Stranding Unit 03',
      area: 'stranding',
      status: 'running',
      lineSpeed: 625,
      targetSpeed: 720,
      producedLength: 2650,
      targetLength: 3500,
      productionOrderId: 'PO-2024-164',
      productionOrderName: 'PO-2024-164',
      operatorName: 'Lê Văn Minh',
      oee: 76.3,
      availability: 88.7,
      performance: 86.8,
      quality: 96.2,
      current: 36.8,
      power: 50.1,
      temperature: 63,
      lastUpdated: new Date().toISOString(),
    },
    {
      id: 'S-04',
      name: 'Stranding Unit 04',
      area: 'stranding',
      status: 'stopped',
      lineSpeed: 0,
      targetSpeed: 720,
      producedLength: 0,
      operatorName: 'Phạm Thị Nga',
      oee: 0,
      availability: 0,
      performance: 0,
      quality: 0,
      current: 0,
      power: 1.5,
      temperature: 42,
      lastUpdated: new Date().toISOString(),
    },
    {
      id: 'S-05',
      name: 'Stranding Unit 05',
      area: 'stranding',
      status: 'running',
      lineSpeed: 665,
      targetSpeed: 720,
      producedLength: 2880,
      targetLength: 3500,
      productionOrderId: 'PO-2024-165',
      productionOrderName: 'PO-2024-165',
      operatorName: 'Hoàng Văn Oanh',
      oee: 79.8,
      availability: 91.3,
      performance: 92.4,
      quality: 97.1,
      current: 39.5,
      power: 53.6,
      temperature: 66,
      lastUpdated: new Date().toISOString(),
    },
    // Armoring machines
    {
      id: 'A-01',
      name: 'Armoring Line 01',
      area: 'armoring',
      status: 'running',
      lineSpeed: 320,
      targetSpeed: 350,
      producedLength: 1850,
      targetLength: 2500,
      productionOrderId: 'PO-2024-166',
      productionOrderName: 'PO-2024-166',
      operatorName: 'Vũ Thị Phượng',
      oee: 82.1,
      availability: 93.5,
      performance: 91.4,
      quality: 98.2,
      current: 28.3,
      power: 42.5,
      temperature: 55,
      lastUpdated: new Date().toISOString(),
    },
    {
      id: 'A-02',
      name: 'Armoring Line 02',
      area: 'armoring',
      status: 'running',
      lineSpeed: 310,
      targetSpeed: 350,
      producedLength: 1750,
      targetLength: 2500,
      productionOrderId: 'PO-2024-167',
      productionOrderName: 'PO-2024-167',
      operatorName: 'Đỗ Văn Quang',
      oee: 80.5,
      availability: 92.1,
      performance: 88.6,
      quality: 97.8,
      current: 27.5,
      power: 41.2,
      temperature: 58,
      lastUpdated: new Date().toISOString(),
    },
    {
      id: 'A-03',
      name: 'Armoring Line 03',
      area: 'armoring',
      status: 'idle',
      lineSpeed: 0,
      targetSpeed: 350,
      producedLength: 0,
      operatorName: 'Bùi Thị Rương',
      oee: 0,
      availability: 0,
      performance: 0,
      quality: 0,
      current: 0,
      power: 1.2,
      temperature: 38,
      lastUpdated: new Date().toISOString(),
    },
    // Sheathing machines
    {
      id: 'SH-01',
      name: 'Sheathing Line 01',
      area: 'sheathing',
      status: 'running',
      lineSpeed: 450,
      targetSpeed: 500,
      producedLength: 2200,
      targetLength: 3000,
      productionOrderId: 'PO-2024-168',
      productionOrderName: 'PO-2024-168',
      operatorName: 'Nguyễn Văn Sơn',
      oee: 85.2,
      availability: 94.8,
      performance: 90.0,
      quality: 99.5,
      current: 52.3,
      power: 78.5,
      temperature: 70,
      lastUpdated: new Date().toISOString(),
    },
    {
      id: 'SH-02',
      name: 'Sheathing Line 02',
      area: 'sheathing',
      status: 'running',
      lineSpeed: 425,
      targetSpeed: 500,
      producedLength: 2100,
      targetLength: 3000,
      productionOrderId: 'PO-2024-169',
      productionOrderName: 'PO-2024-169',
      operatorName: 'Trần Thị Tuyết',
      oee: 83.7,
      availability: 93.2,
      performance: 85.0,
      quality: 99.2,
      current: 50.8,
      power: 76.2,
      temperature: 68,
      lastUpdated: new Date().toISOString(),
    },
    {
      id: 'SH-03',
      name: 'Sheathing Line 03',
      area: 'sheathing',
      status: 'stopped',
      lineSpeed: 0,
      targetSpeed: 500,
      producedLength: 0,
      operatorName: 'Lê Văn Uyên',
      oee: 0,
      availability: 0,
      performance: 0,
      quality: 0,
      current: 0,
      power: 3.2,
      temperature: 48,
      lastUpdated: new Date().toISOString(),
    },
    {
      id: 'SH-04',
      name: 'Sheathing Line 04',
      area: 'sheathing',
      status: 'running',
      lineSpeed: 440,
      targetSpeed: 500,
      producedLength: 2150,
      targetLength: 3000,
      productionOrderId: 'PO-2024-170',
      productionOrderName: 'PO-2024-170',
      operatorName: 'Phạm Thị Vân',
      oee: 84.5,
      availability: 94.1,
      performance: 88.0,
      quality: 99.3,
      current: 51.1,
      power: 76.8,
      temperature: 69,
      lastUpdated: new Date().toISOString(),
    },
    {
      id: 'SH-05',
      name: 'Sheathing Line 05',
      area: 'sheathing',
      status: 'setup',
      lineSpeed: 410,
      targetSpeed: 500,
      producedLength: 1950,
      targetLength: 3000,
      productionOrderId: 'PO-2024-171',
      productionOrderName: 'PO-2024-171',
      operatorName: 'Hoàng Văn Xuyên',
      oee: 77.8,
      availability: 89.5,
      performance: 82.0,
      quality: 98.1,
      current: 48.2,
      power: 72.3,
      temperature: 75,
      lastUpdated: new Date().toISOString(),
    },
    {
      id: 'SH-06',
      name: 'Sheathing Line 06',
      area: 'sheathing',
      status: 'error',
      lineSpeed: 0,
      targetSpeed: 500,
      producedLength: 0,
      operatorName: 'Vũ Thị Yến',
      oee: 0,
      availability: 0,
      performance: 0,
      quality: 0,
      current: 0,
      power: 0,
      temperature: 85,
      alarms: [
        {
          id: 'ALM-002',
          machineId: 'SH-06',
          severity: 'error',
          message: 'Temperature sensor failure',
          timestamp: new Date(Date.now() - 10 * 60000).toISOString(),
          acknowledged: false,
        },
      ],
      lastUpdated: new Date().toISOString(),
    },
  ];

  // Initialize production orders
  mockOrders = [
    {
      id: 'PO-2024-156',
      name: 'PO-2024-156',
      productName: 'CV 3x2.5mm²',
      productNameCurrent: 'CV 3x2.5mm²',
      customer: 'Công ty ABC',
      machineId: 'D-01',
      startTime: new Date(Date.now() - 4.25 * 3600000).toISOString(),
      producedLength: 3850,
      targetLength: 5000,
      status: 'running',
    },
    {
      id: 'PO-2024-157',
      name: 'PO-2024-157',
      productName: 'CV 3x4.0mm²',
      productNameCurrent: 'CV 3x4.0mm²',
      customer: 'Nhà máy XYZ',
      machineId: 'D-02',
      startTime: new Date(Date.now() - 3.5 * 3600000).toISOString(),
      producedLength: 4200,
      targetLength: 5000,
      status: 'running',
    },
    {
      id: 'PO-2024-158',
      name: 'PO-2024-158',
      productName: 'CV 3x1.5mm²',
      productNameCurrent: 'CV 3x1.5mm²',
      customer: 'Tổng công ty DEF',
      machineId: 'D-03',
      startTime: new Date(Date.now() - 3.8 * 3600000).toISOString(),
      producedLength: 3980,
      targetLength: 5000,
      status: 'running',
    },
    {
      id: 'PO-2024-155',
      name: 'PO-2024-155',
      productName: 'CV 3x4.0mm²',
      productNameCurrent: 'CV 3x4.0mm²',
      customer: 'Nhà máy XYZ',
      machineId: 'D-01',
      startTime: new Date(Date.now() - 7.5 * 3600000).toISOString(),
      endTime: new Date(Date.now() - 3.9 * 3600000).toISOString(),
      producedLength: 4500,
      targetLength: 4500,
      status: 'completed',
      duration: '3h 40m',
    },
    {
      id: 'PO-2024-154',
      name: 'PO-2024-154',
      productName: 'CV 3x1.5mm²',
      productNameCurrent: 'CV 3x1.5mm²',
      customer: 'Tổng công ty DEF',
      machineId: 'D-02',
      startTime: new Date(Date.now() - 10.5 * 3600000).toISOString(),
      endTime: new Date(Date.now() - 7.4 * 3600000).toISOString(),
      producedLength: 3200,
      targetLength: 3200,
      status: 'completed',
      duration: '3h 10m',
    },
  ];

  // Calculate global KPI
  updateGlobalKPI();
}

// Update global KPI from current machine data
function updateGlobalKPI() {
  const running = mockMachines.filter((m) => m.status === 'running').length;
  const total = mockMachines.length;
  const output = mockMachines.reduce((sum, m) => sum + m.producedLength, 0);
  const orders = mockOrders.filter((o) => o.status === 'running').length;
  const alarms = mockMachines.reduce(
    (sum, m) => sum + (m.alarms?.filter((a) => !a.acknowledged).length || 0),
    0
  );
  const energy = mockMachines.reduce((sum, m) => sum + (m.power || 0), 0) / 1000; // Convert to MW

  mockGlobalKPI = {
    running,
    total,
    output,
    orders,
    alarms,
    energy,
  };
}

// Generate time series data for trends
function generateTimeSeriesData(
  startValue: number,
  endValue: number,
  points: number = 7
): Array<{ time: string; value: number }> {
  const data: Array<{ time: string; value: number }> = [];
  const now = new Date();
  const interval = 5 * 60000; // 5 minutes

  for (let i = points - 1; i >= 0; i--) {
    const time = new Date(now.getTime() - i * interval);
    const progress = i / (points - 1);
    const value = startValue + (endValue - startValue) * (1 - progress) + (Math.random() - 0.5) * 5;
    data.push({
      time: time.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
      value: Math.max(0, value),
    });
  }

  return data;
}

// Mock API implementation
export const mockAPI = {
  // Initialize mock data
  init() {
    initializeMockData();
  },

  // Request handler
  async request<T>(endpoint: string, options?: RequestInit): Promise<APIResponse<T>> {
    // Simulate network delay
    await new Promise((resolve) => setTimeout(resolve, 100 + Math.random() * 200));

    try {
      // Parse endpoint
      const url = new URL(endpoint, 'http://localhost');
      const path = url.pathname;
      const params = url.searchParams;

      // Route requests
      if (path === '/kpis/global') {
        updateGlobalKPI();
        return {
          data: mockGlobalKPI as T,
          timestamp: new Date().toISOString(),
          success: true,
        };
      }

      if (path === '/areas') {
        const areas = this.getProductionAreas();
        return {
          data: areas as T,
          timestamp: new Date().toISOString(),
          success: true,
        };
      }

      if (path.startsWith('/areas/')) {
        const areaId = path.split('/')[2] as ProductionArea;
        const area = this.getProductionArea(areaId);
        return {
          data: area as T,
          timestamp: new Date().toISOString(),
          success: true,
        };
      }

      if (path === '/machines') {
        const area = params.get('area') as ProductionArea | null;
        const machines = area
          ? mockMachines.filter((m) => m.area === area)
          : mockMachines;
        return {
          data: machines as T,
          timestamp: new Date().toISOString(),
          success: true,
        };
      }

      if (path.startsWith('/machines/') && !path.includes('/orders')) {
        const machineId = path.split('/')[2];
        const machine = this.getMachineDetail(machineId);
        return {
          data: machine as T,
          timestamp: new Date().toISOString(),
          success: true,
        };
      }

      if (path === '/orders') {
        return {
          data: mockOrders as T,
          timestamp: new Date().toISOString(),
          success: true,
        };
      }

      if (path.startsWith('/orders/')) {
        const orderId = path.split('/')[2];
        const order = mockOrders.find((o) => o.id === orderId);
        return {
          data: (order || null) as T,
          timestamp: new Date().toISOString(),
          success: !!order,
        };
      }

      if (path.includes('/machines/') && path.includes('/orders')) {
        const machineId = path.split('/')[2];
        const orders = mockOrders.filter((o) => o.machineId === machineId);
        return {
          data: orders as T,
          timestamp: new Date().toISOString(),
          success: true,
        };
      }

      return {
        data: null as T,
        timestamp: new Date().toISOString(),
        success: false,
        message: 'Endpoint not found',
      };
    } catch (error) {
      return {
        data: null as T,
        timestamp: new Date().toISOString(),
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  },

  // Get production areas summary
  getProductionAreas(): ProductionAreaSummary[] {
    const areas: ProductionArea[] = ['drawing', 'stranding', 'armoring', 'sheathing'];
    const areaNames: Record<ProductionArea, { name: string; nameEn: string }> = {
      drawing: { name: 'KÉO', nameEn: 'DRAWING' },
      stranding: { name: 'XOẮN', nameEn: 'STRANDING' },
      armoring: { name: 'GIÁP', nameEn: 'ARMORING' },
      sheathing: { name: 'BỌC', nameEn: 'SHEATHING' },
    };

    return areas.map((areaId) => {
      const areaMachines = mockMachines.filter((m) => m.area === areaId);
      const running = areaMachines.filter((m) => m.status === 'running').length;
      const total = areaMachines.length;
      const output = areaMachines.reduce((sum, m) => sum + m.producedLength, 0);
      const speedAvg =
        areaMachines.filter((m) => m.status === 'running').length > 0
          ? areaMachines
              .filter((m) => m.status === 'running')
              .reduce((sum, m) => sum + m.lineSpeed, 0) / running
          : 0;
      const alarms = areaMachines.reduce(
        (sum, m) => sum + (m.alarms?.filter((a) => !a.acknowledged).length || 0),
        0
      );

      // Get top 3 machines by speed
      const topMachines = areaMachines
        .filter((m) => m.status === 'running')
        .sort((a, b) => b.lineSpeed - a.lineSpeed)
        .slice(0, 3)
        .map((m) => ({
          id: m.id,
          name: m.id,
          speed: m.lineSpeed,
          status: m.status,
        }));

      // Generate sparkline data (last 10 minutes)
      const sparklineData = Array.from({ length: 10 }, (_, i) => {
        const baseSpeed = speedAvg;
        return Math.max(0, baseSpeed + (Math.random() - 0.5) * baseSpeed * 0.1);
      });

      return {
        id: areaId,
        name: areaNames[areaId].name,
        nameEn: areaNames[areaId].nameEn,
        running,
        total,
        output,
        speedAvg: Math.round(speedAvg),
        alarms,
        topMachines,
        sparklineData,
      };
    });
  },

  // Get single production area
  getProductionArea(areaId: ProductionArea): ProductionAreaSummary {
    const areas = this.getProductionAreas();
    return areas.find((a) => a.id === areaId) || areas[0];
  },

  // Get machine detail with trends
  getMachineDetail(machineId: string): MachineDetail {
    const machine = mockMachines.find((m) => m.id === machineId);
    if (!machine) {
      throw new Error(`Machine ${machineId} not found`);
    }

    const order = mockOrders.find((o) => o.id === machine.productionOrderId);
    const currentSpeed = machine.lineSpeed;
    const targetSpeed = machine.targetSpeed || 1000;

    // Generate trend data
    const speedTrend = generateTimeSeriesData(
      currentSpeed * 0.95,
      currentSpeed,
      7
    ).map((d) => ({
      time: d.time,
      speed: d.value,
      target: targetSpeed,
    }));

    const temperatureTrend = generateTimeSeriesData(
      (machine.temperature || 65) - 5,
      machine.temperature || 65,
      7
    ).map((d) => ({
      time: d.time,
      temp: d.value,
    }));

    const currentTrend = generateTimeSeriesData(
      (machine.current || 40) - 3,
      machine.current || 40,
      7
    ).map((d) => ({
      time: d.time,
      current: d.value,
    }));

    // Multi-zone temperature trend
    const multiZoneTemperatureTrend = Array.from({ length: 7 }, (_, i) => {
      const time = new Date(Date.now() - (6 - i) * 5 * 60000);
      return {
        time: time.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
        zone1: (machine.multiZoneTemperatures?.zone1 || 145) + (Math.random() - 0.5) * 5,
        zone2: (machine.multiZoneTemperatures?.zone2 || 158) + (Math.random() - 0.5) * 5,
        zone3: (machine.multiZoneTemperatures?.zone3 || 165) + (Math.random() - 0.5) * 5,
        zone4: (machine.multiZoneTemperatures?.zone4 || 152) + (Math.random() - 0.5) * 5,
      };
    });

    // Power trend (last 2 hours, 15-min intervals)
    const powerTrend = Array.from({ length: 9 }, (_, i) => {
      const time = new Date(Date.now() - (8 - i) * 15 * 60000);
      const avgPower = machine.power || 68;
      return {
        time: time.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
        power: avgPower + (Math.random() - 0.5) * 5,
        avgPower,
        minRange: avgPower - 8,
        maxRange: avgPower + 7,
      };
    });

    // Energy consumption (last 24 hours, hourly)
    const energyConsumption = Array.from({ length: 8 }, (_, i) => {
      const hour = new Date(Date.now() - (7 - i) * 3600000);
      return {
        hour: hour.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
        energy: (machine.power || 68) * 0.8 + Math.random() * 10,
      };
    });

    // Order history for this machine
    const orderHistory = mockOrders
      .filter((o) => o.machineId === machineId)
      .sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime())
      .slice(0, 10);

    return {
      ...machine,
      productionOrder: order,
      speedTrend,
      temperatureTrend,
      currentTrend,
      multiZoneTemperatureTrend,
      powerTrend,
      energyConsumption,
      orderHistory,
    };
  },

  // Real-time subscriptions (mock)
  subscribeToMachineUpdates(
    machineId: string,
    callback: (data: Machine) => void
  ): () => void {
    const interval = setInterval(() => {
      const machine = mockMachines.find((m) => m.id === machineId);
      if (machine) {
        // Simulate small variations in data
        const updated = {
          ...machine,
          lineSpeed: Math.max(0, machine.lineSpeed + (Math.random() - 0.5) * 10),
          current: machine.current
            ? Math.max(0, machine.current + (Math.random() - 0.5) * 2)
            : undefined,
          power: machine.power
            ? Math.max(0, machine.power + (Math.random() - 0.5) * 3)
            : undefined,
          temperature: machine.temperature
            ? Math.max(0, machine.temperature + (Math.random() - 0.5) * 2)
            : undefined,
          lastUpdated: new Date().toISOString(),
        };
        callback(updated);
      }
    }, 5000); // Update every 5 seconds

    return () => clearInterval(interval);
  },

  subscribeToGlobalUpdates(
    callback: (data: { kpis: GlobalKPI; areas: ProductionAreaSummary[] }) => void
  ): () => void {
    const interval = setInterval(() => {
      updateGlobalKPI();
      if (mockGlobalKPI) {
        callback({
          kpis: mockGlobalKPI,
          areas: this.getProductionAreas(),
        });
      }
    }, 10000); // Update every 10 seconds

    return () => clearInterval(interval);
  },
};

// Initialize on module load
mockAPI.init();


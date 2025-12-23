// API service layer - can be swapped between mock and real Node-RED API

import type {
  Machine,
  MachineDetail,
  ProductionAreaSummary,
  GlobalKPI,
  ProductionOrder,
  APIResponse,
  PaginatedResponse,
  ProductionArea,
} from '../types';

// Import mockAPI at module level for subscriptions
import { mockAPI } from './mockApi';

// Configuration for API endpoint
const API_CONFIG = {
  baseUrl: import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001/api',
  useMock: import.meta.env.VITE_USE_MOCK_DATA !== 'false', // Default to mock
  realtimeEnabled: import.meta.env.VITE_REALTIME_ENABLED === 'true',
};

// Log configuration on startup
console.log('🔧 API Configuration:');
console.log(`   Base URL: ${API_CONFIG.baseUrl}`);
console.log(`   Using Mock: ${API_CONFIG.useMock}`);
console.log(`   Real-time: ${API_CONFIG.realtimeEnabled}`);

// API Client class
class APIClient {
  private baseUrl: string;
  private useMock: boolean;

  constructor() {
    this.baseUrl = API_CONFIG.baseUrl;
    this.useMock = API_CONFIG.useMock;
  }

  private async request<T>(
    endpoint: string,
    options?: RequestInit
  ): Promise<APIResponse<T>> {
    if (this.useMock) {
      console.log('📦 Using MOCK API data');
      // Import mock service dynamically
      const { mockAPI } = await import('./mockApi');
      return await mockAPI.request<T>(endpoint, options);
    }

    // Real API call
    const url = `${this.baseUrl}${endpoint}`;
    console.log(`🌐 API Request: ${url}`);
    
    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          ...options?.headers,
        },
      });

      if (!response.ok) {
        throw new Error(`API Error: ${response.status} ${response.statusText}`);
      }

      const jsonData = await response.json();
      console.log(`✅ API Success: ${endpoint}`);
      
      // Backend returns { data: ..., success: true, timestamp: ... }
      // Extract the actual data from the response
      const actualData = jsonData.data !== undefined ? jsonData.data : jsonData;
      
      return {
        data: actualData as T,
        timestamp: jsonData.timestamp || new Date().toISOString(),
        success: jsonData.success !== undefined ? jsonData.success : true,
      };
    } catch (error) {
      console.error(`❌ API Error (${endpoint}):`, error);
      console.error(`   URL: ${url}`);
      console.error(`   Make sure backend is running on ${this.baseUrl}`);
      return {
        data: null as T,
        timestamp: new Date().toISOString(),
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  // Global KPIs
  async getGlobalKPIs(): Promise<APIResponse<GlobalKPI>> {
    return this.request<GlobalKPI>('/kpis/global');
  }

  // Production Areas
  async getProductionAreas(): Promise<APIResponse<ProductionAreaSummary[]>> {
    return this.request<ProductionAreaSummary[]>('/areas');
  }

  async getProductionArea(areaId: ProductionArea): Promise<APIResponse<ProductionAreaSummary>> {
    return this.request<ProductionAreaSummary>(`/areas/${areaId}`);
  }

  // Machines
  async getAllMachines(): Promise<APIResponse<Machine[]>> {
    return this.request<Machine[]>('/machines');
  }

  async getMachinesByArea(areaId: ProductionArea): Promise<APIResponse<Machine[]>> {
    return this.request<Machine[]>(`/machines?area=${areaId}`);
  }

  async getMachineDetail(machineId: string): Promise<APIResponse<MachineDetail>> {
    return this.request<MachineDetail>(`/machines/${machineId}`);
  }

  // Production Orders
  async getProductionOrders(): Promise<APIResponse<ProductionOrder[]>> {
    return this.request<ProductionOrder[]>('/orders');
  }

  async getProductionOrder(orderId: string): Promise<APIResponse<ProductionOrder>> {
    return this.request<ProductionOrder>(`/orders/${orderId}`);
  }

  async getMachineOrders(machineId: string): Promise<APIResponse<ProductionOrder[]>> {
    return this.request<ProductionOrder[]>(`/machines/${machineId}/orders`);
  }

  // WebSocket connection for real-time updates
  private ws: WebSocket | null = null;
  private wsCallbacks: Map<string, Set<(data: any) => void>> = new Map();

  private connectWebSocket() {
    if (this.useMock || this.ws) {
      return;
    }

    try {
      const wsUrl = this.baseUrl.replace('http://', 'ws://').replace('https://', 'wss://').replace('/api', '');
      this.ws = new WebSocket(`${wsUrl}/ws`);

      this.ws.onopen = () => {
        console.log('✅ WebSocket connected');
      };

      this.ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          
          if (message.type === 'machine:update') {
            // Broadcast to all machine update callbacks
            const callbacks = this.wsCallbacks.get('machine:update') || new Set();
            callbacks.forEach((callback) => {
              try {
                callback(message.data);
              } catch (error) {
                console.error('Error in WebSocket callback:', error);
              }
            });
          }

          // Handle other event types
          const callbacks = this.wsCallbacks.get(message.type) || new Set();
          callbacks.forEach((callback) => {
            try {
              callback(message.data);
            } catch (error) {
              console.error('Error in WebSocket callback:', error);
            }
          });
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      };

      this.ws.onerror = (error) => {
        console.error('❌ WebSocket error:', error);
      };

      this.ws.onclose = () => {
        console.log('❌ WebSocket disconnected, reconnecting in 3s...');
        this.ws = null;
        setTimeout(() => this.connectWebSocket(), 3000);
      };
    } catch (error) {
      console.error('Failed to connect WebSocket:', error);
    }
  }

  // Real-time data (for WebSocket/SSE integration)
  subscribeToMachineUpdates(
    machineId: string,
    callback: (data: Machine) => void
  ): () => void {
    if (this.useMock) {
      // Mock real-time updates
      return mockAPI.subscribeToMachineUpdates(machineId, callback);
    }

    // Connect WebSocket if not already connected
    if (!this.ws) {
      this.connectWebSocket();
    }

    // Subscribe to machine:update events
    const eventType = 'machine:update';
    if (!this.wsCallbacks.has(eventType)) {
      this.wsCallbacks.set(eventType, new Set());
    }

    const callbacks = this.wsCallbacks.get(eventType)!;
    callbacks.add(callback);

    // Return unsubscribe function
    return () => {
      callbacks.delete(callback);
      if (callbacks.size === 0) {
        this.wsCallbacks.delete(eventType);
      }
    };
  }

  subscribeToGlobalUpdates(
    callback: (data: { kpis: GlobalKPI; areas: ProductionAreaSummary[] }) => void
  ): () => void {
    if (this.useMock) {
      // Mock real-time updates
      return mockAPI.subscribeToGlobalUpdates(callback);
    }

    // Real WebSocket/SSE implementation would go here
    // Example for WebSocket:
    // const ws = new WebSocket(`${this.baseUrl.replace('http', 'ws')}/global/stream`);
    // ws.onmessage = (event) => callback(JSON.parse(event.data));
    // return () => ws.close();
    
    return () => {};
  }
}

// Export singleton instance
export const apiClient = new APIClient();

// Export configuration for external use
export { API_CONFIG };


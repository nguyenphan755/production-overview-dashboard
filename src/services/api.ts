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
// Automatically detects hostname from current location for remote access support
// CRITICAL: This function MUST be called at request time, not module load time
// This ensures window.location.hostname is correctly detected on remote PCs
function getApiBaseUrl(): string {
  // Get current hostname if available (for smart localhost detection)
  const currentHostname = typeof window !== 'undefined' && window.location 
    ? window.location.hostname 
    : null;

  // Priority 1: If explicitly configured via environment variable, check if it's valid
  if (import.meta.env.VITE_API_BASE_URL) {
    const envUrl = import.meta.env.VITE_API_BASE_URL;
    
    // Smart localhost detection: If env is set to localhost but we're on a remote device,
    // ignore the env variable and use dynamic detection instead
    const isLocalhostEnv = envUrl.includes('localhost') || envUrl.includes('127.0.0.1');
    const isLocalhostHostname = currentHostname === 'localhost' || currentHostname === '127.0.0.1';
    
    if (isLocalhostEnv && !isLocalhostHostname && currentHostname) {
      // Environment is set to localhost but we're on a remote device
      // Ignore env variable and use dynamic detection
      console.warn('⚠️ VITE_API_BASE_URL is set to localhost, but current hostname is remote.');
      console.warn('   Environment URL:', envUrl);
      console.warn('   Current hostname:', currentHostname);
      console.warn('   Ignoring env variable and using dynamic detection instead.');
      // Fall through to Priority 2 (dynamic detection)
    } else {
      // Environment variable is valid for current hostname, use it
      console.log('🔧 Using VITE_API_BASE_URL from environment:', envUrl);
      return envUrl;
    }
  }

  // Priority 2: Detect current hostname from window location (supports remote access via Tailscale, etc.)
  // This MUST be called at request time, not module load time, to ensure correct hostname
  if (typeof window !== 'undefined' && window.location) {
    const protocol = window.location.protocol;
    const hostname = window.location.hostname;
    const port = 3001; // Backend API port
    
    const detectedUrl = `${protocol}//${hostname}:${port}/api`;
    
    // Debug logging to verify hostname detection
    console.log('🔍 getApiBaseUrl() detected:', {
      hostname: hostname,
      protocol: protocol,
      detectedUrl: detectedUrl,
      isLocalhost: hostname === 'localhost' || hostname === '127.0.0.1'
    });
    
    return detectedUrl;
  }

  // Fallback for SSR or when window is not available (should never happen in browser)
  console.warn('⚠️ window.location not available, using localhost fallback');
  return 'http://localhost:3001/api';
}

const API_CONFIG = {
  // DO NOT compute baseUrl here - it must be computed dynamically at request time
  // Computing it here causes issues on remote PCs where window.location might not be ready
  useMock: import.meta.env.VITE_USE_MOCK_DATA !== 'false', // Default to mock
  realtimeEnabled: import.meta.env.VITE_REALTIME_ENABLED === 'true',
};

// Log configuration on startup
console.log('🔧 API Configuration:');
console.log(`   Base URL: Will be detected dynamically at request time`);
if (import.meta.env.VITE_API_BASE_URL) {
  console.log(`   Environment VITE_API_BASE_URL: ${import.meta.env.VITE_API_BASE_URL}`);
}
console.log(`   Using Mock: ${API_CONFIG.useMock}`);
console.log(`   Real-time: ${API_CONFIG.realtimeEnabled}`);

// API Client class
class APIClient {
  private useMock: boolean;

  constructor() {
    this.useMock = API_CONFIG.useMock;
  }

  // Get baseUrl dynamically on each request - NEVER cache it
  // This ensures window.location.hostname is correctly detected at request time
  // Critical for remote access where module load might happen before hostname is available
  private getBaseUrl(): string {
    return getApiBaseUrl();
  }

  private async request<T>(
    endpoint: string,
    options?: RequestInit
  ): Promise<APIResponse<T>> {
    if (this.useMock) {
      console.warn('⚠️ Using MOCK API data - Set VITE_USE_MOCK_DATA=false to use real API');
      console.log('📦 Using MOCK API data for:', endpoint);
      // Import mock service dynamically
      const { mockAPI } = await import('./mockApi');
      return await mockAPI.request<T>(endpoint, options);
    }

    // Real API call - ALWAYS get fresh baseUrl to ensure correct hostname detection
    const currentBaseUrl = this.getBaseUrl();
    const url = `${currentBaseUrl}${endpoint}`;
    
    // Bug detection: Verify we're not using localhost on remote devices
    if (typeof window !== 'undefined' && window.location) {
      const currentHostname = window.location.hostname;
      const isLocalhostRequest = url.includes('localhost') || url.includes('127.0.0.1');
      const isLocalhostHostname = currentHostname === 'localhost' || currentHostname === '127.0.0.1';
      
      if (isLocalhostRequest && !isLocalhostHostname) {
        console.error('❌ BUG DETECTED: Using localhost URL on remote device!');
        console.error('   Current hostname:', currentHostname);
        console.error('   Detected Base URL:', currentBaseUrl);
        console.error('   Request URL:', url);
        console.error('   Environment VITE_API_BASE_URL:', import.meta.env.VITE_API_BASE_URL || 'NOT SET');
        console.error('   Fix: Set VITE_API_BASE_URL or ensure getApiBaseUrl() detects hostname correctly');
      }
    }
    
    console.log(`🌐 API Request: ${url}`);
    console.log(`🔧 Using Mock: ${this.useMock}, Base URL: ${currentBaseUrl}, Hostname: ${typeof window !== 'undefined' && window.location ? window.location.hostname : 'N/A'}`);
    
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
      console.log(`📦 Response structure:`, {
        hasData: jsonData.data !== undefined,
        hasSuccess: jsonData.success !== undefined,
        dataType: Array.isArray(jsonData.data) ? 'array' : typeof jsonData.data,
        dataLength: Array.isArray(jsonData.data) ? jsonData.data.length : 'N/A',
      });
      
      // Backend returns { data: ..., success: true, timestamp: ... }
      // Extract the actual data from the response
      const actualData = jsonData.data !== undefined ? jsonData.data : jsonData;
      
      console.log(`📊 Extracted data:`, {
        isArray: Array.isArray(actualData),
        length: Array.isArray(actualData) ? actualData.length : 'N/A',
        type: typeof actualData,
      });
      
      return {
        data: actualData as T,
        timestamp: jsonData.timestamp || new Date().toISOString(),
        success: jsonData.success !== undefined ? jsonData.success : true,
      };
    } catch (error) {
      console.error(`❌ API Error (${endpoint}):`, error);
      console.error(`   URL: ${url}`);
      console.error(`   Base URL: ${this.baseUrl}`);
      console.error(`   Using Mock: ${this.useMock}`);
      console.error(`   Error Type: ${error instanceof Error ? error.constructor.name : typeof error}`);
      if (error instanceof TypeError && error.message.includes('fetch')) {
        console.error(`   💡 Network error - Check if backend is running and accessible from ${typeof window !== 'undefined' ? window.location.origin : 'unknown'}`);
        console.error(`   💡 Try accessing: ${url} directly in browser`);
      }
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

  async getMachineStatusHistory(machineId: string, hours: number = 8): Promise<APIResponse<any[]>> {
    return this.request<any[]>(`/machines/${machineId}/status-history?hours=${hours}`);
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

  // Analytics (cached, backend computed)
  async getAnalytics(
    range: string,
    area: string = 'all',
    machineId?: string,
    shiftDate?: string,
    shiftNumber?: string
  ): Promise<APIResponse<any>> {
    const params = new URLSearchParams();
    params.set('range', range);
    params.set('area', area);
    if (machineId) {
      params.set('machineId', machineId);
    }
    if (shiftDate) {
      params.set('shiftDate', shiftDate);
    }
    if (shiftNumber) {
      params.set('shiftNumber', shiftNumber);
    }
    return this.request<any>(`/analytics?${params.toString()}`);
  }

  async recalculateAnalytics(
    range: string,
    area: string = 'all',
    machineId?: string,
    shiftDate?: string,
    shiftNumber?: string
  ): Promise<APIResponse<any>> {
    return this.request<any>('/analytics/recalculate', {
      method: 'POST',
      body: JSON.stringify({ range, area, machineId, shiftDate, shiftNumber }),
    });
  }

  // WebSocket connection for real-time updates
  private ws: WebSocket | null = null;
  private wsCallbacks: Map<string, Set<(data: any) => void>> = new Map();

  private connectWebSocket() {
    if (this.useMock || this.ws) {
      return;
    }

    try {
      // Always get fresh baseUrl to ensure correct hostname detection
      const currentBaseUrl = this.getBaseUrl();
      const wsUrl = currentBaseUrl.replace('http://', 'ws://').replace('https://', 'wss://').replace('/api', '');
      console.log('🔌 WebSocket connecting to:', `${wsUrl}/ws`);
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


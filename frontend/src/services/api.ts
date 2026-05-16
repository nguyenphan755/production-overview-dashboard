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

const IS_API_DEBUG_LOGS =
  import.meta.env.DEV ||
  String(import.meta.env.VITE_DEBUG_API ?? '').toLowerCase() === 'true';

function apiDebugLog(...args: unknown[]) {
  if (IS_API_DEBUG_LOGS) console.log(...args);
}

let mockApiPromise: Promise<typeof import('./mockApi')> | null = null;

async function getMockApi() {
  if (!mockApiPromise) {
    mockApiPromise = import('./mockApi');
  }
  return (await mockApiPromise).mockAPI;
}

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
      if (IS_API_DEBUG_LOGS) {
        console.log('🔧 Using VITE_API_BASE_URL from environment:', envUrl);
      }
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

    apiDebugLog('🔍 getApiBaseUrl() detected:', {
      hostname: hostname,
      protocol: protocol,
      detectedUrl: detectedUrl,
      isLocalhost: hostname === 'localhost' || hostname === '127.0.0.1',
    });

    return detectedUrl;
  }

  // Fallback for SSR or when window is not available (should never happen in browser)
  console.warn('⚠️ window.location not available, using localhost fallback');
  return 'http://localhost:3001/api';
}

const MES_LOGIN_SESSION_KEY = 'mes_login_session';

/** JWT from the same store as App.tsx (avoids stale React props on export). */
function readStoredAuthToken(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(MES_LOGIN_SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { token?: string };
    const t = parsed?.token != null ? String(parsed.token).trim() : '';
    return t || null;
  } catch {
    return null;
  }
}

const API_CONFIG = {
  // DO NOT compute baseUrl here - it must be computed dynamically at request time
  // Computing it here causes issues on remote PCs where window.location might not be ready
  useMock: import.meta.env.VITE_USE_MOCK_DATA === 'true', // Default to real API
  realtimeEnabled: import.meta.env.VITE_REALTIME_ENABLED === 'true',
};

// Log configuration on startup (dev / explicit debug only)
apiDebugLog('🔧 API Configuration:');
apiDebugLog(`   Base URL: Will be detected dynamically at request time`);
if (import.meta.env.VITE_API_BASE_URL) {
  apiDebugLog(`   Environment VITE_API_BASE_URL: ${import.meta.env.VITE_API_BASE_URL}`);
}
apiDebugLog(`   Using Mock: ${API_CONFIG.useMock}`);
apiDebugLog(`   Real-time: ${API_CONFIG.realtimeEnabled}`);

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
      if (IS_API_DEBUG_LOGS) {
        console.warn('⚠️ Using MOCK API data - Set VITE_USE_MOCK_DATA=false to use real API');
      }
      apiDebugLog('📦 Using MOCK API data for:', endpoint);
      const mockAPI = await getMockApi();
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
    
    apiDebugLog(`🌐 API Request: ${url}`);
    apiDebugLog(
      `🔧 Using Mock: ${this.useMock}, Base URL: ${currentBaseUrl}, Hostname: ${typeof window !== 'undefined' && window.location ? window.location.hostname : 'N/A'}`
    );
    
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
      apiDebugLog(`✅ API Success: ${endpoint}`);
      apiDebugLog(`📦 Response structure:`, {
        hasData: jsonData.data !== undefined,
        hasSuccess: jsonData.success !== undefined,
        dataType: Array.isArray(jsonData.data) ? 'array' : typeof jsonData.data,
        dataLength: Array.isArray(jsonData.data) ? jsonData.data.length : 'N/A',
      });

      // Backend returns { data: ..., success: true, timestamp: ... }
      // Extract the actual data from the response
      const actualData = jsonData.data !== undefined ? jsonData.data : jsonData;

      apiDebugLog(`📊 Extracted data:`, {
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
      if (error instanceof Error && error.name === 'AbortError') {
        throw error;
      }
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

  /**
   * Status segments for Gantt: either rolling `hours` from now, or fixed overlap range `start`–`end` (ISO).
   */
  async getMachineStatusHistory(
    machineId: string,
    options: { hours: number } | { start: string; end: string },
    init?: { signal?: AbortSignal }
  ): Promise<APIResponse<any[]>> {
    if ('start' in options && 'end' in options) {
      const q = new URLSearchParams({ start: options.start, end: options.end });
      return this.request<any[]>(`/machines/${machineId}/status-history?${q.toString()}`, {
        signal: init?.signal,
      });
    }
    const hours = options.hours ?? 8;
    return this.request<any[]>(`/machines/${machineId}/status-history?hours=${hours}`, {
      signal: init?.signal,
    });
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
    shiftNumber?: string,
    dayDate?: string
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
    if (dayDate) {
      params.set('dayDate', dayDate);
    }
    return this.request<any>(`/analytics?${params.toString()}`);
  }

  /** JWT required — immutable settled OEE per machine for a completed shift */
  async getOeeSettledShift(
    shiftDate: string,
    shiftNumber: number,
    authToken: string
  ): Promise<
    APIResponse<{
      shiftId: string;
      periodStart: string;
      periodEnd: string;
      settlements: Record<string, unknown>[];
    }>
  > {
    if (this.useMock) {
      return {
        success: false,
        data: { shiftId: '', periodStart: '', periodEnd: '', settlements: [] },
        timestamp: new Date().toISOString(),
        message: 'OEE settled API not available in mock mode',
      };
    }

    const params = new URLSearchParams({
      shiftDate,
      shiftNumber: String(shiftNumber),
    });
    const currentBaseUrl = this.getBaseUrl();
    const url = `${currentBaseUrl}/oee-settled/shift?${params.toString()}`;

    try {
      const response = await fetch(url, {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
      });

      const jsonData = await response.json().catch(() => ({}));
      const actualData =
        jsonData.data !== undefined ? jsonData.data : jsonData;

      if (!response.ok) {
        return {
          success: false,
          data: {
            shiftId: '',
            periodStart: '',
            periodEnd: '',
            settlements: [],
          },
          timestamp: jsonData.timestamp || new Date().toISOString(),
          message:
            jsonData.message ||
            `HTTP ${response.status}: ${response.statusText}`,
        };
      }

      return {
        data: actualData as {
          shiftId: string;
          periodStart: string;
          periodEnd: string;
          settlements: Record<string, unknown>[];
        },
        timestamp: jsonData.timestamp || new Date().toISOString(),
        success: jsonData.success !== undefined ? jsonData.success : true,
      };
    } catch (error) {
      return {
        success: false,
        data: {
          shiftId: '',
          periodStart: '',
          periodEnd: '',
          settlements: [],
        },
        timestamp: new Date().toISOString(),
        message: error instanceof Error ? error.message : 'Network error',
      };
    }
  }

  async recalculateAnalytics(
    range: string,
    area: string = 'all',
    machineId?: string,
    shiftDate?: string,
    shiftNumber?: string,
    dayDate?: string
  ): Promise<APIResponse<any>> {
    return this.request<any>('/analytics/recalculate', {
      method: 'POST',
      body: JSON.stringify({ range, area, machineId, shiftDate, shiftNumber, dayDate }),
    });
  }

  /**
   * Download HTML line processing report (JWT). Omit shift to include all three shifts on localDate.
   */
  async downloadLineProcessingHtmlReport(
    params: {
      localDate: string;
      area?: string;
      machineIds?: string;
      shift?: 1 | 2 | 3;
      /** All machines (all production areas); mutually exclusive with area and machineIds */
      factory?: boolean;
    },
    authToken?: string | null
  ): Promise<{ ok: true; filename: string } | { ok: false; message: string }> {
    if (this.useMock) {
      return { ok: false, message: 'Export not available in mock mode' };
    }
    const bearer =
      readStoredAuthToken() ??
      (authToken != null && String(authToken).trim() !== '' ? String(authToken).trim() : null);
    if (!bearer) {
      return { ok: false, message: 'Chưa có phiên đăng nhập — vui lòng đăng nhập lại.' };
    }
    const q = new URLSearchParams();
    q.set('localDate', params.localDate);
    if (params.factory) q.set('factory', '1');
    else {
      if (params.area) q.set('area', params.area);
      if (params.machineIds) q.set('machineIds', params.machineIds);
    }
    if (params.shift != null) q.set('shift', String(params.shift));
    const currentBaseUrl = this.getBaseUrl();
    const url = `${currentBaseUrl}/reports/line-processing.html?${q.toString()}`;
    try {
      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${bearer}` },
      });
      if (!response.ok) {
        const errJ = (await response.json().catch(() => ({}))) as { message?: string };
        return {
          ok: false,
          message: errJ.message || `HTTP ${response.status}: ${response.statusText}`,
        };
      }
      const cd = response.headers.get('Content-Disposition');
      let filename = 'line-processing.html';
      const m = cd && /filename="([^"]+)"/.exec(cd);
      if (m?.[1]) filename = m[1];
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = filename;
      a.rel = 'noopener';
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(blobUrl);
      return { ok: true, filename };
    } catch (error) {
      return {
        ok: false,
        message: error instanceof Error ? error.message : 'Network error',
      };
    }
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
      apiDebugLog('🔌 WebSocket connecting to:', `${wsUrl}/ws`);
      this.ws = new WebSocket(`${wsUrl}/ws`);

      this.ws.onopen = () => {
        apiDebugLog('✅ WebSocket connected');
      };

      this.ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          
          if (message.type === 'machine:update') {
            const callbacks = this.wsCallbacks.get('machine:update') || new Set();
            callbacks.forEach((callback) => {
              try {
                callback(message.data);
              } catch (error) {
                console.error('Error in WebSocket callback:', error);
              }
            });
            return;
          }

          // Other event types (not handled above)
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
        apiDebugLog('❌ WebSocket disconnected, reconnecting in 3s...');
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
      let unsubscribe: (() => void) | null = null;
      getMockApi().then((mockAPI) => {
        unsubscribe = mockAPI.subscribeToMachineUpdates(machineId, callback);
      });
      return () => {
        if (unsubscribe) unsubscribe();
      };
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
    const wrapped = (data: Machine) => {
      if (!data || data.id !== machineId) return;
      callback(data);
    };
    callbacks.add(wrapped);

    // Return unsubscribe function
    return () => {
      callbacks.delete(wrapped);
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
      let unsubscribe: (() => void) | null = null;
      getMockApi().then((mockAPI) => {
        unsubscribe = mockAPI.subscribeToGlobalUpdates(callback);
      });
      return () => {
        if (unsubscribe) unsubscribe();
      };
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


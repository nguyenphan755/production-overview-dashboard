/**
 * Machine Status Cache Service
 * 
 * Maintains in-memory cache of machine statuses to prevent unnecessary database writes.
 * Only updates database when status actually changes (event-based updates).
 * 
 * This significantly reduces database load and aligns with MES/SCADA best practices.
 */

// In-memory cache: machineId -> { status, lastUpdated }
const statusCache = new Map();

/**
 * Get cached status for a machine
 * @param {string} machineId - Machine ID
 * @returns {string|null} Cached status or null if not cached
 */
export function getCachedStatus(machineId) {
  const cached = statusCache.get(machineId);
  return cached ? cached.status : null;
}

/**
 * Check if status has changed
 * @param {string} machineId - Machine ID
 * @param {string} newStatus - New status value
 * @returns {boolean} True if status has changed, false if same
 */
export function hasStatusChanged(machineId, newStatus) {
  const cachedStatus = getCachedStatus(machineId);
  if (cachedStatus === null) {
    // Not cached yet, consider it a change (will be cached after update)
    return true;
  }
  return cachedStatus !== newStatus;
}

/**
 * Update cached status for a machine
 * @param {string} machineId - Machine ID
 * @param {string} status - New status value
 */
export function updateCachedStatus(machineId, status) {
  statusCache.set(machineId, {
    status,
    lastUpdated: new Date()
  });
}

/**
 * Initialize cache from database
 * Loads current statuses of all machines into cache
 * @param {Function} query - Database query function
 */
export async function initializeCache(query) {
  try {
    const result = await query(
      `SELECT id, status FROM machines`
    );
    
    result.rows.forEach(row => {
      statusCache.set(row.id, {
        status: row.status,
        lastUpdated: new Date()
      });
    });
    
    console.log(`✅ Machine status cache initialized: ${statusCache.size} machines`);
  } catch (error) {
    console.error('❌ Error initializing machine status cache:', error);
  }
}

/**
 * Clear cache for a specific machine
 * @param {string} machineId - Machine ID
 */
export function clearCache(machineId) {
  statusCache.delete(machineId);
}

/**
 * Clear all cache
 */
export function clearAllCache() {
  statusCache.clear();
  console.log('🗑️  Machine status cache cleared');
}

/**
 * Get cache statistics
 * @returns {Object} Cache statistics
 */
export function getCacheStats() {
  return {
    size: statusCache.size,
    machines: Array.from(statusCache.entries()).map(([id, data]) => ({
      machineId: id,
      status: data.status,
      lastUpdated: data.lastUpdated
    }))
  };
}


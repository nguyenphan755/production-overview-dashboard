// WebSocket broadcast module

// Store connected WebSocket clients
const clients = new Set();

/**
 * Add a WebSocket client to the broadcast list
 */
export const addClient = (ws) => {
  clients.add(ws);
};

/**
 * Remove a WebSocket client from the broadcast list
 */
export const removeClient = (ws) => {
  clients.delete(ws);
};

/**
 * Broadcast message to all connected clients
 */
export const broadcast = (event, data) => {
  const message = JSON.stringify({
    type: event,
    data,
    timestamp: new Date().toISOString(),
  });

  let sentCount = 0;
  clients.forEach((client) => {
    if (client.readyState === 1) { // WebSocket.OPEN
      try {
        client.send(message);
        sentCount++;
      } catch (error) {
        console.error('Error broadcasting to client:', error);
        // Drop the dead client so the Set does not leak stale sockets.
        clients.delete(client);
      }
    } else if (client.readyState === 2 || client.readyState === 3) {
      // CLOSING or CLOSED — remove so we never iterate dead sockets again.
      clients.delete(client);
    }
  });

  if (sentCount > 0 && process.env.NODE_ENV !== 'production') {
    console.log(`📡 Broadcasted ${event} to ${sentCount} client(s)`);
  }
};

/**
 * Iterate clients (used by the heartbeat to terminate dead connections).
 */
export const getClients = () => clients;

/**
 * Get number of connected clients
 */
export const getClientCount = () => {
  return clients.size;
};


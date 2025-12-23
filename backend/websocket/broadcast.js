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
      }
    }
  });

  if (sentCount > 0) {
    console.log(`📡 Broadcasted ${event} to ${sentCount} client(s)`);
  }
};

/**
 * Get number of connected clients
 */
export const getClientCount = () => {
  return clients.size;
};


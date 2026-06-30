// In-memory user presence tracking (heartbeat-based)

import { broadcast } from '../websocket/broadcast.js';

const HEARTBEAT_TTL_MS = parseInt(process.env.PRESENCE_TTL_MS || '45000', 10);
const CLEANUP_INTERVAL_MS = 15000;

/** @type {Map<string, { userId: number, username: string, lastSeenAt: number }>} */
const sessions = new Map();

let lastBroadcastCount = -1;
let cleanupTimer = null;

function pruneExpiredSessions() {
  const now = Date.now();
  for (const [sessionId, session] of sessions) {
    if (now - session.lastSeenAt > HEARTBEAT_TTL_MS) {
      sessions.delete(sessionId);
    }
  }
}

function getUniqueOnlineUsers() {
  pruneExpiredSessions();
  const byUserId = new Map();
  for (const session of sessions.values()) {
    const existing = byUserId.get(session.userId);
    if (!existing || session.lastSeenAt > existing.lastSeenAt) {
      byUserId.set(session.userId, session);
    }
  }
  return Array.from(byUserId.values()).sort((a, b) =>
    a.username.localeCompare(b.username, 'vi')
  );
}

function maybeBroadcastCount() {
  const count = getUniqueOnlineUsers().length;
  if (count !== lastBroadcastCount) {
    lastBroadcastCount = count;
    broadcast('presence:update', { count });
  }
  return count;
}

export function touchPresence(sessionId, userId, username) {
  if (!sessionId || !userId) {
    return getPresenceSnapshot();
  }

  sessions.set(String(sessionId), {
    userId,
    username: username || `user-${userId}`,
    lastSeenAt: Date.now(),
  });

  maybeBroadcastCount();
  return getPresenceSnapshot();
}

export function removePresence(sessionId) {
  if (sessionId) {
    sessions.delete(String(sessionId));
  }
  maybeBroadcastCount();
  return getPresenceSnapshot();
}

export function getPresenceSnapshot() {
  const users = getUniqueOnlineUsers();
  const count = users.length;
  return {
    count,
    users: users.map((u) => ({
      userId: u.userId,
      username: u.username,
    })),
  };
}

export function startPresenceCleanup() {
  if (cleanupTimer) {
    return stopPresenceCleanup;
  }

  cleanupTimer = setInterval(() => {
    const before = sessions.size;
    pruneExpiredSessions();
    if (sessions.size !== before) {
      maybeBroadcastCount();
    }
  }, CLEANUP_INTERVAL_MS);

  return stopPresenceCleanup;
}

export function stopPresenceCleanup() {
  if (cleanupTimer) {
    clearInterval(cleanupTimer);
    cleanupTimer = null;
  }
}

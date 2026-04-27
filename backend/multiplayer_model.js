let dbRef = null;

export function setMultiplayerModelDb(db) {
  dbRef = db;
}

function requireDb() {
  if (!dbRef) throw new Error('MultiplayerModel DB not set. Call setMultiplayerModelDb(db) on startup.');
  return dbRef;
}

/**
 * Multiplayer model backed by DatabaseManager (PostgreSQL via DATABASE_URL, else SQLite).
 * Matches the old interface used by server.js.
 */
class MultiplayerModel {
  static async createOrGetSession(sessionId, title = null) {
    const db = requireDb();
    try {
      const existing = await db.getMultiplayerSession(sessionId);
      if (existing) return existing;
      await db.createMultiplayerSession(sessionId, title || `Multiplayer Session ${sessionId}`);
      return await db.getMultiplayerSession(sessionId);
    } catch (e) {
      // If it raced, fetch again.
      return await db.getMultiplayerSession(sessionId);
    }
  }

  static async updateParticipantCount(sessionId, count) {
    const db = requireDb();
    await db.updateMultiplayerParticipantCount(sessionId, count);
    return await db.getMultiplayerSession(sessionId);
  }

  static async addMessage(sessionId, sender, content, messageType = 'chat', questionNumber = null) {
    const db = requireDb();
    await db.addMultiplayerMessage(sessionId, sender, content, messageType, questionNumber);
    return { session_id: sessionId, sender, content, message_type: messageType, question_number: questionNumber };
  }

  static async getMessages(sessionId, limit = 100, offset = 0) {
    const db = requireDb();
    return await db.getMultiplayerMessages(sessionId, limit, offset);
  }

  static async deactivateSession(sessionId) {
    const db = requireDb();
    await db.deactivateMultiplayerSession(sessionId);
    return await db.getMultiplayerSession(sessionId);
  }

  static async getActiveSessions(limit = 20, offset = 0) {
    const db = requireDb();
    const sessions = await db.getMultiplayerSessions(limit, offset);
    return sessions.filter((s) => s.is_active === 1 || s.is_active === true);
  }
}

export default MultiplayerModel;


import { Pool } from 'pg';
import SqliteDatabase from './database-sqlite.js';

/**
 * Async data layer: PostgreSQL when DATABASE_URL is set, otherwise SQLite.
 */
export default class DatabaseManager {
  constructor() {
    this.backend = process.env.DATABASE_URL ? 'postgres' : 'sqlite';
    this.pg = null;
    this.sqlite = null;
  }

  async initialize() {
    if (this.backend === 'postgres') {
      try {
        this.pg = new Pool({
          connectionString: process.env.DATABASE_URL,
          max: Number(process.env.PG_POOL_MAX || 20),
          idleTimeoutMillis: Number(process.env.PG_IDLE_TIMEOUT_MS || 30000),
          connectionTimeoutMillis: Number(process.env.PG_CONNECTION_TIMEOUT_MS || 10000),
        });
        this.pg.on('error', (err) => console.error('❌ Unexpected PostgreSQL pool error:', err));
        await this.ensurePostgresSchema();
        console.log('✅ PostgreSQL initialized (DATABASE_URL)');
      } catch (err) {
        console.warn('⚠️ PostgreSQL unavailable, falling back to SQLite:', err.message || err);
        if (this.pg) {
          await this.pg.end().catch(() => {});
          this.pg = null;
        }
        this.backend = 'sqlite';
        this.sqlite = new SqliteDatabase();
      }
    } else {
      this.sqlite = new SqliteDatabase();
      console.log('✅ SQLite initialized (set DATABASE_URL for PostgreSQL)');
    }
  }

  async ensurePostgresSchema() {
    const sql = `
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      last_login TIMESTAMPTZ
    );
    CREATE TABLE IF NOT EXISTS companions (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      personality TEXT NOT NULL,
      identity TEXT NOT NULL,
      gender TEXT NOT NULL,
      role TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS conversations (
      id SERIAL PRIMARY KEY,
      companion_id INTEGER NOT NULL REFERENCES companions(id) ON DELETE CASCADE,
      session_id TEXT UNIQUE NOT NULL,
      title TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW(),
      is_active BOOLEAN DEFAULT TRUE
    );
    CREATE TABLE IF NOT EXISTS messages (
      id SERIAL PRIMARY KEY,
      conversation_id INTEGER NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
      sender TEXT NOT NULL CHECK (sender IN ('user', 'ai')),
      content TEXT NOT NULL,
      emotion TEXT,
      "timestamp" TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS multiplayer_sessions (
      id SERIAL PRIMARY KEY,
      session_id TEXT UNIQUE NOT NULL,
      title TEXT,
      participant_count INTEGER DEFAULT 0,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW(),
      is_active BOOLEAN DEFAULT TRUE,
      last_activity TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS multiplayer_messages (
      id SERIAL PRIMARY KEY,
      session_id TEXT NOT NULL REFERENCES multiplayer_sessions(session_id) ON DELETE CASCADE,
      sender TEXT NOT NULL,
      content TEXT NOT NULL,
      message_type TEXT DEFAULT 'chat' CHECK (message_type IN ('chat', 'question', 'answer', 'system', 'emoji', 'image', 'game')),
      question_number INTEGER,
      "timestamp" TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_conversations_companion_id ON conversations(companion_id);
    CREATE INDEX IF NOT EXISTS idx_conversations_session_id ON conversations(session_id);
    CREATE INDEX IF NOT EXISTS idx_conversations_created_at ON conversations(created_at);
    CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON messages(conversation_id);
    CREATE INDEX IF NOT EXISTS idx_messages_timestamp ON messages("timestamp");
    CREATE INDEX IF NOT EXISTS idx_messages_sender ON messages(sender);
    CREATE INDEX IF NOT EXISTS idx_multiplayer_sessions_session_id ON multiplayer_sessions(session_id);
    CREATE INDEX IF NOT EXISTS idx_multiplayer_messages_session_id ON multiplayer_messages(session_id);
    CREATE INDEX IF NOT EXISTS idx_multiplayer_messages_timestamp ON multiplayer_messages("timestamp");
    `;
    await this.pg.query(sql);
  }

  _normalizeSessionRow(row) {
    if (!row) return null;
    return {
      ...row,
      is_active: row.is_active === true || row.is_active === 1 ? 1 : 0,
    };
  }

  async createCompanion(companionData) {
    if (this.sqlite) return this.sqlite.createCompanion(companionData);
    const { rows } = await this.pg.query(
      `INSERT INTO companions (name, personality, identity, gender, role)
       VALUES ($1,$2,$3,$4,$5) RETURNING id`,
      [companionData.name, companionData.personality, companionData.identity, companionData.gender, companionData.role]
    );
    return rows[0].id;
  }

  async getCompanion(companionId) {
    if (this.sqlite) return this.sqlite.getCompanion(companionId);
    const { rows } = await this.pg.query('SELECT * FROM companions WHERE id = $1', [companionId]);
    return rows[0] || null;
  }

  async getCompanionByName(name) {
    if (this.sqlite) return this.sqlite.getCompanionByName(name);
    const { rows } = await this.pg.query('SELECT * FROM companions WHERE name = $1', [name]);
    return rows[0] || null;
  }

  async updateCompanion(companionId, companionData) {
    if (this.sqlite) return this.sqlite.updateCompanion(companionId, companionData);
    await this.pg.query(
      `UPDATE companions SET name=$1, personality=$2, identity=$3, gender=$4, role=$5, updated_at=NOW() WHERE id=$6`,
      [companionData.name, companionData.personality, companionData.identity, companionData.gender, companionData.role, companionId]
    );
  }

  async createConversation(companionId, sessionId, title = null) {
    if (this.sqlite) return this.sqlite.createConversation(companionId, sessionId, title);
    const { rows } = await this.pg.query(
      `INSERT INTO conversations (companion_id, session_id, title) VALUES ($1,$2,$3) RETURNING id`,
      [companionId, sessionId, title]
    );
    return rows[0].id;
  }

  async getConversation(sessionId) {
    if (this.sqlite) return this.sqlite.getConversation(sessionId);
    const { rows } = await this.pg.query(
      `SELECT c.*, comp.name AS companion_name, comp.personality, comp.identity, comp.gender, comp.role
       FROM conversations c JOIN companions comp ON c.companion_id = comp.id WHERE c.session_id = $1`,
      [sessionId]
    );
    return rows[0] ? this._normalizeSessionRow(rows[0]) : null;
  }

  async getConversationById(conversationId) {
    if (this.sqlite) return this.sqlite.getConversationById(conversationId);
    const { rows } = await this.pg.query(
      `SELECT c.*, comp.name AS companion_name, comp.personality, comp.identity, comp.gender, comp.role
       FROM conversations c JOIN companions comp ON c.companion_id = comp.id WHERE c.id = $1`,
      [conversationId]
    );
    return rows[0] ? this._normalizeSessionRow(rows[0]) : null;
  }

  async updateConversationTitle(conversationId, title) {
    if (this.sqlite) return this.sqlite.updateConversationTitle(conversationId, title);
    await this.pg.query(`UPDATE conversations SET title=$1, updated_at=NOW() WHERE id=$2`, [title, conversationId]);
  }

  async deactivateConversation(sessionId) {
    if (this.sqlite) return this.sqlite.deactivateConversation(sessionId);
    await this.pg.query(`UPDATE conversations SET is_active=FALSE, updated_at=NOW() WHERE session_id=$1`, [sessionId]);
  }

  async addMessage(conversationId, sender, content, emotion = null) {
    if (this.sqlite) return this.sqlite.addMessage(conversationId, sender, content, emotion);
    const { rows } = await this.pg.query(
      `INSERT INTO messages (conversation_id, sender, content, emotion) VALUES ($1,$2,$3,$4) RETURNING id`,
      [conversationId, sender, content, emotion]
    );
    await this.pg.query(`UPDATE conversations SET updated_at=NOW() WHERE id=$1`, [conversationId]);
    return rows[0].id;
  }

  async getMessages(conversationId, limit = 50, offset = 0) {
    if (this.sqlite) return this.sqlite.getMessages(conversationId, limit, offset);
    const { rows } = await this.pg.query(
      `SELECT * FROM messages WHERE conversation_id = $1 ORDER BY timestamp ASC LIMIT $2 OFFSET $3`,
      [conversationId, limit, offset]
    );
    return rows;
  }

  async getRecentMessages(conversationId, count = 10) {
    if (this.sqlite) return this.sqlite.getRecentMessages(conversationId, count);
    const { rows } = await this.pg.query(
      `SELECT * FROM messages WHERE conversation_id = $1 ORDER BY timestamp DESC LIMIT $2`,
      [conversationId, count]
    );
    return rows.reverse();
  }

  async createMultiplayerSession(sessionId, title = null) {
    if (this.sqlite) return this.sqlite.createMultiplayerSession(sessionId, title);
    const existing = await this.getMultiplayerSession(sessionId);
    if (existing) {
      if (!existing.is_active) {
        await this.pg.query(
          `UPDATE multiplayer_sessions SET is_active=TRUE, last_activity=NOW(), updated_at=NOW() WHERE session_id=$1`,
          [sessionId]
        );
        return;
      }
      throw new Error('Session already exists and is active');
    }
    await this.pg.query(
      `INSERT INTO multiplayer_sessions (session_id, title) VALUES ($1,$2)`,
      [sessionId, title]
    );
  }

  async getMultiplayerSession(sessionId) {
    if (this.sqlite) return this.sqlite.getMultiplayerSession(sessionId);
    const { rows } = await this.pg.query('SELECT * FROM multiplayer_sessions WHERE session_id = $1', [sessionId]);
    return this._normalizeSessionRow(rows[0]) || null;
  }

  async updateMultiplayerSessionActivity(sessionId) {
    if (this.sqlite) return this.sqlite.updateMultiplayerSessionActivity(sessionId);
    await this.pg.query(
      `UPDATE multiplayer_sessions SET last_activity=NOW(), updated_at=NOW() WHERE session_id=$1`,
      [sessionId]
    );
  }

  async updateMultiplayerParticipantCount(sessionId, count) {
    if (this.sqlite) return this.sqlite.updateMultiplayerParticipantCount(sessionId, count);
    await this.pg.query(
      `UPDATE multiplayer_sessions SET participant_count=$1, last_activity=NOW() WHERE session_id=$2`,
      [count, sessionId]
    );
  }

  async deactivateMultiplayerSession(sessionId) {
    if (this.sqlite) return this.sqlite.deactivateMultiplayerSession(sessionId);
    await this.pg.query(
      `UPDATE multiplayer_sessions SET is_active=FALSE, updated_at=NOW() WHERE session_id=$1`,
      [sessionId]
    );
  }

  async addMultiplayerMessage(sessionId, sender, content, messageType = 'chat', questionNumber = null) {
    if (this.sqlite) return this.sqlite.addMultiplayerMessage(sessionId, sender, content, messageType, questionNumber);
    await this.pg.query(
      `INSERT INTO multiplayer_messages (session_id, sender, content, message_type, question_number)
       VALUES ($1,$2,$3,$4,$5)`,
      [sessionId, sender, content, messageType, questionNumber]
    );
    await this.updateMultiplayerSessionActivity(sessionId);
  }

  async getMultiplayerMessages(sessionId, limit = 100, offset = 0) {
    if (this.sqlite) return this.sqlite.getMultiplayerMessages(sessionId, limit, offset);
    const { rows } = await this.pg.query(
      `SELECT * FROM multiplayer_messages WHERE session_id = $1 ORDER BY timestamp ASC LIMIT $2 OFFSET $3`,
      [sessionId, limit, offset]
    );
    return rows;
  }

  async getRecentMultiplayerMessages(sessionId, count = 20) {
    if (this.sqlite) return this.sqlite.getRecentMultiplayerMessages(sessionId, count);
    const { rows } = await this.pg.query(
      `SELECT * FROM multiplayer_messages WHERE session_id = $1 ORDER BY timestamp DESC LIMIT $2`,
      [sessionId, count]
    );
    return rows.reverse();
  }

  async getMultiplayerSessions(limit = 20, offset = 0) {
    if (this.sqlite) return this.sqlite.getMultiplayerSessions(limit, offset);
    const { rows } = await this.pg.query(
      `SELECT ms.*,
        (SELECT COUNT(*)::int FROM multiplayer_messages mm WHERE mm.session_id = ms.session_id) AS message_count,
        (SELECT content FROM multiplayer_messages mm2 WHERE mm2.session_id = ms.session_id ORDER BY mm2.timestamp DESC LIMIT 1) AS last_message
       FROM multiplayer_sessions ms ORDER BY ms.updated_at DESC LIMIT $1 OFFSET $2`,
      [limit, offset]
    );
    return rows.map((r) => this._normalizeSessionRow(r));
  }

  async searchMultiplayerSessions(searchTerm, limit = 20) {
    if (this.sqlite) return this.sqlite.searchMultiplayerSessions(searchTerm, limit);
    const pattern = `%${searchTerm}%`;
    const { rows } = await this.pg.query(
      `SELECT DISTINCT ms.*,
        (SELECT COUNT(*)::int FROM multiplayer_messages mm WHERE mm.session_id = ms.session_id) AS message_count
       FROM multiplayer_sessions ms
       JOIN multiplayer_messages mm ON ms.session_id = mm.session_id
       WHERE ms.title ILIKE $1 OR mm.content ILIKE $2 OR ms.session_id ILIKE $3
       ORDER BY ms.updated_at DESC LIMIT $4`,
      [pattern, pattern, pattern, limit]
    );
    return rows.map((r) => this._normalizeSessionRow(r));
  }

  async getMultiplayerStats() {
    if (this.sqlite) return this.sqlite.getMultiplayerStats();
    const { rows } = await this.pg.query(`
      SELECT 
        COUNT(*)::bigint AS total_sessions,
        COUNT(*) FILTER (WHERE is_active)::bigint AS active_sessions,
        COUNT(*) FILTER (WHERE created_at::date = CURRENT_DATE)::bigint AS sessions_today,
        COUNT(*) FILTER (WHERE created_at::date = CURRENT_DATE - 1)::bigint AS sessions_yesterday,
        AVG(participant_count)::float AS avg_participants
      FROM multiplayer_sessions`);
    return rows[0];
  }

  async getMultiplayerMessageStats() {
    if (this.sqlite) return this.sqlite.getMultiplayerMessageStats();
    const { rows } = await this.pg.query(`
      SELECT 
        COUNT(*)::bigint AS total_messages,
        COUNT(*) FILTER (WHERE message_type = 'chat')::bigint AS chat_messages,
        COUNT(*) FILTER (WHERE message_type = 'question')::bigint AS question_messages,
        COUNT(*) FILTER (WHERE message_type = 'answer')::bigint AS answer_messages,
        COUNT(*) FILTER (WHERE message_type = 'emoji')::bigint AS emoji_messages,
        COUNT(*) FILTER (WHERE ("timestamp")::date = CURRENT_DATE)::bigint AS messages_today
      FROM multiplayer_messages`);
    return rows[0];
  }

  async exportMultiplayerSession(sessionId) {
    if (this.sqlite) return this.sqlite.exportMultiplayerSession(sessionId);
    const session = await this.getMultiplayerSession(sessionId);
    if (!session) return null;
    const messages = await this.getMultiplayerMessages(sessionId);
    return {
      session: {
        id: session.id,
        session_id: session.session_id,
        title: session.title,
        participant_count: session.participant_count,
        created_at: session.created_at,
        updated_at: session.updated_at,
        last_activity: session.last_activity,
      },
      messages: messages.map((msg) => ({
        id: msg.id,
        sender: msg.sender,
        content: msg.content,
        message_type: msg.message_type,
        question_number: msg.question_number,
        timestamp: msg.timestamp,
      })),
    };
  }

  async getConversations(companionId = null, limit = 20, offset = 0) {
    if (this.sqlite) return this.sqlite.getConversations(companionId, limit, offset);
    let q = `
      SELECT c.*, comp.name AS companion_name,
        (SELECT COUNT(*)::int FROM messages m WHERE m.conversation_id = c.id) AS message_count,
        (SELECT content FROM messages m2 WHERE m2.conversation_id = c.id ORDER BY m2.timestamp DESC LIMIT 1) AS last_message
      FROM conversations c JOIN companions comp ON c.companion_id = comp.id`;
    const params = [];
    if (companionId) {
      q += ' WHERE c.companion_id = $1';
      params.push(companionId);
    }
    q += ` ORDER BY c.updated_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, offset);
    const { rows } = await this.pg.query(q, params);
    return rows.map((r) => this._normalizeSessionRow(r));
  }

  async searchConversations(searchTerm, limit = 20) {
    if (this.sqlite) return this.sqlite.searchConversations(searchTerm, limit);
    const pattern = `%${searchTerm}%`;
    const { rows } = await this.pg.query(
      `SELECT DISTINCT c.*, comp.name AS companion_name,
        (SELECT COUNT(*)::int FROM messages m WHERE m.conversation_id = c.id) AS message_count
       FROM conversations c
       JOIN companions comp ON c.companion_id = comp.id
       JOIN messages m ON c.id = m.conversation_id
       WHERE c.title ILIKE $1 OR m.content ILIKE $2 OR comp.name ILIKE $3
       ORDER BY c.updated_at DESC LIMIT $4`,
      [pattern, pattern, pattern, limit]
    );
    return rows.map((r) => this._normalizeSessionRow(r));
  }

  async getConversationStats() {
    if (this.sqlite) return this.sqlite.getConversationStats();
    const { rows } = await this.pg.query(`
      SELECT 
        COUNT(*)::bigint AS total_conversations,
        COUNT(*) FILTER (WHERE is_active)::bigint AS active_conversations,
        COUNT(*) FILTER (WHERE created_at::date = CURRENT_DATE)::bigint AS conversations_today,
        COUNT(*) FILTER (WHERE created_at::date = CURRENT_DATE - 1)::bigint AS conversations_yesterday
      FROM conversations`);
    return rows[0];
  }

  async getMessageStats() {
    if (this.sqlite) return this.sqlite.getMessageStats();
    const { rows } = await this.pg.query(`
      SELECT 
        COUNT(*)::bigint AS total_messages,
        COUNT(*) FILTER (WHERE sender = 'user')::bigint AS user_messages,
        COUNT(*) FILTER (WHERE sender = 'ai')::bigint AS ai_messages,
        COUNT(*) FILTER (WHERE ("timestamp")::date = CURRENT_DATE)::bigint AS messages_today
      FROM messages`);
    return rows[0];
  }

  async getCompanionStats() {
    if (this.sqlite) return this.sqlite.getCompanionStats();
    const { rows } = await this.pg.query(`
      SELECT comp.name,
        COUNT(DISTINCT c.id)::bigint AS conversation_count,
        COUNT(m.id)::bigint AS message_count,
        MAX(c.updated_at) AS last_activity
      FROM companions comp
      LEFT JOIN conversations c ON comp.id = c.companion_id
      LEFT JOIN messages m ON c.id = m.conversation_id
      GROUP BY comp.id, comp.name
      ORDER BY message_count DESC`);
    return rows;
  }

  async cleanupOldConversations(daysOld = 30) {
    if (this.sqlite) return this.sqlite.cleanupOldConversations(daysOld);
    const { rowCount } = await this.pg.query(
      `DELETE FROM conversations WHERE updated_at < NOW() - ($1::int * INTERVAL '1 day') AND is_active = FALSE`,
      [daysOld]
    );
    return { changes: rowCount };
  }

  async cleanupOldMultiplayerSessions(daysOld = 30) {
    if (this.sqlite) return this.sqlite.cleanupOldMultiplayerSessions(daysOld);
    const { rowCount } = await this.pg.query(
      `DELETE FROM multiplayer_sessions WHERE updated_at < NOW() - ($1::int * INTERVAL '1 day') AND is_active = FALSE`,
      [daysOld]
    );
    return { changes: rowCount };
  }

  async getDatabaseSize() {
    if (this.sqlite) return this.sqlite.getDatabaseSize();
    const { rows } = await this.pg.query('SELECT pg_database_size(current_database())::bigint AS size');
    return Number(rows[0].size);
  }

  async exportConversation(conversationId) {
    if (this.sqlite) return this.sqlite.exportConversation(conversationId);
    const conversation = await this.getConversationById(conversationId);
    if (!conversation) return null;
    const messages = await this.getMessages(conversationId);
    return {
      conversation: {
        id: conversation.id,
        session_id: conversation.session_id,
        title: conversation.title,
        created_at: conversation.created_at,
        updated_at: conversation.updated_at,
        companion: {
          name: conversation.companion_name,
          personality: conversation.personality,
          identity: conversation.identity,
          gender: conversation.gender,
          role: conversation.role,
        },
      },
      messages: messages.map((msg) => ({
        id: msg.id,
        sender: msg.sender,
        content: msg.content,
        emotion: msg.emotion,
        timestamp: msg.timestamp,
      })),
    };
  }

  async createUser(userId, username, email, passwordHash) {
    if (this.sqlite) return this.sqlite.createUser(userId, username, email, passwordHash);
    try {
      await this.pg.query(
        `INSERT INTO users (id, username, email, password_hash, created_at) VALUES ($1,$2,$3,$4,NOW())`,
        [userId, username, email, passwordHash]
      );
      return { id: userId, username, email, createdAt: new Date() };
    } catch (e) {
      if (e.code === '23505') throw new Error('Username or email already exists');
      throw e;
    }
  }

  async getUserByUsername(username) {
    if (this.sqlite) return this.sqlite.getUserByUsername(username);
    const { rows } = await this.pg.query('SELECT * FROM users WHERE username = $1', [username]);
    return rows[0] || null;
  }

  async getUserByEmail(email) {
    if (this.sqlite) return this.sqlite.getUserByEmail(email);
    const { rows } = await this.pg.query('SELECT * FROM users WHERE email = $1', [email]);
    return rows[0] || null;
  }

  async getUserById(userId) {
    if (this.sqlite) return this.sqlite.getUserById(userId);
    const { rows } = await this.pg.query('SELECT * FROM users WHERE id = $1', [userId]);
    return rows[0] || null;
  }

  async updateUserLastLogin(userId) {
    if (this.sqlite) return this.sqlite.updateUserLastLogin(userId);
    await this.pg.query('UPDATE users SET last_login = NOW() WHERE id = $1', [userId]);
  }

  async updateUserProfile(userId, { username, email }) {
    if (this.sqlite) return this.sqlite.updateUserProfile(userId, { username, email });

    const fields = [];
    const params = [];
    let i = 1;
    if (username) {
      fields.push(`username = $${i++}`);
      params.push(username);
    }
    if (email) {
      fields.push(`email = $${i++}`);
      params.push(email);
    }
    if (fields.length === 0) return;
    params.push(userId);
    await this.pg.query(`UPDATE users SET ${fields.join(', ')} WHERE id = $${i}`, params);
  }

  async updateUserPassword(userId, passwordHash) {
    if (this.sqlite) return this.sqlite.updateUserPassword(userId, passwordHash);
    await this.pg.query('UPDATE users SET password_hash = $1 WHERE id = $2', [passwordHash, userId]);
  }

  async close() {
    if (this.pg) {
      await this.pg.end();
      console.log('🔒 PostgreSQL pool closed');
    }
    if (this.sqlite) {
      this.sqlite.close();
    }
  }
}
